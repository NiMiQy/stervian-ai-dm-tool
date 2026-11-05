import {
  BASIC_STRIKE_NAMES,
  DEFAULT_TACTICS_ROLE,
  NPC_AI_STATE,
  NPC_BASIC_ATTACK,
  NPC_BASIC_DEFENSE,
  NPC_COMBAT_AI,
  OFFENSIVE_SKILL_TYPES,
  SKILL_MENU_TYPE,
  SKILL_TARGET_RULE,
  TACTICS_ROLE,
  TAUNT_SKILL_NAME,
} from '../configs/constants.js';

const basicAttack = NPC_BASIC_ATTACK;
const basicDefense = NPC_BASIC_DEFENSE;
const pick = (entries, random) => entries[Math.floor(random() * entries.length)];
const isTauntSkill = (skill) => Boolean(skill?.is_taunt || skill?.taunt || String(skill?.name || '').trim().toUpperCase() === TAUNT_SKILL_NAME);

function predatorTarget(livingEnemies) {
  return livingEnemies.reduce((target, candidate) => {
    if (candidate.max_hp !== target.max_hp) return candidate.max_hp < target.max_hp ? candidate : target;
    if (candidate.current_hp !== target.current_hp) return candidate.current_hp < target.current_hp ? candidate : target;
    return String(candidate.id).localeCompare(String(target.id)) < 0 ? candidate : target;
  }, livingEnemies[0]);
}

function selectAggroTarget(actor, livingEnemies) {
  if (!actor?.isEnemy) return null;
  const lock = actor.tauntLock;
  if (lock?.turnsRemaining > 0) {
    const taunter = livingEnemies.find((unit) => unit.id === lock.targetId);
    if (taunter) return taunter;
  }

  const threatTable = actor.threatTable && typeof actor.threatTable === 'object' ? actor.threatTable : {};
  const threatValues = livingEnemies.map((unit) => ({ unit, threat: Number.isFinite(Number(threatTable[unit.id])) ? Number(threatTable[unit.id]) : 0 }));
  const highestThreat = Math.max(0, ...threatValues.map((entry) => entry.threat));
  const highest = threatValues.filter((entry) => entry.threat === highestThreat && highestThreat > 0).map((entry) => entry.unit);
  if (highest.length === 1) return highest[0];
  return predatorTarget(livingEnemies);
}

function memory(actor) {
  actor.combatAi ??= { state: null, cautiousTurns: 0, lastDefended: false };
  return actor.combatAi;
}

export function recordNpcDamage(actor, hpLost) {
  if (actor.id !== 'player' && hpLost > actor.max_hp * NPC_COMBAT_AI.CAUTIOUS_DAMAGE_RATIO) memory(actor).cautiousTurns = NPC_COMBAT_AI.CAUTIOUS_TURNS;
}

export function completeNpcTurn(actor, skill) {
  const ai = memory(actor);
  ai.cautiousTurns = Math.max(0, ai.cautiousTurns - 1);
  ai.lastDefended = skill.type === SKILL_MENU_TYPE.DEFEND;
}

/**
 * Selects a legal action for an NPC combatant (monster or companion ally).
 * Supports both legacy signature: (actor, singleTarget, estimateDamage, random)
 * and party signature: (actor, enemiesArray, alliesArray, estimateDamage, random)
 */
export function chooseNpcAction(actor, targetOrEnemies, alliesOrEstimate, maybeEstimate, maybeRandom) {
  if (!actor || actor.isDefeated || actor.current_hp <= 0) return null;

  let livingEnemies = [];
  let livingAllies = [];
  let estimateDamage = (attacker, defender, skill) => NPC_COMBAT_AI.FALLBACK_DAMAGE_ESTIMATE;
  let random = Math.random;

  if (Array.isArray(targetOrEnemies)) {
    livingEnemies = targetOrEnemies.filter((u) => u && !u.isDefeated && u.current_hp > 0);
    livingAllies = Array.isArray(alliesOrEstimate)
      ? alliesOrEstimate.filter((u) => u && !u.isDefeated && u.current_hp > 0)
      : [actor];
    if (typeof maybeEstimate === 'function') estimateDamage = maybeEstimate;
    if (typeof maybeRandom === 'function') random = maybeRandom;
  } else {
    // Legacy single target
    const target = targetOrEnemies;
    if (!target || target.isDefeated || target.current_hp <= 0) return null;
    livingEnemies = [target];
    livingAllies = [actor];
    if (typeof alliesOrEstimate === 'function') estimateDamage = alliesOrEstimate;
    if (typeof maybeEstimate === 'function') random = maybeEstimate;
  }

  if (!livingEnemies.length) return null;

  const ai = memory(actor);
  const previousState = ai.state;
  ai.state = actor.current_hp < actor.max_hp * NPC_COMBAT_AI.DESPERATE_HP_RATIO ? NPC_AI_STATE.DESPERATE : ai.cautiousTurns > 0 ? NPC_AI_STATE.CAUTIOUS : NPC_AI_STATE.AGGRESSIVE;

  const skills = (actor.skills || []).filter((s) => s && !s.deleted && s.weapon_usable !== false);
  const tacticsRole = String(actor.tactics_role || DEFAULT_TACTICS_ROLE).toUpperCase();

  // 1. Check for Support / Healing Skills (for Healers, Paladins, or companions)
  const healingSkills = skills.filter((s) =>
    (Number(s.healing) > 0 || Number(s.healing_current_hp) > 0) &&
    [SKILL_TARGET_RULE.SELF_ONLY, SKILL_TARGET_RULE.ON_SELECTED_ALLY, SKILL_TARGET_RULE.ALL_PARTY_MEMBERS, SKILL_TARGET_RULE.TO_ALL].includes(s.skill_target_rule || SKILL_TARGET_RULE.ON_SELECTED_ALLY)
  );

  if (healingSkills.length > 0 && livingAllies.length > 0) {
    // Find most injured ally
    const healThreshold = tacticsRole === TACTICS_ROLE.HEALER ? NPC_COMBAT_AI.HEALER_HEAL_THRESHOLD : NPC_COMBAT_AI.DEFAULT_HEAL_THRESHOLD;
    let mostInjured = null;
    let lowestPct = 1.0;

    for (const ally of livingAllies) {
      const pct = ally.current_hp / Math.max(1, ally.max_hp);
      if (pct < healThreshold && pct < lowestPct) {
        lowestPct = pct;
        mostInjured = ally;
      }
    }

    if (mostInjured) {
      const healSkill = pick(healingSkills, random);
      const targetId = healSkill.skill_target_rule === SKILL_TARGET_RULE.SELF_ONLY ? actor.id : mostInjured.id;
      return {
        skill: healSkill,
        targetId,
        state: ai.state,
        stateChanged: previousState !== ai.state
      };
    }
  }

  // 2. Select Target from Living Enemies
  let target = selectAggroTarget(actor, livingEnemies) || livingEnemies[0];
  if (livingEnemies.length > 1) {
    if (actor.isEnemy && selectAggroTarget(actor, livingEnemies)) {
      target = selectAggroTarget(actor, livingEnemies);
    } else if (tacticsRole === TACTICS_ROLE.AGGRESSIVE || ai.state === NPC_AI_STATE.DESPERATE) {
      // Focus down the enemy with lowest absolute HP
      target = livingEnemies.reduce((lowest, e) => (e.current_hp < lowest.current_hp ? e : lowest), livingEnemies[0]);
    } else if (tacticsRole === TACTICS_ROLE.TANK) {
      // Hit the highest max_hp or highest damage dealer
      target = livingEnemies.reduce((highest, e) => (e.max_hp > highest.max_hp ? e : highest), livingEnemies[0]);
    } else {
      // Balanced / Default: slight bias toward lowest HP (60%), else random
      target = random() < NPC_COMBAT_AI.BALANCED_FOCUS_LOWEST_CHANCE
        ? livingEnemies.reduce((lowest, e) => (e.current_hp < lowest.current_hp ? e : lowest), livingEnemies[0])
        : pick(livingEnemies, random);
    }
  }

  // 3. Tank / Defense Logic
  const defensiveSkills = skills.filter((entry) =>
    entry.type === SKILL_MENU_TYPE.DEFEND &&
    [undefined, null, SKILL_TARGET_RULE.SELF_ONLY, SKILL_TARGET_RULE.TO_ALL].includes(entry.skill_target_rule) &&
    (entry.armor_amplifier > 1 || entry.magical_armor_amplifier > 1)
  );

  const tauntSkills = skills.filter((entry) => isTauntSkill(entry) && entry.type === SKILL_MENU_TYPE.DEFEND && entry.skill_target_rule === SKILL_TARGET_RULE.ON_SELECTED_ENEMY);

  if (tacticsRole === TACTICS_ROLE.TANK && tauntSkills.length > 0 && livingEnemies.some((enemy) => enemy.tauntLock?.targetId !== actor.id)) {
    const skill = pick(tauntSkills, random);
    return { skill, targetId: target.id, state: ai.state, stateChanged: previousState !== ai.state };
  }

  if (tacticsRole === TACTICS_ROLE.TANK && defensiveSkills.length > 0 && !ai.lastDefended) {
    const allyInDanger = livingAllies.some((a) => a.id !== actor.id && a.current_hp / a.max_hp < NPC_COMBAT_AI.ALLY_DANGER_HP_RATIO);
    if (allyInDanger || actor.current_hp < actor.max_hp * NPC_COMBAT_AI.TANK_SELF_DEFEND_HP_RATIO) {
      const skill = pick(defensiveSkills, random);
      return { skill, targetId: actor.id, state: ai.state, stateChanged: previousState !== ai.state };
    }
  }

  // 4. Offensive Skill Selection
  const offensive = skills.filter((s) =>
    OFFENSIVE_SKILL_TYPES.includes(s.type) &&
    [undefined, null, SKILL_TARGET_RULE.ON_SELECTED_ENEMY, SKILL_TARGET_RULE.ALL_ENEMIES, SKILL_TARGET_RULE.TO_ALL].includes(s.skill_target_rule) &&
    !(Number(s.healing) > 0 || Number(s.healing_current_hp) > 0)
  );
  const basic = offensive.find((s) => BASIC_STRIKE_NAMES.includes(String(s.name).trim().toLowerCase())) || basicAttack;

  let skill;
  const roll = random();

  if (ai.state === NPC_AI_STATE.DESPERATE) {
    if (roll < NPC_COMBAT_AI.DESPERATE_BEST_SKILL_CHANCE && offensive.length) {
      const scored = offensive.map((entry) => ({ skill: entry, damage: estimateDamage(actor, target, entry) }));
      const best = Math.max(...scored.map((entry) => entry.damage));
      skill = pick(scored.filter((entry) => entry.damage === best), random).skill;
    } else skill = offensive.length ? pick(offensive, random) : basic;
  } else if (ai.state === NPC_AI_STATE.CAUTIOUS) {
    const total = ai.lastDefended ? NPC_COMBAT_AI.CAUTIOUS_AFTER_DEFEND_SCALE : 1;
    if (roll * total < NPC_COMBAT_AI.CAUTIOUS_BASIC_CHANCE) skill = basic;
    else if (roll * total < NPC_COMBAT_AI.CAUTIOUS_OFFENSIVE_CHANCE) skill = offensive.length ? pick(offensive, random) : basic;
    else {
      skill = defensiveSkills[0] || basicDefense;
    }
  } else {
    // Aggressive or Balanced
    skill = roll < NPC_COMBAT_AI.AGGRESSIVE_BASIC_CHANCE || !offensive.length ? basic : pick(offensive, random);
  }

  return {
    skill,
    targetId: skill.type === SKILL_MENU_TYPE.DEFEND && !isTauntSkill(skill) ? actor.id : target.id,
    state: ai.state,
    stateChanged: previousState !== ai.state
  };
}

export default {
  chooseNpcAction,
  completeNpcTurn,
  recordNpcDamage
};
