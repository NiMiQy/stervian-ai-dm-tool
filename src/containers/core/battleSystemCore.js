import { randomUUID } from 'node:crypto';
import { databaseError } from '../../database/databaseError.js';
import prisma from '../../services/prismaClient.js';
import { chooseNpcAction, completeNpcTurn, recordNpcDamage } from '../aiDecisionContainer.js';
import { calculateExpReward } from '../progressionContainer.js';
import { applyLevelRewards } from '../../services/progressionService.js';
import { recordQuestEliminations } from '../questContainer.js';
import { getHungerState, hungerDamage, refreshHungerStatus, skillEnergyCost, refreshThirstStatus } from '../effectContainer.js';
import { refreshCharacterEffects, syncHungerEffects, syncThirstEffects } from '../../services/effectServices.js';
import { characterItemInclude, buildEquipment, toCharacterItemView } from '../../components/logics/characterItems.js';
import { applyConsumeBonus, clearTemporaryBonusTimes, consumeBonusBlockReason, syncStoredMaxHp } from '../../services/itemBonusTimeService.js';
import { getPartyCombatants, leaveParty } from '../partyContainer.js';
import { broadcastToUsers } from '../../services/webSocketService.js';
import { canAccessNsfw, NSFW_PLAYER_SELECT } from '../../services/nsfwAccessService.js';
import {
  ATTRIBUTE_POINTS_PER_COST_STEP,
  BASE_ATTRIBUTE_VALUE,
  BASH_SKILL_NAME,
  BATTLE_ACTION_FLEE,
  BATTLE_STATUS,
  CARRIED_LOCATIONS,
  CHARACTER_TYPE,
  COMBAT_STATUS_TYPE,
  COMBAT_STATUS_TYPES,
  COMBAT_TTL_MS,
  COMPANION_REVIVE_HP_RATIO,
  CURE_EFFECT_NONE,
  DAZE_INITIATIVE_MULTIPLIER,
  DEFAULT_BACKPACK_SLOTS,
  DEFAULT_COMPANION_HP,
  DEFAULT_INITIATIVE_VARIANCE,
  DEFAULT_MAX_ENERGY,
  DEFAULT_MAX_FOOD,
  DEFAULT_MAX_WATER,
  DEFAULT_RESPAWN_LOCATION_ID,
  DEFAULT_SKILL_HEAL_AMOUNT,
  DEFAULT_STATUS_PROC_CHANCE,
  DEFAULT_TACTICS_ROLE,
  DEFAULT_TAUNT_DURATION,
  DODGE_SKILL_NAME,
  ELEMENTAL_RESISTANCE_MAX,
  ELEMENTAL_RESISTANCE_MIN,
  ELEMENTS,
  ERROR_NAMES,
  FIRST_STRIKE_THREAT_MULTIPLIER,
  FLEE_RULES,
  GUARANTEED_PROC_CHANCE,
  HTTP_STATUS,
  INITIAL_ATTRIBUTE_POINT_BUDGET,
  ITEM_LOCATION,
  ITEM_TYPE,
  LEVELS_PER_INITIATIVE_BONUS,
  LOOT_GROUP_RARITY,
  MAX_ENCOUNTER_ENEMIES,
  MAX_LEVEL,
  MAX_LOOT_CHANCE_PCT,
  MIN_MONSTER_BASE_EXP,
  MONSTER_EXP_PER_LEVEL,
  RESPAWN_VITALS,
  SKILL_DAMAGE_TYPE,
  SKILL_MENU_TYPE,
  EQUIP_SLOT_FIELDS,
  HAND_SLOTS,
  UNARMED_WEAPON_TYPE,
  STATUS_DEFINITIONS,
  STATUS_LABELS,
  STATUS_LABEL_PREFIX,
  STATUS_PROC_CHANCE_MAX,
  STATUS_PROC_CHANCE_MIN,
  TAUNT_SKILL_NAME,
  UPGRADEABLE_STATS,
  WEBSOCKET_EVENTS,
  EVADE_RULES,
  ACCURACY_ACCESSORY_FIELDS,
  ANY_WEAPON_TYPE,
  TRAINING_DUMMY,
} from '../../configs/constants.js';

const sessions = new Map();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function isTauntSkill(skill) {
  return Boolean(skill?.is_taunt || skill?.taunt || String(skill?.name || '').trim().toUpperCase() === TAUNT_SKILL_NAME);
}

function initializeAggroState(unit) {
  if (!unit?.isEnemy) return;
  if (!unit.threatTable || typeof unit.threatTable !== 'object' || Array.isArray(unit.threatTable)) unit.threatTable = {};
  if (typeof unit.firstStrikeResolved !== 'boolean') unit.firstStrikeResolved = Object.values(unit.threatTable).some((value) => number(value) > 0);
  if (!unit.tauntLock || typeof unit.tauntLock !== 'object') unit.tauntLock = null;
  else {
    unit.tauntLock.targetId = unit.tauntLock.targetId || null;
    unit.tauntLock.turnsRemaining = Math.max(0, Math.floor(number(unit.tauntLock.turnsRemaining)));
    unit.tauntLock.dominanceScore = number(unit.tauntLock.dominanceScore);
    if (!unit.tauntLock.targetId || unit.tauntLock.turnsRemaining <= 0) unit.tauntLock = null;
  }
}

export function nextPointCost(currentStat) { return 1 + Math.floor(Math.max(0, number(currentStat, BASE_ATTRIBUTE_VALUE) - BASE_ATTRIBUTE_VALUE) / ATTRIBUTE_POINTS_PER_COST_STEP); }
export function totalSpentCost(stats = {}) { return UPGRADEABLE_STATS.reduce((total, key) => { let value = Math.max(BASE_ATTRIBUTE_VALUE, Math.floor(number(stats[key], BASE_ATTRIBUTE_VALUE))); for (let point = BASE_ATTRIBUTE_VALUE; point < value; point += 1) total += nextPointCost(point); return total; }, 0); }
export function remainingPoints(stats = {}, initialBudget = INITIAL_ATTRIBUTE_POINT_BUDGET, earnedPoints = 0) { return number(initialBudget, INITIAL_ATTRIBUTE_POINT_BUDGET) + number(earnedPoints) - totalSpentCost(stats); }

function equipmentBonuses(equipment = {}) {
  const result = { maxHP: 0, proficiency: 0, intelligent: 0, strength: 0, dexterity: 0, charisma: 0, constitution: 0, wisdom: 0, armor: 0, magicArmor: 0, physicalAttack: 0, magicalAttack: 0, critChance: 0, critDamage: 0, statusResistant: 0, evadeChance: 0, accuracy: 0, elemental: Object.fromEntries(ELEMENTS.map((element) => [element, 0])) };
  Object.values(equipment).forEach((item) => {
    const effect = item?.item_bonus;
    if (!effect) return;
    result.maxHP += number(effect.max_hp_bonus);
    result.proficiency += number(effect.proficiency_bonus);
    for (const [key, field] of Object.entries({ intelligent: 'intelligent_bonus', strength: 'strength_bonus', dexterity: 'dexterity_bonus', charisma: 'charisma_bonus', constitution: 'constitution_bonus', wisdom: 'wisdom_bonus', armor: 'armor_bonus', magicArmor: 'magical_armor_bonus', physicalAttack: 'physical_attack_bonus', magicalAttack: 'magical_attack_bonus', statusResistant: 'effect_resistant_bonus' })) result[key] += number(effect[field]);
    for (const element of ELEMENTS) result.elemental[element] += number(effect[`${element}_element_resistant`]);
    result.evadeChance += number(effect.evade_chance_bonus);
  });

  const leftItem = equipment?.left_hand;
  const rightItem = equipment?.right_hand;
  let mainWeapon = null;
  let offWeapon = null;

  if (leftItem && rightItem) {
    mainWeapon = leftItem;
    offWeapon = rightItem;
  } else if (leftItem) {
    mainWeapon = leftItem;
  } else if (rightItem) {
    mainWeapon = rightItem;
  }

  result.accuracy = number(mainWeapon?.item_bonus?.accuracy_bonus) + ACCURACY_ACCESSORY_FIELDS.reduce((total, field) => total + number(equipment?.[field]?.item_bonus?.accuracy_bonus), 0);

  Object.values(equipment || {}).forEach((item) => {
    const effect = item?.item_bonus;
    if (!effect) return;
    result.critChance += number(effect.crit_chance_bonus);
    result.critDamage += number(effect.crit_damage_bonus);
  });
  result.critChance = Math.round(result.critChance * 100) / 100;
  result.critDamage = Math.round(result.critDamage * 100) / 100;

  return result;
}

export function calculateDerivedStats(rawStats = {}, equipment = {}) {
  const bonus = equipmentBonuses(equipment);
  const stats = { proficiency: Math.max(2, number(rawStats.proficiency, 2)) + bonus.proficiency, intelligent: number(rawStats.intelligent, 5) + bonus.intelligent, strength: number(rawStats.strength, 5) + bonus.strength, dexterity: number(rawStats.dexterity, 5) + bonus.dexterity, charisma: number(rawStats.charisma, 5) + bonus.charisma, constitution: number(rawStats.constitution, 5) + bonus.constitution, wisdom: number(rawStats.wisdom, 5) + bonus.wisdom };
  const resistanceFields = Object.fromEntries(ELEMENTS.map((element) => [`${element}Resist`, Math.floor(number(rawStats[`${element}_element_resistant`], 5) + stats.wisdom - 5 + bonus.elemental[element])]));
  return { ...stats, physicalPower: stats.strength + 0.5 * stats.dexterity + 0.5 * stats.proficiency + bonus.physicalAttack, magicPower: stats.intelligent + 0.5 * stats.wisdom + 0.5 * stats.charisma + 0.5 * stats.proficiency + bonus.magicalAttack, atkDamage: Math.floor(stats.strength + 0.5 * stats.dexterity + 0.5 * stats.proficiency + bonus.physicalAttack), magicAtkDamage: Math.floor(stats.intelligent + 0.5 * stats.wisdom + 0.5 * stats.charisma + 0.5 * stats.proficiency + bonus.magicalAttack), spellAmp: Math.min(50, 0.5 * Math.max(0, stats.intelligent - 5)), maxHP: Math.floor(10 + stats.proficiency + 2 * stats.constitution + stats.strength + bonus.maxHP), armor: Math.floor(5 + stats.dexterity - 5 + bonus.armor), magicArmor: Math.floor(number(rawStats.magic_armor, 4) + stats.wisdom - 5 + bonus.magicArmor), critChance: clamp(number(rawStats.base_crit_chance) + bonus.critChance, 0, 100), critDamage: Math.max(0, number(rawStats.base_crit_damage) + bonus.critDamage), ...resistanceFields, statusResist: Math.floor(number(rawStats.status_resistant, 4) + 0.5 * (stats.strength - 5) + stats.constitution - 5 + bonus.statusResistant), convinceChance: clamp(15 + 1.5 * (stats.charisma - 5), 5, 95), evadeChance: clamp(EVADE_RULES.BASE_PCT + EVADE_RULES.PCT_PER_DEX * Math.max(0, stats.dexterity - EVADE_RULES.DEX_BASELINE) + bonus.evadeChance, 0, EVADE_RULES.CAP_PCT), accuracy: Math.max(0, number(rawStats.accuracy, EVADE_RULES.BASE_ACCURACY) + bonus.accuracy) };
}

export function isDodgeSkill(skill) {
  return String(skill?.name || '').trim().toUpperCase() === DODGE_SKILL_NAME;
}

export function levelGapEvadeBonus(defenderLevel, attackerLevel) {
  const gap = Math.floor(number(defenderLevel, 1)) - Math.floor(number(attackerLevel, 1));
  return gap >= EVADE_RULES.LEVEL_GAP_THRESHOLD ? (gap - EVADE_RULES.LEVEL_GAP_THRESHOLD + 1) * EVADE_RULES.PCT_PER_LEVEL_GAP : 0;
}

export function calculateEvadeChance(attacker, target) {
  if (activeStatus(target, COMBAT_STATUS_TYPE.STUN)) return 0;
  const dazePenalty = activeStatus(target, COMBAT_STATUS_TYPE.DAZE) ? EVADE_RULES.DAZE_PENALTY_PCT : 0;
  const base = number(target?.derived_stats?.evadeChance, EVADE_RULES.BASE_PCT);
  const dodging = Array.isArray(target?.statuses) && target.statuses.includes(STATUS_LABELS.EVASIVE) ? EVADE_RULES.DODGE_BONUS_PCT : 0;
  const blind = activeStatus(attacker, COMBAT_STATUS_TYPE.BLIND) ? EVADE_RULES.BLIND_ACCURACY_PENALTY : 0;
  const accuracy = Math.max(0, number(attacker?.derived_stats?.accuracy, EVADE_RULES.BASE_ACCURACY) - blind);
  return Math.max(0, clamp(base + levelGapEvadeBonus(target?.level, attacker?.level) + dodging, 0, EVADE_RULES.CAP_PCT) - dazePenalty - accuracy);
}

function normalizeEffectType(effect) {
  const value = typeof effect === 'string' ? effect : effect?.effect_type || effect?.type || effect?.name;
  return String(value || '').trim().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function statusLabel(type) { return STATUS_DEFINITIONS[type]?.label || type; }

function statusFromLegacyValue(value) {
  const type = normalizeEffectType(value);
  return COMBAT_STATUS_TYPES.includes(type) ? { type, duration: STATUS_DEFINITIONS[type].duration, value: STATUS_DEFINITIONS[type].value } : null;
}

function activeStatus(unit, type) {
  const structured = (unit?.statusEffects || []).find((status) => status.type === type && number(status.duration) > 0);
  if (structured) return structured;
  return (unit?.statuses || []).map(statusFromLegacyValue).find((status) => status?.type === type) || null;
}

function syncStatusDisplay(unit) {
  const combatLabels = new Set(COMBAT_STATUS_TYPES.map((type) => `${STATUS_LABEL_PREFIX}${statusLabel(type)}`));
  const otherStatuses = (unit.statuses || [])
    .filter((status) => typeof status === 'string' && !combatLabels.has(status) && status !== STATUS_LABELS.NORMAL);
  const combatLabelsToShow = (unit.statusEffects || [])
    .filter((status) => COMBAT_STATUS_TYPES.includes(status.type) && number(status.duration) > 0)
    .map((status) => `${STATUS_LABEL_PREFIX}${statusLabel(status.type)}`);
  unit.statuses = [...new Set([...otherStatuses, ...combatLabelsToShow])];
  if (!unit.statuses.length) unit.statuses.push(STATUS_LABELS.NORMAL);
}

function initializeStatusEffects(unit, persistedEffects = []) {
  const persisted = Array.isArray(persistedEffects) ? persistedEffects : [];
  const legacy = (unit.statuses || []).map(statusFromLegacyValue).filter(Boolean);
  const combined = [...legacy, ...persisted.map((entry) => {
    const effect = entry?.effect || entry;
    const type = normalizeEffectType(effect);
    const definition = STATUS_DEFINITIONS[type];
    if (!definition) return null;
    return {
      type,
      duration: Math.max(0, Math.floor(number(entry.duration_turn ?? entry.duration, definition.duration))),
      value: number(entry.applied_value ?? entry.value, definition.value),
      effectId: entry.effect_id ?? effect.id ?? null
    };
  }).filter(Boolean)];
  const byType = new Map();
  combined.forEach((status) => {
    if (status.duration > 0) byType.set(status.type, status);
  });
  unit.statusEffects = [...byType.values()];
  if (!unit._baseInitiativeManaged) unit.baseInitiative = Math.max(1, number(unit.initiative, 1));
  else unit.baseInitiative = Math.max(1, number(unit.baseInitiative, unit.initiative));
  const daze = activeStatus(unit, COMBAT_STATUS_TYPE.DAZE);
  unit.initiative = daze ? Math.max(1, Math.round(unit.baseInitiative * DAZE_INITIATIVE_MULTIPLIER)) : unit.baseInitiative;
  syncStatusDisplay(unit);
}

function reorderPendingQueue(battle) {
  if (!battle?.turnQueue?.length) return;
  const currentIndex = Math.max(-1, number(battle.currentQueueIndex, -1));
  const acted = battle.turnQueue.slice(0, currentIndex + 1);
  const pending = battle.turnQueue.slice(currentIndex + 1)
    .filter((unit) => unit && !unit.isDefeated && unit.current_hp > 0)
    .sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || a.id.localeCompare(b.id));
  battle.turnQueue = [...acted, ...pending];
}

export function calculateEffectSuccess(attacker, target, baseChance = DEFAULT_STATUS_PROC_CHANCE) {
  const attackerStats = attacker?.derived_stats || attacker || {};
  const targetStats = target?.derived_stats || target || {};
  const chance = clamp(number(baseChance, DEFAULT_STATUS_PROC_CHANCE) + number(attackerStats.constitution, 5) * 2 - number(targetStats.statusResist ?? targetStats.status_resistant, 4), STATUS_PROC_CHANCE_MIN, STATUS_PROC_CHANCE_MAX);
  return { chance, success: Math.random() * 100 < chance };
}

export function applyStatusEffect(target, effect, battle = null) {
  if (!target || target.isDefeated) return { applied: false, type: normalizeEffectType(effect) };
  initializeStatusEffects(target, target.statusEffects);
  const type = normalizeEffectType(effect);
  const definition = STATUS_DEFINITIONS[type];
  if (!definition) return { applied: false, type };
  const existing = activeStatus(target, type);
  const configuredValue = [effect?.applied_value, effect?.value, effect?.poison_damage, effect?.lost_hp_per_turn]
    .map((value) => number(value, 0)).find((value) => value > 0);
  const nextValue = configuredValue ?? definition.value;
  if (type === COMBAT_STATUS_TYPE.STUN && existing) return { applied: false, refreshed: false, type, duration: existing.duration, value: existing.value };
  const status = existing || { type, duration: definition.duration, value: definition.value, effectId: effect?.effect_id ?? effect?.id ?? null };
  status.duration = definition.duration;
  status.effectId = status.effectId ?? effect?.effect_id ?? effect?.id ?? null;
  status.value = type === COMBAT_STATUS_TYPE.POISON ? number(status.value) + Math.max(0, nextValue) : definition.value;
  if (!existing) target.statusEffects.push(status);
  if (type === COMBAT_STATUS_TYPE.DAZE) {
    target._baseInitiativeManaged = true;
    target.baseInitiative = Math.max(1, number(target.baseInitiative, target.initiative));
    target.initiative = Math.max(1, Math.round(target.baseInitiative * DAZE_INITIATIVE_MULTIPLIER));
  }
  syncStatusDisplay(target);
  if (battle && type === COMBAT_STATUS_TYPE.DAZE) reorderPendingQueue(battle);
  return { applied: true, refreshed: Boolean(existing), type, duration: status.duration, value: status.value };
}

function processTurnEndStatuses(unit, battle = null) {
  if (!unit || unit.isDefeated) return;
  initializeStatusEffects(unit, unit.statusEffects);
  const expired = [];
  unit.statusEffects.forEach((status) => {
    if (status.type === COMBAT_STATUS_TYPE.STUN || status.type === COMBAT_STATUS_TYPE.POISON) return;
    status.duration = number(status.duration) - 1;
    if (status.duration <= 0) expired.push(status.type);
  });
  unit.statusEffects = unit.statusEffects.filter((status) => !expired.includes(status.type) && number(status.duration) > 0);
  if (expired.includes(COMBAT_STATUS_TYPE.DAZE)) {
    unit.initiative = unit.baseInitiative;
    if (battle) reorderPendingQueue(battle);
  }
  if (expired.includes(COMBAT_STATUS_TYPE.TAUNT)) {
    unit.tauntLock = null;
  } else if (unit.tauntLock) {
    const tauntStatus = activeStatus(unit, COMBAT_STATUS_TYPE.TAUNT);
    if (tauntStatus) unit.tauntLock.turnsRemaining = number(tauntStatus.duration);
    else unit.tauntLock = null;
  }
  syncStatusDisplay(unit);
}

export function processTurnStartStatuses(unit, battle = null) {
  if (!unit || unit.isDefeated) return { skipped: false, poisonDamage: 0 };
  initializeStatusEffects(unit, unit.statusEffects);
  const poison = activeStatus(unit, COMBAT_STATUS_TYPE.POISON);
  let poisonDamage = 0;
  if (poison) {
    const earthResist = number(unit.derived_stats?.earthResist, 0);
    poisonDamage = Math.max(1, Math.round(number(poison.value) * (1 - earthResist / 100)));
    applyDamage(unit, poisonDamage, null, null, battle);
    poison.duration = number(poison.duration) - 1;
    if (poison.duration <= 0) unit.statusEffects = unit.statusEffects.filter((status) => status !== poison);
    if (battle && poisonDamage > 0) log(battle, `${unit.name} suffered ${poisonDamage} poison damage.`);
  }
  const stunned = Boolean(activeStatus(unit, COMBAT_STATUS_TYPE.STUN));
  if (stunned) unit.statusEffects = unit.statusEffects.filter((status) => status.type !== COMBAT_STATUS_TYPE.STUN);
  syncStatusDisplay(unit);
  return { skipped: stunned && !unit.isDefeated, poisonDamage };
}
export function calculateInitiative(dexterity, level, variance = DEFAULT_INITIATIVE_VARIANCE) {
  const baseDex = Math.floor(number(dexterity, BASE_ATTRIBUTE_VALUE));
  const lvlBonus = Math.floor(number(level, 1) / LEVELS_PER_INITIATIVE_BONUS);
  const v = Math.max(0, Math.floor(number(variance, DEFAULT_INITIATIVE_VARIANCE)));
  const roll = Math.floor(Math.random() * (v * 2 + 1)) - v;
  return Math.max(1, baseDex + roll + lvlBonus);
}

export function scaleMonsterInstance(monster, playerLevel = 1, forcedLevel = null) {
  if (!monster) return monster;
  if (monster.templateBaseLevel !== undefined && forcedLevel === null) {
    return monster;
  }
  const baseLevel = Math.max(1, number(monster.level, 1));
  const pLevel = Math.max(1, number(playerLevel, 1));
  const minLevel = baseLevel;
  const maxLevel = Math.min(MAX_LEVEL, Math.max(baseLevel, pLevel));

  let rolledLevel;
  if (forcedLevel !== null && Number.isFinite(Number(forcedLevel))) {
    rolledLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(forcedLevel))));
  } else {
    rolledLevel = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
  }

  const deltaLevel = Math.max(0, rolledLevel - baseLevel);
  const rawStats = monster.character_stat || {};
  const equipment = monster.character_equipment || {};

  const baseDerived = calculateDerivedStats(rawStats, equipment);

  const scaledStats = {
    ...rawStats,
    strength: number(rawStats.strength, 5) + 2 * deltaLevel,
    constitution: number(rawStats.constitution, 5) + 1 * deltaLevel,
    dexterity: number(rawStats.dexterity, 5) + 1 * deltaLevel,
  };

  const scaledDerived = calculateDerivedStats(scaledStats, equipment);
  const hpDelta = Math.max(0, scaledDerived.maxHP - baseDerived.maxHP);
  const baseMaxHp = Math.max(1, number(rawStats.max_hp, baseDerived.maxHP));
  const scaledMaxHp = baseMaxHp + hpDelta;
  scaledStats.max_hp = scaledMaxHp;
  scaledStats.current_hp = scaledMaxHp;

  return {
    ...monster,
    name: monster.name || 'Unknown monster',
    level: rolledLevel,
    templateBaseLevel: baseLevel,
    character_stat: scaledStats,
  };
}

const WEAPON_HAND_FIELDS = HAND_SLOTS.map((slot) => EQUIP_SLOT_FIELDS[slot]);

export function equippedWeaponTypes(equipment = {}) {
  const types = new Set(WEAPON_HAND_FIELDS.map((field) => equipment?.[field]?.weapon_type).filter(Boolean));
  if (!types.size) types.add(UNARMED_WEAPON_TYPE);
  return types;
}

export function skillWeaponTypes(skill) {
  return (Array.isArray(skill?.for_weapon_types) ? skill.for_weapon_types : []).map((entry) => entry.weapon_type).filter(Boolean);
}

export function skillUsableWithWeapons(skill, weaponTypes) {
  const required = skillWeaponTypes(skill);
  const armed = [...weaponTypes].some((type) => type !== UNARMED_WEAPON_TYPE);
  return !required.length || required.some((type) => (type === ANY_WEAPON_TYPE ? armed : weaponTypes.has(type)));
}

export function weaponRequirementLabel(types = []) {
  const names = types.map((type) => (type === UNARMED_WEAPON_TYPE ? 'no weapon' : type === ANY_WEAPON_TYPE ? 'any weapon' : `a ${type.charAt(0)}${type.slice(1).toLowerCase()}`));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] || 'any weapon';
}

function withWeaponRestriction(skill, weaponTypes, ignoreRestriction) {
  if (!skill) return skill;
  return { ...skill, weapon_types: skillWeaponTypes(skill), weapon_usable: ignoreRestriction || skillUsableWithWeapons(skill, weaponTypes) };
}

function combatant({ id, userId = null, characterId = null, name, level, job, avatar, sprite, stats, equipment, hp, maxHp, energy, spellPoints, skills, effects, isParty, isEnemy, isPlayer = false, isCompanion = false, tactics_role = DEFAULT_TACTICS_ROLE, baseExp, multiplier, lootGroups, templateBaseLevel }) {
  const derived = calculateDerivedStats(stats, equipment);
  const weaponTypes = equippedWeaponTypes(equipment);
  const weaponSkills = (skills || []).map((skill) => withWeaponRestriction(skill, weaponTypes, Boolean(isEnemy)));
  const databaseMaxHp = Math.max(1, number(maxHp, derived.maxHP));
  const unit = { current_water: stats?.current_water, max_water: stats?.max_water, current_food: stats?.current_food, max_food: stats?.max_food, id, userId, characterId, name, level, templateBaseLevel: number(templateBaseLevel, level), job, avatar, sprite, baseExp, multiplier, dex: derived.dexterity, armor: derived.armor, current_hp: clamp(number(hp, databaseMaxHp), 0, databaseMaxHp), max_hp: databaseMaxHp, current_energy: clamp(number(energy, DEFAULT_MAX_ENERGY), 0, DEFAULT_MAX_ENERGY), max_energy: DEFAULT_MAX_ENERGY, spell_points: spellPoints || [], skills: weaponSkills, equipped_weapon_types: [...weaponTypes], initiative: calculateInitiative(derived.dexterity, level), statuses: [STATUS_LABELS.NORMAL], statusEffects: [], _baseInitiativeManaged: true, isDefeated: false, isParty, isEnemy, isPlayer, isCompanion, tactics_role, derived_stats: derived, lootGroups: lootGroups || [], threatTable: isEnemy ? {} : undefined, tauntLock: isEnemy ? null : undefined };
  initializeStatusEffects(unit, effects);
  refreshHungerStatus(unit);
  refreshThirstStatus(unit);
  syncStatusDisplay(unit);
  return unit;
}

export function makeBattle(character, monsters, companions = []) {
  const stat = character?.character_stat || {};
  const player = combatant({
    id: 'player',
    userId: character?.user_id,
    characterId: character?.id,
    name: character?.name || 'Adventurer',
    level: number(character?.level, 1),
    job: character?.job || 'Adventurer',
    avatar: (character?.name || 'A')[0].toUpperCase(),
    stats: stat,
    equipment: { ...(character?.character_equipment || {}), ...(character?.bonus_equipment || {}) },
    hp: stat.current_hp,
    maxHp: stat.max_hp,
    energy: stat.current_energy,
    spellPoints: (character?.character_spellpoints || []).map((slot) => ({
      level: number(slot.level, 1),
      current: Math.max(0, number(slot.current, 2)),
      max_current: Math.max(1, number(slot.max_current, 2))
    })),
    skills: (character?.skills || []).map(({ skill }) => skill).filter(Boolean),
    effects: character?.effects || [],
    isParty: true,
    isPlayer: true
  });

  const partyList = [player];

  // Assemble additional party members (other human players or NPC companions)
  for (const comp of (companions || [])) {
    if (comp.character_id === character?.id || (comp.user_id && comp.user_id === character?.user_id)) continue;
    const compStats = comp.character_stat || comp.vitals || {};
    const isHuman = Boolean(comp.is_player || comp.user_id);
    const unitId = isHuman ? `player_${comp.character_id}` : `companion_${comp.character_id}`;
    const compCombatant = combatant({
      id: unitId,
      userId: comp.user_id || null,
      characterId: comp.character_id,
      name: comp.name || 'Companion',
      level: number(comp.level, 1),
      job: comp.job || (isHuman ? 'Player' : 'Ally'),
      avatar: (comp.name || 'C')[0].toUpperCase(),
      stats: compStats,
      equipment: comp.equipment || comp.character_equipment || {},
      hp: comp.vitals?.current_hp ?? compStats.current_hp ?? DEFAULT_COMPANION_HP,
      maxHp: comp.vitals?.max_hp ?? compStats.max_hp ?? DEFAULT_COMPANION_HP,
      energy: comp.vitals?.current_energy ?? compStats.current_energy ?? DEFAULT_MAX_ENERGY,
      spellPoints: comp.spell_points || [],
      skills: comp.skills || [],
      effects: comp.effects || [],
      isParty: true,
      isPlayer: isHuman,
      isCompanion: !isHuman,
      tactics_role: comp.tactics_role || DEFAULT_TACTICS_ROLE
    });
    partyList.push(compCombatant);
  }

  const enemyList = Array.isArray(monsters) ? monsters : [monsters];
  const playerLevel = number(character?.level, 1);
  const scaledMonsters = enemyList.map((monster) => scaleMonsterInstance(monster, playerLevel));
  const enemies = scaledMonsters.map((monster, index) => {
    const monsterStats = monster?.character_stat || {};
    const lootGroups = (monster.npc?.npc_monsters?.npcmonsters_lootgroups || [])
      .map((rel) => rel.loot_groups)
      .filter((group) => Boolean(group && !group.deleted));
    const isMonster = Boolean(monster.npc?.npc_monsters);
    return combatant({
      id: `enemy_${monster.id}_${index + 1}`,
      characterId: monster.id,
      name: monster.name || 'Unknown monster',
      level: number(monster.level, 1),
      templateBaseLevel: monster.templateBaseLevel ?? monster.level,
      job: monster.job || (isMonster ? 'Monster' : 'Enemy'),
      avatar: (monster.name || 'E')[0].toUpperCase(),
      sprite: monster.sprite || (isMonster ? '👹' : '⚔️'),
      stats: monsterStats,
      equipment: monster.character_equipment || {},
      hp: monsterStats.current_hp,
      maxHp: monsterStats.max_hp,
      skills: (monster.skills || []).map(({ skill }) => skill).filter(Boolean),
      effects: monster.effects || [],
      isEnemy: true,
      baseExp: number(monster.npc?.npc_monsters?.experience_reward, Math.max(MIN_MONSTER_BASE_EXP, number(monster.level, 1) * MONSTER_EXP_PER_LEVEL)),
      multiplier: 1,
      lootGroups
    });
  });
  enemies.forEach(initializeAggroState);
  const queue = [...partyList, ...enemies].sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || a.id.localeCompare(b.id));
  const inventoryRows = character?.character_items || character?.character_inventory?.item_inventory || [];
  const nsfwAllowed = canAccessNsfw(character?.player);
  const inventory = inventoryRows.filter((entry) => (entry.location === ITEM_LOCATION.BACKPACK || !entry.location) && (entry.items?.is_consumable || entry.item?.is_consumable) && (nsfwAllowed || !(entry.items || entry.item)?.is_nsfw)).map((entry, index) => { const item = entry.items || entry.item; return { id: `item_${index + 1}`, item_id: entry.item_id, name: item?.name || 'Unknown item', quantity: Math.max(0, number(entry.quantity, 1)), type: item?.type || ITEM_TYPE.MISCS, is_consumable: true, is_material: Boolean(item?.is_material), description: item?.description || 'A usable item.', item_bonus: item?.item_bonus || {} }; });
  const names = scaledMonsters.map((monster) => monster.name || 'Unknown monster');
  return { id: randomUUID(), encounter: { id: `encounter-${scaledMonsters.map((monster) => monster.id).join('-')}`, type: 'combat', monsterIds: scaledMonsters.map((monster) => monster.id), monsterNames: names, name: names.join(', '), level: Math.max(...scaledMonsters.map((monster) => number(monster.level, 1))), description: `${names.join(', ')} enter the encounter.` }, battleMode: 'turn-simulator', isSimulating: false, status: BATTLE_STATUS.IN_PROGRESS, turnNumber: 1, turnQueue: queue, currentQueueIndex: 0, currentActorId: queue[0].id, turnEvents: [queue[0].id], enemies, party: partyList, inventory, targetedEnemyId: enemies[0].id, selectedSpell: null, menuState: 'main', log: [] };
}
const living = (battle, side) => battle[side].filter((unit) => !unit.isDefeated && unit.current_hp > 0);
function removeThreatFromBattle(battle, unitId) {
  if (!battle || !unitId) return;
  for (const enemy of battle.enemies || []) {
    if (enemy.threatTable && typeof enemy.threatTable === 'object') delete enemy.threatTable[unitId];
    if (enemy.tauntLock?.targetId === unitId) {
      enemy.tauntLock = null;
      enemy.statusEffects = (enemy.statusEffects || []).filter((status) => status.type !== COMBAT_STATUS_TYPE.TAUNT);
      syncStatusDisplay(enemy);
    }
  }
}

function finishUnit(unit, battle = null) {
  if (unit.current_hp <= 0) {
    unit.current_hp = 0;
    unit.isDefeated = true;
    unit.statusEffects = [];
    unit.statuses = [STATUS_LABELS.KNOCKED_OUT];
    removeThreatFromBattle(battle, unit.id);
  }
}

function turnStartKey(battle, actor) { return `${battle.turnNumber}:${battle.currentQueueIndex}:${actor.id}`; }

function prepareTurnStart(battle, actor) {
  const key = turnStartKey(battle, actor);
  if (battle.lastTurnStartKey === key) return { skipped: false, poisonDamage: 0, processed: false };
  battle.lastTurnStartKey = key;
  return { ...processTurnStartStatuses(actor, battle), processed: true };
}

function log(battle, message) { battle.log.push(message); console.log(`[battle ${battle.id}] ${message}`); }
function nextTurn(battle) {
  const previousActor = [...(battle.party || []), ...(battle.enemies || [])].find((unit) => unit.id === battle.currentActorId);
  if (previousActor && !previousActor.isDefeated) processTurnEndStatuses(previousActor, battle);
  battle.currentQueueIndex += 1;
  while (living(battle, 'party').length && living(battle, 'enemies').length) {
    if (battle.currentQueueIndex >= battle.turnQueue.length) {
      for (const enemy of battle.enemies || []) {
        initializeAggroState(enemy);
        if (!enemy.tauntLock) continue;
        const tauntTarget = (battle.party || []).find((unit) => unit.id === enemy.tauntLock.targetId && !unit.isDefeated && unit.current_hp > 0);
        const tauntStatus = activeStatus(enemy, COMBAT_STATUS_TYPE.TAUNT);
        if (!tauntTarget || !tauntStatus || tauntStatus.duration <= 0) {
          enemy.tauntLock = null;
          enemy.statusEffects = (enemy.statusEffects || []).filter((status) => status.type !== COMBAT_STATUS_TYPE.TAUNT);
          syncStatusDisplay(enemy);
          continue;
        }
        enemy.tauntLock.turnsRemaining = Math.max(0, Math.floor(number(tauntStatus.duration)));
      }
      battle.turnNumber += 1;
      battle.currentQueueIndex = 0;
      battle.turnQueue = [...battle.party, ...battle.enemies].filter((unit) => !unit.isDefeated).sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || a.id.localeCompare(b.id));
    }
    const actor = battle.turnQueue[battle.currentQueueIndex];
    if (actor && !actor.isDefeated && actor.current_hp > 0) {
      delete actor.activeDefense;
      actor.statuses = actor.statuses.filter((status) => typeof status !== 'string' || (!status.includes('Defending') && !status.includes('Evasive')));
      refreshHungerStatus(actor);
      refreshThirstStatus(actor);
      syncStatusDisplay(actor);
      const start = prepareTurnStart(battle, actor);
      if (actor.isDefeated || actor.current_hp <= 0) { battle.currentQueueIndex += 1; continue; }
      battle.currentActorId = actor.id; battle.turnEvents.push(actor.id);
      if (start.skipped) {
        log(battle, `${actor.name} is stunned and skips the turn.`);
        processTurnEndStatuses(actor, battle);
        battle.currentQueueIndex += 1;
        continue;
      }
      return;
    }
    battle.currentQueueIndex += 1;
  }
  battle.currentActorId = null;
}
function reduced(raw, defense, resistance = null) { return Math.max(0, Math.floor(raw * (resistance === null ? 100 / (100 + Math.max(0, defense)) : 1 - clamp(resistance, ELEMENTAL_RESISTANCE_MIN, ELEMENTAL_RESISTANCE_MAX) / 100))); }
function damage(attacker, target, skill, expected = false) {
  const a = attacker.derived_stats; const t = target.derived_stats; const defense = target.activeDefense || {}; const result = {};
  const damageType = skill.skill_damage_type || (skill.type === SKILL_MENU_TYPE.MAGIC_ATTACK || skill.type === SKILL_MENU_TYPE.SPELL ? SKILL_DAMAGE_TYPE.MAGICAL : SKILL_DAMAGE_TYPE.PHYSICAL);
  if (damageType === SKILL_DAMAGE_TYPE.PHYSICAL || damageType === SKILL_DAMAGE_TYPE.HYBRID) result.physical = Math.max(1, reduced(a.physicalPower * number(skill.attack_amplifier, 1), t.armor * Math.max(0, number(defense.armor_amplifier, 1))));
  const elementalSkill = ELEMENTS.some((element) => number(skill[`${element}_damage`]) > 0);
  if ((damageType === SKILL_DAMAGE_TYPE.MAGICAL || damageType === SKILL_DAMAGE_TYPE.HYBRID) && !elementalSkill) result.magic = Math.max(1, reduced(a.magicPower * number(skill.magical_attack_amplifier, 1), t.magicArmor * Math.max(0, number(defense.magical_armor_amplifier, 1))));
  for (const element of ELEMENTS) {
    const amount = number(skill[`${element}_damage`]);
    if (!amount) continue;
    const magicBase = skill.type === SKILL_MENU_TYPE.SPELL || skill.type === SKILL_MENU_TYPE.MAGIC_ATTACK ? a.magicPower * number(skill.magical_attack_amplifier, 1) : 0;
    const multiplier = skill.type === SKILL_MENU_TYPE.SPELL ? 1 + a.spellAmp / 100 : 1;
    result[element] = Math.max(1, reduced((magicBase + amount) * multiplier, 0, t[`${element}Resist`],));
  }
  let baseTotal = Object.values(result).reduce((sum, value) => sum + value, 0);
  const weak = activeStatus(target, COMBAT_STATUS_TYPE.WEAK);
  if (weak) baseTotal = Math.max(1, Math.round(baseTotal * (1 + number(weak.value, STATUS_DEFINITIONS.WEAK.value))));
  const blind = activeStatus(attacker, COMBAT_STATUS_TYPE.BLIND);
  const hunger = getHungerState(attacker);
  if (expected) {
    const chance = clamp(number(a.critChance), 0, 100) / 100;
    const criticalTotal = Math.max(1, Math.floor(baseTotal * (1 + Math.max(0, number(a.critDamage)) / 100)));
    const hitChance = (blind ? Math.max(0, 1 - number(blind.value, STATUS_DEFINITIONS.BLIND.value)) : 1) * (1 - calculateEvadeChance(attacker, target) / 100);
    return { total: (hungerDamage(baseTotal, hunger) * (1 - chance) + hungerDamage(criticalTotal, hunger) * chance) * hitChance };
  }
  if (blind && Math.random() * 100 < number(blind.value, STATUS_DEFINITIONS.BLIND.value) * 100) return { total: 0, isMiss: true, critMultiplier: 1 };
  if (Math.random() * 100 < calculateEvadeChance(attacker, target)) return { total: 0, isMiss: true, isEvaded: true, critMultiplier: 1 };
  const roll = Math.random() * 100;
  const isCrit = (number(a.critChance) > 0) && (roll < number(a.critChance));
  const critMultiplier = isCrit ? (1 + Math.max(0, number(a.critDamage)) / 100) : 1;
  result.total = hungerDamage(isCrit ? Math.max(1, Math.floor(baseTotal * critMultiplier)) : baseTotal, hunger);
  result.isCrit = isCrit;
  result.critMultiplier = critMultiplier;
  return result;
}

function skillStatusEffects(skill) {
  const links = Array.isArray(skill?.skill_effects) ? skill.skill_effects.filter((link) => !link.deleted) : [];
  const effects = links.map((link) => ({ ...link, poison_damage: skill?.poison_damage, ...(link.effect || {}) })).filter((effect) => COMBAT_STATUS_TYPES.includes(normalizeEffectType(effect)));
  if (effects.length) return effects;
  if (skill?.effect) return [{ effect_type: normalizeEffectType(skill.effect), applied_value: skill.poison_damage, proc_chance: skill.proc_chance }];
  if (String(skill?.name || '').trim().toUpperCase() === BASH_SKILL_NAME) return [{ effect_type: COMBAT_STATUS_TYPE.STUN, proc_chance: skill.proc_chance }];
  if (isTauntSkill(skill)) return [{ effect_type: COMBAT_STATUS_TYPE.TAUNT, proc_chance: skill?.proc_chance || GUARANTEED_PROC_CHANCE, duration: number(skill?.duration, DEFAULT_TAUNT_DURATION) }];
  return [];
}

function applySkillEffects(attacker, target, skill, battle = null) {
  const results = [];
  for (const effect of skillStatusEffects(skill)) {
    const type = normalizeEffectType(effect);
    const defaultChance = number(effect.proc_chance, 0) > 0 ? number(effect.proc_chance) : DEFAULT_STATUS_PROC_CHANCE;
    const roll = calculateEffectSuccess(attacker, target, defaultChance);
    if (!roll.success) continue;
    const applied = applyStatusEffect(target, effect, battle);
    if (applied.applied) results.push(applied);
  }
  return results;
}

function recordThreat(enemy, attacker, actualDamage, skill) {
  if (!enemy?.isEnemy || !attacker?.isParty || !attacker.id || actualDamage <= 0) return 0;
  initializeAggroState(enemy);
  const multiplier = skill?.aggro_multiplier === null || skill?.aggro_multiplier === undefined
    ? 1
    : Math.max(0, number(skill.aggro_multiplier, 1));
  let threat = Math.round(actualDamage * multiplier);
  if (!enemy.firstStrikeResolved) {
    threat = Math.floor(threat * FIRST_STRIKE_THREAT_MULTIPLIER);
    enemy.firstStrikeResolved = true;
  }
  if (threat <= 0) return 0;
  enemy.threatTable[attacker.id] = number(enemy.threatTable[attacker.id]) + threat;
  return threat;
}

function dominanceScore(unit) {
  const stats = unit?.derived_stats || {};
  return number(unit?.level) * 10 + number(stats.constitution, 5) * 2 + number(stats.strength, 5) * 1.5 + number(stats.charisma, 5);
}

function compareTauntPriority(enemy, candidate, current) {
  const candidateThreat = number(enemy.threatTable?.[candidate.id]);
  const currentThreat = number(enemy.threatTable?.[current.id]);
  if (candidateThreat !== currentThreat) return candidateThreat - currentThreat;
  const candidateLevel = number(candidate.level);
  const currentLevel = number(current.level);
  if (candidateLevel !== currentLevel) return candidateLevel - currentLevel;
  const candidateDominance = dominanceScore(candidate);
  const currentDominance = dominanceScore(current);
  if (candidateDominance !== currentDominance) return candidateDominance - currentDominance;
  return number(candidate.current_hp) - number(current.current_hp);
}

export function applyTaunt(enemy, taunter, skill, battle) {
  if (!enemy?.isEnemy || !taunter?.isParty || taunter.isDefeated || taunter.current_hp <= 0) return null;
  initializeAggroState(enemy);
  const currentTarget = enemy.tauntLock
    ? (battle?.party || []).find((unit) => unit.id === enemy.tauntLock.targetId && !unit.isDefeated && unit.current_hp > 0)
    : null;
  if (currentTarget && currentTarget.id !== taunter.id && compareTauntPriority(enemy, taunter, currentTarget) < 0) return enemy.tauntLock;

  const turnsRemaining = Math.max(1, Math.floor(number(skill?.duration, DEFAULT_TAUNT_DURATION)) || DEFAULT_TAUNT_DURATION);
  applyStatusEffect(enemy, { type: COMBAT_STATUS_TYPE.TAUNT, duration: turnsRemaining }, battle);
  enemy.tauntLock = { targetId: taunter.id, turnsRemaining, dominanceScore: dominanceScore(taunter) };
  return enemy.tauntLock;
}

function trainingRounds(battle) {
  return Math.max(1, number(battle?.turnNumber, 1) - number(battle?.training?.stats?.startTurn, 1) + 1);
}

function freshTrainingStats(battle) {
  return { startTurn: number(battle?.turnNumber, 1), totalDamage: 0, attacks: 0, hits: 0, crits: 0, missed: 0, evaded: 0, highestHit: 0, bySource: {}, kills: [] };
}

function applyTrainingDamage(dummy, amount, attacker, battle) {
  const dealt = Math.max(0, Math.round(number(amount)));
  const stats = battle.training.stats;
  stats.totalDamage += dealt;
  const source = attacker?.name || 'Status effects';
  stats.bySource[source] = number(stats.bySource[source]) + dealt;
  stats.highestHit = Math.max(stats.highestHit, dealt);
  if (dummy.infiniteHp) {
    dummy.current_hp = dummy.max_hp;
    return dealt;
  }
  dummy.current_hp = Math.max(0, dummy.current_hp - dealt);
  if (dummy.current_hp <= 0) {
    const rounds = trainingRounds(battle);
    stats.kills.push({ rounds, damage: stats.totalDamage });
    log(battle, `${dummy.name} was destroyed after ${rounds} round${rounds === 1 ? '' : 's'} (${stats.totalDamage} total damage). It reassembles at full HP.`);
    dummy.current_hp = dummy.max_hp;
  }
  return dealt;
}

function recordTrainingAttack(battle, target, result) {
  if (!battle?.training || !target?.isTrainingDummy) return;
  const stats = battle.training.stats;
  stats.attacks += 1;
  if (result?.isEvaded) stats.evaded += 1;
  else if (result?.isMiss) stats.missed += 1;
  else {
    stats.hits += 1;
    if (result?.isCrit) stats.crits += 1;
  }
}

function applyDamage(target, amount, attacker = null, skill = null, battle = null) {
  if (target?.isTrainingDummy && battle?.training) return applyTrainingDamage(target, amount, attacker, battle);
  const hpLost = Math.min(target.current_hp, Math.max(0, amount));
  target.current_hp -= hpLost;
  recordThreat(target, attacker, hpLost, skill);
  recordNpcDamage(target, hpLost);
  finishUnit(target, battle);
  return hpLost;
}

function autoDefendTurn(battle, actor) {
  const skill = (actor.skills || []).find((entry) => entry.type === SKILL_MENU_TYPE.DEFEND && !isDodgeSkill(entry));
  if (skill) actor.activeDefense = { armor_amplifier: skill.armor_amplifier, magical_armor_amplifier: skill.magical_armor_amplifier };
  actor.statuses = [STATUS_LABELS.DEFENDING];
  log(battle, `${actor.name} is away and holds a defensive stance${skill?.name ? ` (${skill.name})` : ''}.`);
}

function releaseOfflinePartyMembers(battle) {
  for (const hero of battle?.party || []) {
    if (!hero.removeFromPartyAfterBattle || !hero.userId) continue;
    hero.removeFromPartyAfterBattle = false;
    leaveParty(hero.userId).catch((error) => console.warn('[releaseOfflinePartyMembers] Unable to remove offline member:', error.message));
  }
}

export async function markCombatantOffline(userId) {
  const battle = await getOrRestoreBattle(userId);
  if (!battle || battle.isTraining || battle.status !== BATTLE_STATUS.IN_PROGRESS) return false;
  const hero = (battle.party || []).find((unit) => unit.userId === userId);
  if (!hero || (battle.party || []).filter((unit) => unit.userId).length < 2) return false;
  hero.autoDefend = true;
  hero.removeFromPartyAfterBattle = true;
  log(battle, `${hero.name} lost connection and will hold a defensive stance until the battle ends.`);
  const ownerUserId = battle.party[0]?.userId || userId;
  if (battle.currentActorId === hero.id && !battle.isProcessingAction) {
    battle.isProcessingAction = true;
    try {
      runNpcTurns(battle);
      await finalizeBattle(ownerUserId, battle);
    } finally {
      battle.isProcessingAction = false;
    }
  }
  if (battle.status === BATTLE_STATUS.IN_PROGRESS) await persistBattleState(ownerUserId, battle);
  const partyUserIds = battle.party.map((unit) => unit.userId).filter(Boolean);
  broadcastToUsers(partyUserIds, WEBSOCKET_EVENTS.PARTY_COMBAT_UPDATE, { battleId: battle.id, currentActorId: battle.currentActorId, turnNumber: battle.turnNumber, status: battle.status, lastLog: battle.log.at(-1) });
  return true;
}

function runNpcTurns(battle) {
  while (battle.currentActorId && living(battle, 'party').length && living(battle, 'enemies').length) {
    const actor = [...battle.party, ...battle.enemies].find((unit) => unit.id === battle.currentActorId);
    if (!actor) break;
    if (actor.isPlayer || actor.id === 'player') {
      if (!actor.autoDefend) break;
      const autoStart = prepareTurnStart(battle, actor);
      if (!autoStart.skipped && !actor.isDefeated) autoDefendTurn(battle, actor);
      nextTurn(battle);
      continue;
    }

    const start = prepareTurnStart(battle, actor);
    if (start.skipped || actor.isDefeated || actor.isTrainingDummy) { nextTurn(battle); continue; }

    const enemies = actor.isEnemy ? living(battle, 'party') : living(battle, 'enemies');
    const allies = actor.isEnemy ? living(battle, 'enemies') : living(battle, 'party');

    const decision = chooseNpcAction(actor, enemies, allies, (attacker, defender, skill) => damage(attacker, defender, skill, true).total);
    if (!decision?.skill) { nextTurn(battle); continue; }
    if (decision.stateChanged) log(battle, `${actor.name} is now ${decision.state}.`);
    const skill = decision.skill;

    if (isTauntSkill(skill)) {
      const target = [...battle.party, ...battle.enemies].find((u) => u.id === decision.targetId) || enemies[0];
      const lock = applyTaunt(target, actor, skill, battle);
      log(battle, `${actor.name} used ${skill.name || 'Taunt'} on ${target.name} for ${lock?.turnsRemaining || DEFAULT_TAUNT_DURATION} turns.`);
    } else if (skill.type === SKILL_MENU_TYPE.DEFEND) {
      if (isDodgeSkill(skill)) delete actor.activeDefense;
      else actor.activeDefense = { armor_amplifier: skill.armor_amplifier, magical_armor_amplifier: skill.magical_armor_amplifier };
      actor.statuses = [...actor.statuses.filter((status) => status !== STATUS_LABELS.NORMAL), isDodgeSkill(skill) ? STATUS_LABELS.EVASIVE : STATUS_LABELS.DEFENDING];
      log(battle, `${actor.name} used ${skill.name}.`);
    } else if (skill.healing || skill.healing_current_hp) {
      const healBase = Number(skill.healing || skill.healing_current_hp || DEFAULT_SKILL_HEAL_AMOUNT);
      const target = [...battle.party, ...battle.enemies].find((u) => u.id === decision.targetId) || actor;
      const healed = Math.min(target.max_hp - target.current_hp, Math.floor(healBase * (1 + (actor.derived_stats?.spellAmp || 0) / 100)));
      target.current_hp += healed;
      log(battle, `${actor.name} cast ${skill.name} on ${target.name}, restoring ${healed} HP.`);
    } else {
      const target = [...battle.party, ...battle.enemies].find((u) => u.id === decision.targetId) || enemies[0];
      const result = damage(actor, target, skill);
      recordTrainingAttack(battle, target, result);
      applyDamage(target, result.total, actor, skill, battle);
      const statusResults = result.isMiss ? [] : applySkillEffects(actor, target, skill, battle);
      const critText = result.isCrit ? 'CRITICAL HIT! ' : '';
      log(battle, result.isEvaded ? `${target.name} evaded ${actor.name}'s ${skill.name || 'attack'}!` : result.isMiss ? `${actor.name} used ${skill.name || 'a skill'} on ${target.name}, but missed.` : `${critText}${actor.name} used ${skill.name || 'a skill'} on ${target.name} for ${result.total} damage${statusResults.length ? ` (${statusResults.map((status) => status.type).join(', ')})` : ''}.`);
    }
    completeNpcTurn(actor, skill);
    nextTurn(battle);
  }
}
export function getBattleForUser(userId) { return sessions.get(userId) || null; }
export async function getOrRestoreBattle(userId) {
  const cached = sessions.get(userId);
  if (cached) return cached;
  if (typeof prisma === 'undefined') return null;
  try {
    const record = await prisma.combat_sessions.findUnique({ where: { user_id: userId } });
    if (!record || record.status !== BATTLE_STATUS.IN_PROGRESS) return null;
    if (Date.now() - new Date(record.updated_at).getTime() > COMBAT_TTL_MS) {
      await prisma.combat_sessions.delete({ where: { user_id: userId } });
      await clearPersistedCombatStatuses(userId);
      return null;
    }
    const battle = record.battle_state;
    if (!battle || battle.status !== BATTLE_STATUS.IN_PROGRESS || !Array.isArray(battle.party) || !Array.isArray(battle.enemies)) return null;
    [...battle.party, ...battle.enemies].forEach((unit) => initializeStatusEffects(unit, unit.statusEffects));
    battle.enemies.forEach(initializeAggroState);
    battle.isProcessingAction = false;
    sessions.set(userId, battle);
    return battle;
  } catch (error) {
    throw databaseError('getOrRestoreBattle', 'restore battle', error);
  }
}

export async function assertNotInCombat(userId) {
  const activeBattle = await getOrRestoreBattle(userId);
  if (activeBattle?.status === BATTLE_STATUS.IN_PROGRESS) {
    const error = new Error('You cannot perform this action while engaged in combat.');
    error.statusCode = HTTP_STATUS.CONFLICT;
    error.inCombat = true;
    throw error;
  }
}

async function persistBattleState(userId, battle) {
  if (battle?.isTraining) return;
  if (typeof prisma === 'undefined' || typeof databaseError === 'undefined') return;
  try {
    const character = await prisma.characters.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!character) throw new Error('Character not found.');
    await persistBattleStatusEffects(character.id, battle);
    const snapshot = { ...battle, isProcessingAction: false };
    await prisma.combat_sessions.upsert({
      where: { user_id: userId },
      create: { user_id: userId, character_id: character.id, status: BATTLE_STATUS.IN_PROGRESS, battle_state: snapshot },
      update: { character_id: character.id, status: battle.status, battle_state: snapshot }
    });

    for (const hero of battle.party || []) {
      if (hero.userId && hero.userId !== userId && hero.characterId) {
        await prisma.combat_sessions.upsert({
          where: { user_id: hero.userId },
          create: { user_id: hero.userId, character_id: hero.characterId, status: BATTLE_STATUS.IN_PROGRESS, battle_state: snapshot },
          update: { character_id: hero.characterId, status: battle.status, battle_state: snapshot }
        }).catch(() => {});
      }
    }
  } catch (error) {
    throw databaseError('persistBattleState', 'persist battle', error);
  }
}

async function persistBattleStatusEffects(characterId, battle) {
  if (typeof prisma === 'undefined') return;
  const definitions = await prisma.effects.findMany({ where: { effect_type: { in: COMBAT_STATUS_TYPES }, deleted: false }, select: { id: true, effect_type: true } });
  const effectIds = definitions.map((effect) => effect.id);
  if (effectIds.length) await prisma.character_effects.updateMany({ where: { character_id: characterId, effect_id: { in: effectIds }, deleted: false }, data: { deleted: true } });
  const statuses = battle?.party?.[0]?.statusEffects || [];
  for (const status of statuses) {
    const definition = definitions.find((effect) => effect.effect_type === status.type);
    if (!definition || number(status.duration) <= 0) continue;
    await prisma.character_effects.upsert({
      where: { effect_id_character_id: { effect_id: definition.id, character_id: characterId } },
      create: { effect_id: definition.id, character_id: characterId, duration_turn: Math.floor(number(status.duration)), applied_value: Math.floor(number(status.value)), deleted: false },
      update: { duration_turn: Math.floor(number(status.duration)), applied_value: Math.floor(number(status.value)), deleted: false }
    });
  }
}

async function clearPersistedCombatStatuses(userId) {
  if (typeof prisma === 'undefined') return;
  try {
    const character = await prisma.characters.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!character) return;
    const definitions = await prisma.effects.findMany({ where: { effect_type: { in: COMBAT_STATUS_TYPES }, deleted: false }, select: { id: true } });
    const effectIds = definitions.map((effect) => effect.id);
    if (effectIds.length) await prisma.character_effects.updateMany({ where: { character_id: character.id, effect_id: { in: effectIds }, deleted: false }, data: { deleted: true } });
  } catch (error) {
    throw databaseError('clearPersistedCombatStatuses', 'clear combat status effects', error);
  }
}

async function clearPersistedBattle(userId, tx = null, party = []) {
  if (typeof prisma === 'undefined') return;
  try {
    const client = tx || prisma;
    await client.combat_sessions.deleteMany({ where: { user_id: userId } });
    for (const hero of party || []) {
      if (hero.userId && hero.userId !== userId) {
        await client.combat_sessions.deleteMany({ where: { user_id: hero.userId } }).catch(() => {});
        sessions.delete(hero.userId);
      }
    }
  } catch (error) {
    throw databaseError('clearPersistedBattle', 'clear battle session', error);
  }
}
export async function findMonsterByName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const cleanName = name.trim();
  try {
    const baseWhere = {
      character_type: CHARACTER_TYPE.NPC,
      deleted: false,
      npc: {
        is: {
          is_attackable: true,
          OR: [
            { npc_monsters: null },
            { npc_monsters: { is: { deleted: false } } }
          ]
        }
      }
    };

    const monsterInclude = {
      npc: {
        include: {
          npc_monsters: {
            include: {
              npcmonsters_lootgroups: {
                where: { deleted: false },
                include: {
                  loot_groups: {
                    include: {
                      items: {
                        where: { deleted: false },
                        include: { items: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      character_stat: true,
      effects: { where: { deleted: false, effect: { deleted: false } }, include: { effect: true } },
      skills: { where: { deleted: false }, include: { skill: { include: { skill_effects: { where: { deleted: false }, include: { effect: true } }, for_weapon_types: true } } } },
      character_items: { where: { deleted: false, location: ITEM_LOCATION.EQUIPPED }, include: characterItemInclude, orderBy: { id: 'asc' } }
    };

    let monster = await prisma.characters.findFirst({
      where: {
        ...baseWhere,
        name: cleanName
      },
      include: monsterInclude
    });

    if (!monster) {
      monster = await prisma.characters.findFirst({
        where: {
          ...baseWhere,
          name: { contains: cleanName }
        },
        include: monsterInclude
      });
    }

    if (monster) monster.character_equipment = buildEquipment(monster.character_items);
    return monster;
  } catch (error) {
    throw databaseError('findMonsterByName', 'read monster', error);
  }
}
export async function createEncounter(userId, characterSupplier, monsterNames) {
  try {
    const activeBattle = await getOrRestoreBattle(userId);
    if (activeBattle?.status === BATTLE_STATUS.IN_PROGRESS) return activeBattle;
    const names = Array.isArray(monsterNames) ? monsterNames : [monsterNames];
    if (!names.length || names.length > MAX_ENCOUNTER_ENEMIES) return { error: `An encounter must contain between 1 and ${MAX_ENCOUNTER_ENEMIES} enemies.` };
    const monsters = await Promise.all(names.map((name) => findMonsterByName(name)));
    if (monsters.some((monster) => !monster)) return { error: 'That monster could not be found.' };

    let partyCompanions = [];
    try {
      const partyData = await getPartyCombatants(userId);
      if (Array.isArray(partyData)) partyCompanions = partyData;
    } catch { /* Fallback to solo */ }

    const battle = makeBattle(await characterSupplier(), monsters, partyCompanions);
    sessions.set(userId, battle);
    for (const hero of battle.party) {
      if (hero.userId && hero.userId !== userId) {
        sessions.set(hero.userId, battle);
      }
    }
    log(battle, `Encounter created against ${battle.enemies.map((enemy) => enemy.name).join(', ')}. Initiative order: ${battle.turnQueue.map((unit) => `${unit.name} (${unit.initiative})`).join(', ')}.`);
    runNpcTurns(battle);
    await finalizeBattle(userId, battle);
    if (battle.status === BATTLE_STATUS.IN_PROGRESS) await persistBattleState(userId, battle);

    const partyUserIds = battle.party.map((h) => h.userId).filter(Boolean);
    if (partyUserIds.length > 1) {
      broadcastToUsers(partyUserIds, WEBSOCKET_EVENTS.PARTY_COMBAT_START, {
        battleId: battle.id,
        encounter: battle.encounter
      });
    }
    return battle;
  } catch (error) {
    throw databaseError('createEncounter', 'create battle', error);
  }
}

async function consumeBattleItemFromDatabase(userId, battle, itemId) {
  const targetItemId = Number(itemId);
  if (!Number.isInteger(targetItemId) || targetItemId <= 0) { const error = new Error('Invalid consumable item specified.'); error.name = ERROR_NAMES.BATTLE_RULE; throw error; }
  const player = battle.party[0];
  const result = await prisma.$transaction(async (tx) => {
    const character = await tx.characters.findUnique({
      where: { user_id: userId },
      include: {
        character_stat: true,
        player: { select: NSFW_PLAYER_SELECT },
        character_items: { where: { deleted: false, location: ITEM_LOCATION.BACKPACK }, include: characterItemInclude, orderBy: { id: 'asc' } }
      }
    });
    const entry = (character?.character_items || []).find((candidate) => candidate.item_id === targetItemId && candidate.items?.is_consumable && (!candidate.items?.is_nsfw || canAccessNsfw(character?.player)));
    const entryItem = entry ? toCharacterItemView(entry).item : null;
    if (!character || !character.character_stat || !entry || !entryItem || (entry.quantity || 0) < 1) { const error = new Error('Consumable item not found in your backpack.'); error.name = ERROR_NAMES.BATTLE_RULE; throw error; }
    const blockedReason = await consumeBonusBlockReason(tx, character.id, entry.items);
    if (blockedReason) { const error = new Error(blockedReason); error.name = ERROR_NAMES.BATTLE_RULE; throw error; }

    if (entry.quantity > 1) await tx.character_items.update({ where: { id: entry.id }, data: { quantity: { decrement: 1 } } });
    else await tx.character_items.update({ where: { id: entry.id }, data: { quantity: 0, deleted: true } });

    const stats = character.character_stat;
    const bonus = entryItem.item_bonus || {};
    const derived = calculateDerivedStats(stats, {});
    const maxHP = Math.max(1, number(player.max_hp, number(stats.max_hp, derived.maxHP)));
    const currentHP = clamp(number(player.current_hp, number(stats.current_hp, maxHP)), 0, maxHP);
    const healAmount = Math.max(0, number(bonus.healing_current_hp));
    const nextHP = Math.min(maxHP, currentHP + healAmount);
    const maxFood = Math.max(0, number(player.max_food, number(stats.max_food, DEFAULT_MAX_FOOD)));
    const maxWater = Math.max(0, number(player.max_water, number(stats.max_water, DEFAULT_MAX_WATER)));
    const currentFood = clamp(number(player.current_food, number(stats.current_food, maxFood)), 0, maxFood);
    const currentWater = clamp(number(player.current_water, number(stats.current_water, maxWater)), 0, maxWater);
    const nextFood = clamp(currentFood + number(bonus.current_food_bonus), 0, maxFood);
    const nextWater = clamp(currentWater + number(bonus.current_water_bonus), 0, maxWater);
    const maxEnergy = Math.max(0, number(player.max_energy, number(stats.max_energy, DEFAULT_MAX_ENERGY)));
    const currentEnergy = clamp(number(player.current_energy, number(stats.current_energy, maxEnergy)), 0, maxEnergy);
    const nextEnergy = clamp(currentEnergy + number(bonus.current_energy_bonus), 0, maxEnergy);
    const statUpdates = {};
    if (healAmount > 0) statUpdates.current_hp = nextHP;
    if (number(bonus.current_food_bonus) !== 0) statUpdates.current_food = nextFood;
    if (number(bonus.current_water_bonus) !== 0) statUpdates.current_water = nextWater;
    if (number(bonus.current_energy_bonus) !== 0) statUpdates.current_energy = nextEnergy;
    if (Object.keys(statUpdates).length) {
      const updatedStats = await tx.character_stats.update({ where: { id: stats.id }, data: statUpdates });
      if (statUpdates.current_food !== undefined) await syncHungerEffects(tx, character.id, updatedStats);
      if (statUpdates.current_water !== undefined) await syncThirstEffects(tx, character.id, updatedStats);
    }

    const cureType = String(bonus.cure_effect_type || CURE_EFFECT_NONE).toUpperCase();
    let cured = false;
    if (cureType !== CURE_EFFECT_NONE) {
      const activeEffects = await tx.character_effects.findMany({ where: { character_id: character.id, deleted: false }, include: { effect: true } });
      const effectIds = activeEffects.filter((effect) => effect.effect?.name?.toUpperCase() === cureType || effect.effect?.effect_type === cureType).map((effect) => effect.effect_id);
      if (effectIds.length) {
        await tx.character_effects.updateMany({ where: { character_id: character.id, effect_id: { in: effectIds }, deleted: false }, data: { deleted: true } });
        cured = true;
      }
    }
    const bonusResult = await applyConsumeBonus(tx, character.id, entry.items);
    if (bonusResult.changed) await syncStoredMaxHp(tx, character.id, calculateDerivedStats);
    return {
      itemId: targetItemId,
      bonusMessage: bonusResult.changed ? `${bonusResult.message} Stat bonuses take effect from your next battle.` : bonusResult.message,
      name: entryItem.name || 'Unknown item',
      healing: nextHP - currentHP,
      food: nextFood - currentFood,
      water: nextWater - currentWater,
      energy: nextEnergy - currentEnergy,
      cured,
      cureType,
      remaining: Math.max(0, number(entry.quantity, 1) - 1),
      bonus
    };
  });

  const inventoryItem = (battle.inventory || []).find((item) => item.item_id === result.itemId);
  if (inventoryItem) {
    inventoryItem.quantity = result.remaining;
    inventoryItem.item_bonus = result.bonus;
    if (inventoryItem.quantity <= 0) battle.inventory = battle.inventory.filter((item) => item !== inventoryItem);
  }
  player.current_hp = clamp(player.current_hp + result.healing, 0, player.max_hp);
  player.current_food = clamp(number(player.current_food, player.max_food) + result.food, 0, player.max_food);
  player.current_water = clamp(number(player.current_water, player.max_water) + result.water, 0, player.max_water);
  player.current_energy = clamp(number(player.current_energy, player.max_energy) + result.energy, 0, player.max_energy);
  refreshHungerStatus(player);
  refreshThirstStatus(player);
  const messages = [`${player.name} used ${result.name}.`];
  if (result.healing > 0) messages.push(`Restored ${result.healing} HP.`);
  if (result.food > 0) messages.push(`Restored ${result.food} Food.`);
  if (result.food < 0) messages.push(`Consumed ${Math.abs(result.food)} Food.`);
  if (result.water > 0) messages.push(`Restored ${result.water} Water.`);
  if (result.water < 0) messages.push(`Consumed ${Math.abs(result.water)} Water.`);
  if (result.energy > 0) messages.push(`Restored ${result.energy} Energy.`);
  if (result.cured) messages.push(`Cured ${result.cureType}.`);
  if (result.bonusMessage) messages.push(result.bonusMessage);
  log(battle, messages.join(' '));
  return { total: 0, item: result.name, healing: result.healing, food: result.food, water: result.water, energy: result.energy, cured: result.cured };
}

async function consumeBattleItem(userId, battle, itemId) {
  try {
    return await consumeBattleItemFromDatabase(userId, battle, itemId);
  } catch (error) {
    if (error.name === ERROR_NAMES.BATTLE_RULE) throw error;
    throw databaseError('consumeBattleItem', 'use consumable item in battle', error);
  }
}
async function persistBattleVitals(userId, battle) {
  const player = battle.party.find((unit) => unit.userId === userId) || battle.party.find((unit) => unit.isPlayer) || battle.party[0];
  if (!player) return;
  try {
    await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, select: { id: true, character_stat: { select: { id: true } } } });
      if (!character?.character_stat) return;
      await tx.character_stats.update({ where: { id: character.character_stat.id }, data: { current_hp: player.current_hp, current_energy: player.current_energy, current_food: player.current_food, current_water: player.current_water } });
      for (const slot of player.spell_points) {
        await tx.character_spellpoints.updateMany({ where: { character_id: character.id, level: slot.level, deleted: false }, data: { current: slot.current } });
      }
    });
  } catch (error) {
    throw databaseError('persistBattleVitals', 'persist battle vitals', error);
  }
}

export function rollLootForBattle(battle) {
  let totalGold = 0;
  const droppedItems = [];
  for (const enemy of battle.enemies) {
    for (const group of enemy.lootGroups || []) {
      const minGold = Math.max(0, number(group.min_gold, 0));
      const maxGold = Math.max(minGold, number(group.max_gold, 0));
      if (maxGold > 0) {
        const gold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
        totalGold += gold;
      }
      for (const entry of group.items || []) {
        const chance = number(entry.chance_pct, 0);
        const roll = Math.random() * MAX_LOOT_CHANCE_PCT;
        const itemObj = entry.items || entry.item;
        if (roll < chance && itemObj && !itemObj.deleted) {
          const minQty = Math.max(1, number(entry.min_quantity, 1));
          const maxQty = Math.max(minQty, number(entry.max_quantity, 1));
          const quantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
          droppedItems.push({
            item_id: itemObj.id,
            name: itemObj.name,
            type: itemObj.type,
            rarity: itemObj.rarity,
            loot_group_rarity: group.loot_group_rarity || LOOT_GROUP_RARITY.COMMON,
            quantity,
            monsterName: enemy.name
          });
        }
      }
    }
  }
  return { totalGold, droppedItems };
}

async function applyLootRewards(tx, userId, totalGold, droppedItems) {
  const character = await tx.characters.findUnique({
    where: { user_id: userId },
    select: { id: true, player: { select: NSFW_PLAYER_SELECT }, character_inventory: { select: { max_slots: true } }, character_items: { where: { deleted: false, location: ITEM_LOCATION.BACKPACK }, select: { id: true, item_id: true, quantity: true } } }
  });
  if (!character?.character_inventory) return { goldAdded: 0, items: [] };
  const nsfwAllowed = canAccessNsfw(character.player);

  if (totalGold > 0) {
    await tx.players.update({
      where: { character_id: character.id },
      data: { gold: { increment: totalGold } }
    });
  }

  const maxSlots = Math.max(1, number(character.character_inventory.max_slots, DEFAULT_BACKPACK_SLOTS));
  const currentItems = [...character.character_items];
  const processedDrops = [];

  for (const drop of droppedItems) {
    const itemDef = await tx.items.findUnique({
      where: { id: drop.item_id },
      select: { id: true, is_stackable: true, max_stack: true, is_nsfw: true }
    });
    if (!itemDef || (itemDef.is_nsfw && !nsfwAllowed)) continue;
    const maxStack = itemDef.is_stackable ? Math.max(1, number(itemDef.max_stack, 1)) : 1;
    let remaining = drop.quantity;

    const existingStacks = currentItems.filter((entry) => entry.item_id === drop.item_id);
    for (const stack of existingStacks) {
      if (remaining <= 0) break;
      const room = maxStack - stack.quantity;
      if (room > 0) {
        const added = Math.min(room, remaining);
        await tx.character_items.update({
          where: { id: stack.id },
          data: { quantity: { increment: added } }
        });
        stack.quantity += added;
        remaining -= added;
      }
    }

    let freeSlots = Math.max(0, maxSlots - currentItems.length);
    while (remaining > 0 && freeSlots > 0) {
      const quantityToAdd = Math.min(maxStack, remaining);
      const created = await tx.character_items.create({
        data: {
          character_id: character.id,
          item_id: drop.item_id,
          location: ITEM_LOCATION.BACKPACK,
          quantity: quantityToAdd
        }
      });
      currentItems.push({ id: created.id, item_id: drop.item_id, quantity: quantityToAdd });
      remaining -= quantityToAdd;
      freeSlots -= 1;
    }

    const added = drop.quantity - remaining;
    processedDrops.push({
      ...drop,
      added,
      overflow: remaining > 0,
      remaining
    });
  }

  return {
    goldAdded: totalGold,
    items: processedDrops
  };
}

export async function resolvePlayerDefeat(userId) {
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({
        where: { user_id: userId },
        include: {
          character_inventory: true,
          character_items: { where: { deleted: false, location: { in: CARRIED_LOCATIONS } }, include: { items: true }, orderBy: { id: 'asc' } },
          player: true
        }
      });
      if (!character || character.character_type !== CHARACTER_TYPE.PLAYER) return null;

      const lostGold = character.player?.gold || 0;
      const lostRows = character.character_items || [];
      const lostItems = lostRows.map((entry) => ({
        name: entry.items?.name || 'Unknown item',
        quantity: entry.quantity || 1
      }));
      const lostItemCount = lostItems.reduce((sum, item) => sum + item.quantity, 0);

      // 1. Wipe active backpack inventory
      await tx.character_items.updateMany({ where: { character_id: character.id, location: { in: CARRIED_LOCATIONS }, deleted: false }, data: { quantity: 0, deleted: true, equip_slot: null } });
      const lostEquipmentCount = lostRows.filter((entry) => entry.location === ITEM_LOCATION.EQUIPPED).length;

      // 3. Wipe carried gold
      if (character.player) {
        await tx.players.update({
          where: { character_id: character.id },
          data: { gold: 0 }
        });
      }

      await clearPersistedBattle(userId, tx);

      // 4. Reset location to respawn_location_id (fallback to 1)
      const respawnLocationId = character.respawn_location_id || DEFAULT_RESPAWN_LOCATION_ID;
      await tx.characters.update({
        where: { id: character.id },
        data: { location_id: respawnLocationId, sublocation_id: null }
      });

      const respawnStats = await tx.character_stats.update({
        where: { character_id: character.id },
        data: { ...RESPAWN_VITALS }
      });
      await syncHungerEffects(tx, character.id, respawnStats);
      await syncThirstEffects(tx, character.id, respawnStats);
      await clearTemporaryBonusTimes(tx, character.id);
      await syncStoredMaxHp(tx, character.id, calculateDerivedStats);

      const respawnLocation = await tx.locations.findUnique({
        where: { id: respawnLocationId },
        select: { id: true, name: true }
      });

      return {
        status: BATTLE_STATUS.DEFEAT,
        respawn_location: respawnLocation,
        lostGold,
        lostItemCount,
        lostEquipmentCount,
        lostItems
      };
    });
  } catch (error) {
    throw databaseError('resolvePlayerDefeat', 'resolve defeat penalty', error);
  }
}

export async function resolvePlayerVictory(userId, battle) {
  const player = battle.party[0];
  const defeatedEnemies = battle.enemies.map((enemy) => ({
    characterId: enemy.characterId,
    level: enemy.level,
    templateBaseLevel: enemy.templateBaseLevel ?? enemy.level,
    baseExp: enemy.baseExp,
    multiplier: enemy.multiplier
  }));

  // Persist vitals
  await persistBattleVitals(userId, battle);

  // Apply progression
  const gainedExp = calculateExpReward(defeatedEnemies);
  const progression = await applyLevelRewards(userId, gainedExp);

  // Roll loot drops and gold
  const { totalGold, droppedItems } = rollLootForBattle(battle);

  // Persist loot & gold in database
  const lootResult = await prisma.$transaction(async (tx) => {
    const result = await applyLootRewards(tx, userId, totalGold, droppedItems);
    await recordQuestEliminations(tx, player.characterId, defeatedEnemies.map((enemy) => enemy.characterId));
    await clearPersistedBattle(userId, tx);
    return result;
  });

  return {
    status: BATTLE_STATUS.VICTORY,
    experienceGained: progression?.gainedExp || 0,
    progression,
    goldGained: lootResult.goldAdded,
    lootDrops: lootResult.items
  };
}

async function finalizeBattle(userId, battle) {
  if (battle.isTraining) {
    if (battle.status !== BATTLE_STATUS.IN_PROGRESS) {
      sessions.delete(userId);
      return battle.result || { status: battle.status, training: true };
    }
    return null;
  }
  if (battle.status === BATTLE_STATUS.FLED) {
    await persistBattleVitals(userId, battle);
    await clearPersistedCombatStatuses(userId);
    await clearPersistedBattle(userId);
    sessions.delete(userId);
    releaseOfflinePartyMembers(battle);
    return battle.result || { status: BATTLE_STATUS.FLED };
  }
  if (battle.status !== BATTLE_STATUS.IN_PROGRESS) return null;
  const player = battle.party[0];
  if (!living(battle, 'party').length) {
    battle.status = BATTLE_STATUS.DEFEAT;
    finishUnit(player);
    const defeatResult = await resolvePlayerDefeat(userId);
    battle.result = {
      ...defeatResult,
      defeatedBy: battle.enemies.map((enemy) => enemy.name).filter(Boolean)
    };
    log(battle, `${player.name} was defeated. Respawned at ${defeatResult?.respawn_location?.name || 'safe zone'}. All equipment and inventory items were lost.`);
  } else if (!living(battle, 'enemies').length) {
    battle.status = BATTLE_STATUS.VICTORY;
    // Revive any knocked out companions
    for (const hero of battle.party) {
      if (hero.isCompanion && hero.isDefeated) {
        hero.isDefeated = false;
        hero.current_hp = Math.max(1, Math.floor(hero.max_hp * COMPANION_REVIVE_HP_RATIO));
        hero.statuses = [STATUS_LABELS.NORMAL];
      }
    }
    const victoryResult = await resolvePlayerVictory(userId, battle);
    battle.result = victoryResult;
    log(battle, `Victory! Earned ${victoryResult.experienceGained} EXP and ${victoryResult.goldGained} gold.`);
    for (const item of victoryResult.lootDrops || []) {
      if (item.overflow) {
        log(battle, `Dropped: ${item.quantity}x ${item.name} (${item.remaining} lost due to full inventory).`);
      } else {
        log(battle, `Dropped: ${item.quantity}x ${item.name}.`);
      }
    }
  }
  if (battle.status !== BATTLE_STATUS.IN_PROGRESS) {
    await clearPersistedCombatStatuses(userId);
    await clearPersistedBattle(userId, null, battle.party);
    sessions.delete(userId);
    for (const hero of battle.party || []) {
      if (hero.userId) sessions.delete(hero.userId);
    }
    releaseOfflinePartyMembers(battle);
  }
  return battle.result || { status: battle.status };
}

export async function performBattleAction(userId, input) {
  const battle = await getOrRestoreBattle(userId);
  if (!battle) throw new Error('Battle session not found.');
  if (battle.status !== BATTLE_STATUS.IN_PROGRESS) throw new Error('This battle has already ended.');
  
  const actingHero = battle.party.find((unit) => unit.id === battle.currentActorId);
  if (!actingHero) throw new Error('It is not a player turn.');
  if (actingHero.userId && actingHero.userId !== userId) {
    throw new Error(`It is ${actingHero.name}'s turn, please wait.`);
  }
  if (battle.isProcessingAction) { const error = new Error('A battle action is already being processed.'); error.statusCode = HTTP_STATUS.CONFLICT; throw error; }
  battle.isProcessingAction = true;
  try {
    battle.turnEvents = [];
    const player = actingHero;
    const start = prepareTurnStart(battle, player);
    if (start.skipped) {
      log(battle, `${player.name} is stunned and skips the turn.`);
      nextTurn(battle);
      runNpcTurns(battle);
      await finalizeBattle(userId, battle);
      if (battle.status === BATTLE_STATUS.IN_PROGRESS) await persistBattleState(userId, battle);
      return { battle, result: { total: 0, skipped: true } };
    }
    if (input?.action === BATTLE_ACTION_FLEE && battle.isTraining) {
      const stats = battle.training.stats;
      battle.status = BATTLE_STATUS.FLED;
      battle.result = { status: BATTLE_STATUS.FLED, training: true, message: 'You left the training grounds. Nothing was spent or earned.', summary: { totalDamage: stats.totalDamage, rounds: trainingRounds(battle), attacks: stats.attacks, hits: stats.hits, crits: stats.crits, missed: stats.missed, evaded: stats.evaded, highestHit: stats.highestHit } };
      log(battle, 'Training session ended.');
      await finalizeBattle(userId, battle);
      return { battle, result: battle.result };
    }
    if (input?.action === BATTLE_ACTION_FLEE) {
      const enemyDexterity = battle.enemies.length ? battle.enemies.reduce((total, enemy) => total + number(enemy.derived_stats?.dexterity ?? enemy.dex, BASE_ATTRIBUTE_VALUE), 0) / battle.enemies.length : BASE_ATTRIBUTE_VALUE;
      const fleeChance = clamp(FLEE_RULES.BASE_CHANCE + (number(player.derived_stats?.dexterity ?? player.dex, BASE_ATTRIBUTE_VALUE) - enemyDexterity) * FLEE_RULES.CHANCE_PER_DEXTERITY, FLEE_RULES.MIN_CHANCE, FLEE_RULES.MAX_CHANCE);
      if (Math.random() * 100 < fleeChance) {
        player.current_energy = Math.max(0, number(player.current_energy) - FLEE_RULES.ENERGY_COST);
        battle.status = BATTLE_STATUS.FLED;
        battle.result = { status: BATTLE_STATUS.FLED, energyConsumed: FLEE_RULES.ENERGY_COST, opponents: battle.enemies.map((enemy) => enemy.name).filter(Boolean), message: `You escaped the encounter after spending ${FLEE_RULES.ENERGY_COST} energy.` };
        log(battle, `You spent ${FLEE_RULES.ENERGY_COST} energy and escaped the encounter.`);
        await finalizeBattle(userId, battle);
        return { battle, result: battle.result, fleeChance };
      }
      log(battle, 'Escape failed!');
      nextTurn(battle);
      runNpcTurns(battle);
      await finalizeBattle(userId, battle);
      if (battle.status === BATTLE_STATUS.IN_PROGRESS) await persistBattleState(userId, battle);
      return { battle, result: { total: 0, escapeFailed: true }, fleeChance };
    }
    if (input?.itemId !== undefined && battle.isTraining) throw new Error('Items cannot be used during training.');
    if (input?.itemId !== undefined) {
      const result = await consumeBattleItem(userId, battle, input.itemId);
      nextTurn(battle);
      runNpcTurns(battle);
      await finalizeBattle(userId, battle);
      if (battle.status === BATTLE_STATUS.IN_PROGRESS) await persistBattleState(userId, battle);
      return { battle, result };
    }
    const skill = player.skills.find((entry) => String(entry.id) === String(input?.skillId));
    const target = [...battle.enemies, ...battle.party].find((unit) => unit.id === input?.targetId);
    if (!skill) throw new Error('Unknown battle skill.');
    if (skill.weapon_usable === false) throw new Error(`${skill.name || 'This skill'} requires ${weaponRequirementLabel(skill.weapon_types)}.`);
    let energyCost = Math.max(0, number(skill.energy_consume_cost));
    if (skill.type !== SKILL_MENU_TYPE.DEFEND && (!target || target.isDefeated)) throw new Error('A living target is required.');
    if (isTauntSkill(skill) && (!target || target.isDefeated || !target.isEnemy)) throw new Error('Taunt requires a living enemy target.');
    if (energyCost && player.current_energy < energyCost) throw new Error(`Not enough energy for ${skill.name}.`);
    let slot;
    if (skill.type === SKILL_MENU_TYPE.SPELL) { slot = player.spell_points.find((entry) => entry.level === number(input.spellPointLevel, skill.spellPointLevel)); if (!slot || slot.current < 1) throw new Error('The requested spell point is unavailable.'); }
    const hungerStats = battle.isTraining ? { current_food: player.current_food, max_food: player.max_food, current_water: player.current_water, max_water: player.max_water } : await refreshCharacterEffects(userId);
    if (!hungerStats) throw new Error('Character stats not found.');
    player.current_food = hungerStats.current_food;
    player.max_food = hungerStats.max_food;
    player.current_water = hungerStats.current_water;
    player.max_water = hungerStats.max_water;
    refreshHungerStatus(player);
    refreshThirstStatus(player);
    energyCost = skillEnergyCost(skill, player);
    if (player.current_energy < energyCost) throw new Error(`Not enough energy for ${skill.name}. Requires ${energyCost} energy.`);
    if (slot) slot.current -= 1;
    if (energyCost) player.current_energy -= energyCost;
    let result = { total: 0 };
    if (isTauntSkill(skill)) {
      const lock = applyTaunt(target, player, skill, battle);
      result = { total: 0, taunt: true, targetId: target.id, turnsRemaining: lock?.turnsRemaining || DEFAULT_TAUNT_DURATION };
      log(battle, `${player.name} used ${skill.name || 'Taunt'} on ${target.name} for ${result.turnsRemaining} turns.`);
    } else if (skill.type === SKILL_MENU_TYPE.DEFEND) {
      if (isDodgeSkill(skill)) delete player.activeDefense;
      else player.activeDefense = { armor_amplifier: skill.armor_amplifier, magical_armor_amplifier: skill.magical_armor_amplifier };
      player.statuses = [isDodgeSkill(skill) ? STATUS_LABELS.EVASIVE : STATUS_LABELS.DEFENDING];
      log(battle, `${player.name} used ${skill.name}.`);
    } else if (skill.healing || skill.healing_current_hp) {
      const healBase = Number(skill.healing || skill.healing_current_hp || DEFAULT_SKILL_HEAL_AMOUNT);
      const healTarget = target || player;
      const healed = Math.min(healTarget.max_hp - healTarget.current_hp, Math.floor(healBase * (1 + (player.derived_stats?.spellAmp || 0) / 100)));
      healTarget.current_hp += healed;
      result = { healing: healed, total: 0 };
      log(battle, `${player.name} restored ${healed} HP to ${healTarget.name}.`);
    } else {
      result = damage(player, target, skill);
      recordTrainingAttack(battle, target, result);
      applyDamage(target, result.total, player, skill, battle);
      const statusResults = result.isMiss ? [] : applySkillEffects(player, target, skill, battle);
      const critText = result.isCrit ? 'CRITICAL HIT! ' : '';
      log(battle, result.isEvaded ? `${target.name} evaded ${player.name}'s ${skill.name}!` : result.isMiss ? `${player.name} used ${skill.name} on ${target.name}, but missed.` : `${critText}${player.name} used ${skill.name} on ${target.name} for ${result.total} damage${statusResults.length ? ` (${statusResults.map((status) => status.type).join(', ')})` : ''}.`);
    }
    refreshHungerStatus(player);
    refreshThirstStatus(player);
    nextTurn(battle);
    runNpcTurns(battle);
    await finalizeBattle(userId, battle);
    if (battle.status === BATTLE_STATUS.IN_PROGRESS) await persistBattleState(userId, battle);

    const partyUserIds = battle.party.map((h) => h.userId).filter(Boolean);
    if (partyUserIds.length > 1) {
      broadcastToUsers(partyUserIds, WEBSOCKET_EVENTS.PARTY_COMBAT_UPDATE, {
        battleId: battle.id,
        currentActorId: battle.currentActorId,
        turnNumber: battle.turnNumber,
        status: battle.status,
        lastLog: battle.log.at(-1)
      });
    }
    return { battle, result };
  } finally {
    battle.isProcessingAction = false;
  }
}

function sanitizeTrainingConfig(input = {}, fallbackLevel = 1) {
  const whole = (value, min, max, fallback) => {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
  };
  const resists = Object.fromEntries(ELEMENTS.map((element) => [element, whole(input?.resists?.[element], ELEMENTAL_RESISTANCE_MIN, ELEMENTAL_RESISTANCE_MAX, 0)]));
  return {
    level: whole(input?.level, 1, MAX_LEVEL, clamp(Math.floor(number(fallbackLevel, 1)), 1, MAX_LEVEL)),
    hp: whole(input?.hp, 0, TRAINING_DUMMY.MAX_HP, 0),
    armor: whole(input?.armor, 0, TRAINING_DUMMY.MAX_DEFENSE, TRAINING_DUMMY.DEFAULT_ARMOR),
    magic_armor: whole(input?.magic_armor, 0, TRAINING_DUMMY.MAX_DEFENSE, TRAINING_DUMMY.DEFAULT_MAGIC_ARMOR),
    evade_chance: whole(input?.evade_chance, 0, EVADE_RULES.CAP_PCT, TRAINING_DUMMY.DEFAULT_EVADE),
    status_resist: whole(input?.status_resist, 0, TRAINING_DUMMY.MAX_DEFENSE, TRAINING_DUMMY.DEFAULT_STATUS_RESIST),
    resists
  };
}

function applyTrainingDummyConfig(dummy, config) {
  const infinite = config.hp <= 0;
  dummy.infiniteHp = infinite;
  dummy.max_hp = infinite ? TRAINING_DUMMY.INFINITE_HP : config.hp;
  dummy.current_hp = dummy.max_hp;
  dummy.level = config.level;
  dummy.templateBaseLevel = config.level;
  dummy.armor = config.armor;
  dummy.isDefeated = false;
  dummy.statusEffects = [];
  dummy.statuses = [STATUS_LABELS.NORMAL];
  const derived = { ...dummy.derived_stats, armor: config.armor, magicArmor: config.magic_armor, evadeChance: config.evade_chance, statusResist: config.status_resist };
  ELEMENTS.forEach((element) => { derived[`${element}Resist`] = config.resists[element]; });
  dummy.derived_stats = derived;
}

function trainingBattleFor(userId) {
  const battle = sessions.get(userId);
  if (!battle?.isTraining || battle.status !== BATTLE_STATUS.IN_PROGRESS) {
    const error = new Error('No training session is active.');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return battle;
}

export async function startTrainingBattle(userId, characterSupplier, rawConfig = {}) {
  const active = await getOrRestoreBattle(userId);
  if (active?.status === BATTLE_STATUS.IN_PROGRESS) {
    if (active.isTraining) return active;
    return { error: 'You are already in combat.' };
  }
  const character = await characterSupplier();
  if (!character) return { error: 'Character not found.' };
  if (!character.location?.is_safe_zone) return { error: 'Training dummies are only available in safe zones.' };
  let companions = [];
  try {
    const partyData = await getPartyCombatants(userId);
    if (Array.isArray(partyData)) companions = partyData.filter((member) => !(member.is_player || member.user_id));
  } catch { /* Train solo when the party cannot be loaded */ }

  const config = sanitizeTrainingConfig(rawConfig, character.level);
  const stub = { id: 0, name: TRAINING_DUMMY.NAME, level: config.level, templateBaseLevel: config.level, sprite: TRAINING_DUMMY.SPRITE, job: 'Training Dummy', character_stat: { max_hp: TRAINING_DUMMY.INFINITE_HP, current_hp: TRAINING_DUMMY.INFINITE_HP }, skills: [], effects: [], character_equipment: {} };
  const battle = makeBattle(character, [stub], companions);
  const dummy = battle.enemies[0];
  dummy.isTrainingDummy = true;
  dummy.sprite = TRAINING_DUMMY.SPRITE;
  dummy.job = 'Training Dummy';
  dummy.baseExp = 0;
  dummy.lootGroups = [];
  applyTrainingDummyConfig(dummy, config);
  battle.isTraining = true;
  battle.inventory = [];
  battle.encounter = { ...battle.encounter, id: 'training-dummy', type: 'training', monsterIds: [], monsterNames: [TRAINING_DUMMY.NAME], name: `${TRAINING_DUMMY.NAME} · Training`, level: config.level, description: 'Practice your damage on a training dummy. Nothing is spent or earned.' };
  battle.training = { config, stats: freshTrainingStats(battle) };
  sessions.set(userId, battle);
  log(battle, `Training started. ${TRAINING_DUMMY.NAME} (Lv ${config.level}) is ready. Nothing is spent or earned.`);
  runNpcTurns(battle);
  return battle;
}

export function updateTrainingDummy(userId, rawConfig = {}) {
  const battle = trainingBattleFor(userId);
  const dummy = battle.enemies.find((unit) => unit.isTrainingDummy);
  const config = sanitizeTrainingConfig({ ...battle.training.config, ...rawConfig, resists: { ...battle.training.config.resists, ...(rawConfig.resists || {}) } }, battle.training.config.level);
  applyTrainingDummyConfig(dummy, config);
  battle.training.config = config;
  battle.training.stats = freshTrainingStats(battle);
  log(battle, `${dummy.name} settings updated (Lv ${config.level}, ${config.hp > 0 ? `${config.hp} HP` : 'infinite HP'}, Armor ${config.armor}, M.Armor ${config.magic_armor}, Evade ${config.evade_chance}%). Counters reset.`);
  return battle;
}

export function resetTrainingStats(userId) {
  const battle = trainingBattleFor(userId);
  const dummy = battle.enemies.find((unit) => unit.isTrainingDummy);
  applyTrainingDummyConfig(dummy, battle.training.config);
  battle.party.forEach((unit) => {
    unit.current_energy = unit.max_energy;
    (unit.spell_points || []).forEach((slot) => { slot.current = slot.max_current; });
  });
  battle.training.stats = freshTrainingStats(battle);
  log(battle, 'Training counters reset. Energy and spell points restored.');
  return battle;
}
