import { databaseError } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { calculateDerivedStats, nextPointCost, getBattleForUser, createEncounter } from './core/battleSystemCore.js';
import { calculateBdoLifeSkillFormulas } from './core/lifeskillCore.js';
import { refreshCharacterEffects, syncHungerEffects, syncThirstEffects } from '../services/effectServices.js';
import { getHungerState, getThirstState } from './effectContainer.js';
import { characterItemInclude, EQUIP_SLOT_FIELDS, EQUIP_FIELD_SLOTS, projectCharacterItems, buildEquipment } from '../components/logics/characterItems.js';
import { adjustNpcPrice, getSublocationOwnerAffinity } from '../services/npcEconomyService.js';
import { applyConsumeBonus, bonusEquipmentFromRows, consumeBonusBlockReason, describeActiveBonusTimes, expireBonusTimes, itemBonusTimeInclude, loadBonusEquipment, syncStoredMaxHp } from '../services/itemBonusTimeService.js';
import { imageDataToBuffer, imageDataToUrl } from '../components/helpers/imageData.js';
import { canAccessNsfw, filterNsfw, isNsfwRecord } from '../services/nsfwAccessService.js';
import { closeLocationDialogueSessions } from './dialogueContainer.js';
import { getPartyFollowerBlock, movePartyWithLeader, notifyPartyMoved } from '../services/partyMovementService.js';

import {
  BASE_ATTRIBUTE_VALUE,
  BATTLE_STATUS,
  CHARACTER_TYPE,
  CURE_EFFECT_NONE,
  DEFAULT_BACKPACK_SLOTS,
  DEFAULT_MAX_FOOD,
  DEFAULT_MAX_HP,
  DEFAULT_MAX_WATER,
  DEFAULT_MAX_ENERGY,
  EQUIPMENT_ITEM_TYPES,
  EQUIP_SLOT,
  HAND_SLOTS,
  HOSTILE_AFFINITY,
  ITEM_LOCATION,
  ITEM_TYPE,
  MAX_HOSTILE_ENCOUNTER_NPCS,
  MAX_INT32,
  MEMORY_TTL_MS,
  MEMORY_TYPE,
  NPC_LOOKUP_LIMIT,
  SHOP_SELL_PRICE_PERCENT,
  SLOT_BY_ITEM_TYPE,
  SUBLOCATION_TYPE,
  TRADING_SUBLOCATION_TYPES,
  TRANSACTION_ISOLATION,
  UPGRADEABLE_STATS,
} from '../configs/constants.js';

const equipmentTypes = new Set(EQUIPMENT_ITEM_TYPES);
const handSlots = new Set(HAND_SLOTS);

function normalizeSlot(slot) {
  if (typeof slot !== 'string') return null;
  const clean = slot.trim().replace(/-/g, '_').replace(/_id$/, '').toUpperCase();
  return EQUIP_FIELD_SLOTS[clean] || (Object.prototype.hasOwnProperty.call(EQUIP_SLOT_FIELDS, clean) ? clean : null);
}

function itemRowsFor(character, location = null) {
  return (character?.character_items || []).filter((row) => !row.deleted && (!location || row.location === location));
}

function equipmentFromCharacter(character) { return buildEquipment(itemRowsFor(character, ITEM_LOCATION.EQUIPPED)); }

function visibleCharacterMemories(memories = []) {
  const now = Date.now();
  return memories.filter((memory) => {
    if (memory.is_secret || memory.memory_type === MEMORY_TYPE.SECRET) return false;
    const createdAt = memory.created_at ? new Date(memory.created_at).getTime() : now;
    const ttl = MEMORY_TTL_MS[memory.memory_type];
    return ttl === undefined || now - createdAt <= ttl;
  });
}

async function hostileNpcsAtSublocation(client, playerCharacterId, sublocationId) {
  const npcFilter = { deleted: false, is_attackable: true, npc_monsters: { is: null } };
  const [appearances, positionedNpcs] = await Promise.all([
    client.npcs_in_locations_or_sublocations.findMany({
      where: { sublocation_id: Number(sublocationId), deleted: false, npc: { is: npcFilter } },
      select: { npc_id: true, npc: { select: { character: { select: { id: true, name: true } } } } },
      take: NPC_LOOKUP_LIMIT
    }),
    client.characters.findMany({
      where: { sublocation_id: Number(sublocationId), deleted: false, character_type: CHARACTER_TYPE.NPC, npc: { is: npcFilter } },
      select: { id: true, name: true },
      take: NPC_LOOKUP_LIMIT
    })
  ]);
  const candidates = new Map();
  for (const row of appearances) {
    const character = row.npc?.character;
    if (character?.id) candidates.set(character.id, character);
  }
  for (const character of positionedNpcs) candidates.set(character.id, character);
  if (!candidates.size) return [];
  const relationships = await client.player_npc_relationships.findMany({
    where: { player_character_id: Number(playerCharacterId), npc_character_id: { in: [...candidates.keys()] }, deleted: false },
    select: { npc_character_id: true, affinity: true }
  });
  return relationships.filter((relationship) => Number(relationship.affinity) === HOSTILE_AFFINITY)
    .map((relationship) => candidates.get(relationship.npc_character_id))
    .filter(Boolean)
    .slice(0, MAX_HOSTILE_ENCOUNTER_NPCS);
}

async function getCharacterForMutation(client, userId, include = {}) {
  return client.characters.findUnique({
    where: { user_id: userId },
    include: {
      character_stat: true, player: true, character_inventory: true, vault: true, sublocation: true,
      character_items: { where: { deleted: false }, include: characterItemInclude, orderBy: { id: 'asc' } },
      ...include
    }
  });
}

export async function getCharacterSheet(userId) {
  if (typeof userId !== 'string' || !userId) return null;
  try {
    await refreshCharacterEffects(userId);
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      include: {
        character_stat: true,
        effects: { where: { deleted: false, effect: { deleted: false } }, include: { effect: true } },
        skills: { where: { deleted: false }, include: { skill: { include: { skill_effects: { where: { deleted: false }, include: { effect: true } }, for_weapon_types: true } } } },
        player: true, npc: { include: { npc_monsters: true } },
        character_spellpoints: { where: { deleted: false }, orderBy: { level: 'asc' } },
        character_lifeskills: { where: { deleted: false }, include: { lifeskill: true }, orderBy: { lifeskill_id: 'asc' } },
        character_owner_memories: { where: { deleted: false }, orderBy: { created_at: 'asc' } },
        character_inventory: true, vault: true,
        character_items: { where: { deleted: false }, include: characterItemInclude, orderBy: { id: 'asc' } },
        story: true,
        location: { include: { region: true, sublocations: { where: { deleted: false }, include: { sublocations_items: { where: { deleted: false }, include: { item: true } } }, orderBy: { id: 'asc' } } } },
        respawn_location: { include: { region: true } },
        sublocation: { include: { sublocations_items: { where: { deleted: false }, include: { item: true } } } },
        character_item_bonus_times: { where: { deleted: false }, include: itemBonusTimeInclude, orderBy: { id: 'asc' } }
      }
    });
    if (!character || character.deleted) return null;
    const bonusNow = new Date();
    const bonusTimes = character.character_item_bonus_times || [];
    if (bonusTimes.some((row) => !row.is_permanent && (!row.expires_at || new Date(row.expires_at) <= bonusNow))) {
      await prisma.$transaction(async (tx) => {
        await expireBonusTimes(tx, character.id, bonusNow);
        const synced = await syncStoredMaxHp(tx, character.id, calculateDerivedStats);
        if (synced) character.character_stat = { ...character.character_stat, max_hp: synced.max_hp, current_hp: synced.current_hp };
      });
    }
    character.bonus_equipment = bonusEquipmentFromRows(bonusTimes, bonusNow);
    character.active_item_bonuses = describeActiveBonusTimes(bonusTimes, bonusNow);
    delete character.character_item_bonus_times;
    character.image_data = imageDataToUrl(character.image_data);
    const nsfwAllowed = canAccessNsfw(character.player);
    character.nsfw_allowed = nsfwAllowed;
    character.character_owner_memories = filterNsfw(character.character_owner_memories, nsfwAllowed);
    character.character_memories = visibleCharacterMemories(character.character_owner_memories);
    const rawStats = character.character_stat || {};
    character.hunger = getHungerState(rawStats); character.thirst = getThirstState(rawStats);
    const statEquipment = buildEquipment(itemRowsFor(character, ITEM_LOCATION.EQUIPPED));
    projectCharacterItems(character, filterNsfw(character.character_items, nsfwAllowed, (row) => row.items));
    if (!nsfwAllowed) {
      const hideShopItems = (sublocation) => sublocation && { ...sublocation, sublocations_items: (sublocation.sublocations_items || []).filter((relation) => !isNsfwRecord(relation.item)) };
      if (character.sublocation) character.sublocation = hideShopItems(character.sublocation);
      if (character.location?.sublocations) character.location.sublocations = character.location.sublocations.map(hideShopItems);
    }
    const derived = calculateDerivedStats(rawStats, { ...statEquipment, ...character.bonus_equipment });
    character.character_stat = { ...rawStats, ...derived, base_stats: Object.fromEntries(UPGRADEABLE_STATS.map((key) => [key, rawStats[key]])) };
    character.character_lifeskills = (character.character_lifeskills || []).map((entry) => {
      const formulas = calculateBdoLifeSkillFormulas(entry.current_level);
      return {
        ...entry,
        bdo_rank: formulas.rank,
        bdo_mastery: formulas.mastery,
        uncommon_chance_pct: formulas.uncommonChancePct,
        rare_chance_pct: formulas.rareChancePct,
        legendary_chance_pct: formulas.legendaryChancePct,
        free_energy_chance_pct: formulas.freeEnergyChancePct,
        bonus_yield_chance_pct: formulas.bonusYieldChancePct,
        success_rate_bonus_pct: formulas.successRateBonusPct,
        next_level_exp: formulas.nextLevelExp
      };
    });
    return character;
  } catch (error) { throw databaseError('getCharacterSheet', 'read', error); }
}

export async function updateCharacterAvatar(userId, imageData) {
  try {
    const imageBuffer = imageDataToBuffer(imageData);
    const character = await prisma.characters.findUnique({ where: { user_id: userId }, select: { id: true, deleted: true } });
    if (!character || character.deleted) return null;
    const updated = await prisma.characters.update({ where: { id: character.id }, data: { image_data: imageBuffer }, select: { image_data: true } });
    return { image_data: imageDataToUrl(updated.image_data) };
  } catch (error) { throw databaseError('updateCharacterAvatar', 'update character avatar', error); }
}

export async function upgradeCharacterStat(userId, stat) {
  if (!UPGRADEABLE_STATS.includes(stat)) return { error: 'That attribute cannot be upgraded.' };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForMutation(tx, userId);
      if (!character || character.deleted || !character.character_stat || !character.player) return { error: 'Character not found.' };
      const current = Math.max(BASE_ATTRIBUTE_VALUE, Number(character.character_stat[stat] ?? BASE_ATTRIBUTE_VALUE)); const cost = nextPointCost(current);
      if (Number(character.player.current_point_spend ?? 0) < cost) return { error: `You need ${cost} point${cost === 1 ? '' : 's'} to upgrade ${stat}.` };
      const changed = await tx.character_stats.updateMany({ where: { id: character.character_stat.id, [stat]: current }, data: { [stat]: { increment: 1 } } });
      if (changed.count !== 1) return { error: 'The character changed before the upgrade completed. Please try again.' };
      await tx.players.update({ where: { character_id: character.id }, data: { current_point_spend: { decrement: cost } } });
      const updatedStats = { ...character.character_stat, [stat]: current + 1 }; const { maxHP } = calculateDerivedStats(updatedStats, { ...equipmentFromCharacter(character), ...await loadBonusEquipment(tx, character.id) });
      await tx.character_stats.update({ where: { id: character.character_stat.id }, data: { max_hp: maxHP } });
      return { stat, value: current + 1, cost };
    });
    if (result.error) return result; return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('upgradeCharacterStat', 'upgrade character stat', error); }
}

function chooseEquipSlot(character, item, requestedSlot) {
  const equipped = itemRowsFor(character, ITEM_LOCATION.EQUIPPED); const occupied = new Set(equipped.map((row) => row.equip_slot)); const requested = normalizeSlot(requestedSlot);
  if (item.type === ITEM_TYPE.TWO_HAND) {
    if (occupied.has(EQUIP_SLOT.LEFT_HAND)) return { error: 'Your main hand is occupied. You need to unequip it first.' };
    if (occupied.has(EQUIP_SLOT.RIGHT_HAND)) return { error: 'A two-handed weapon requires both hands. You need to unequip your off-hand item first.' };
    return { slot: EQUIP_SLOT.LEFT_HAND };
  }
  if (item.type === ITEM_TYPE.MAIN_HAND) {
    if (equipped.some((row) => row.equip_slot === EQUIP_SLOT.LEFT_HAND && row.items?.type === ITEM_TYPE.TWO_HAND)) return { error: 'You are already equipped with a two-handed weapon. You need to unequip it first.' };
    if (requested === EQUIP_SLOT.RIGHT_HAND && !occupied.has(EQUIP_SLOT.LEFT_HAND)) return { error: 'Equip a weapon to your main hand first.' };
    if (requested && handSlots.has(requested)) return occupied.has(requested) ? { error: 'That hand is occupied by a weapon. You need to unequip it first.' } : { slot: requested };
    if (!occupied.has(EQUIP_SLOT.LEFT_HAND)) return { slot: EQUIP_SLOT.LEFT_HAND }; if (!occupied.has(EQUIP_SLOT.RIGHT_HAND)) return { slot: EQUIP_SLOT.RIGHT_HAND };
    return { error: 'Both hands are occupied by weapons. You need to unequip first.' };
  }
  const pairedSlots = item.type === ITEM_TYPE.RING ? [EQUIP_SLOT.LEFT_RING, EQUIP_SLOT.RIGHT_RING, 'ring'] : item.type === ITEM_TYPE.EARRING ? [EQUIP_SLOT.LEFT_EARRING, EQUIP_SLOT.RIGHT_EARRING, 'earring'] : null;
  if (pairedSlots) {
    const [leftSlot, rightSlot, label] = pairedSlots;
    if (requested === leftSlot || requested === rightSlot) return occupied.has(requested) ? { error: `That ${label} slot is occupied. Unequip it first.` } : { slot: requested };
    if (!occupied.has(leftSlot)) return { slot: leftSlot };
    if (!occupied.has(rightSlot)) return { slot: rightSlot };
    return { error: `Both ${label} slots are occupied. Unequip one first.` };
  }
  const slot = SLOT_BY_ITEM_TYPE[item.type]; return slot ? (occupied.has(slot) ? { error: 'That equipment slot is occupied. Unequip it first.' } : { slot }) : { error: `Item type ${item.type} cannot be equipped.` };
}

async function refreshStatsAfterEquipmentChange(tx, character, rows) {
  if (!character.character_stat) return;
  const equipment = { ...buildEquipment(rows.filter((row) => !row.deleted && row.location === ITEM_LOCATION.EQUIPPED)), ...await loadBonusEquipment(tx, character.id) }; const { maxHP } = calculateDerivedStats(character.character_stat, equipment);
  await tx.character_stats.update({ where: { id: character.character_stat.id }, data: { max_hp: maxHP, current_hp: Math.min(Number(character.character_stat.current_hp ?? maxHP), maxHP) } });
}

export async function equipCharacterItem(userId, { itemId, slot } = {}) {
  const targetItemId = Number(itemId); if (!Number.isInteger(targetItemId) || targetItemId <= 0) return { error: 'Invalid item specified to equip.' };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForMutation(tx, userId); if (!character || character.deleted) return { error: 'Character not found.' };
      const entry = itemRowsFor(character, ITEM_LOCATION.BACKPACK).find((row) => row.item_id === targetItemId && row.items);
      if (!entry) return { error: 'Item not found in your backpack.' }; const item = entry.items;
      if (!equipmentTypes.has(item.type)) return { error: `Item type ${item.type} cannot be equipped.` };
      const chosen = chooseEquipSlot(character, item, slot); if (chosen.error) return chosen;
      await tx.character_items.update({ where: { id: entry.id }, data: { location: ITEM_LOCATION.EQUIPPED, equip_slot: chosen.slot, quantity: 1 } });
      const nextRows = character.character_items.map((row) => row.id === entry.id ? { ...row, location: ITEM_LOCATION.EQUIPPED, equip_slot: chosen.slot, quantity: 1 } : row);
      await refreshStatsAfterEquipmentChange(tx, character, nextRows); return { success: true, message: `Equipped ${item.name}.` };
    });
    if (result.error) return result; return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('equipCharacterItem', 'equip item', error); }
}

export async function unequipCharacterItem(userId, { slot, itemId } = {}) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForMutation(tx, userId); if (!character || character.deleted) return { error: 'Character not found.' };
      let targetSlot = normalizeSlot(slot); const equipped = itemRowsFor(character, ITEM_LOCATION.EQUIPPED);
      if (!targetSlot && itemId) targetSlot = equipped.find((row) => row.item_id === Number(itemId))?.equip_slot;
      const entry = equipped.find((row) => row.equip_slot === targetSlot && (!itemId || row.item_id === Number(itemId)));
      if (!targetSlot || !entry) return { error: 'No item is equipped in that slot.' };
      const backpackCount = itemRowsFor(character, ITEM_LOCATION.BACKPACK).length;
      if (backpackCount >= Number(character.character_inventory?.max_slots ?? DEFAULT_BACKPACK_SLOTS)) return { error: 'Your backpack is full.' };
      await tx.character_items.update({ where: { id: entry.id }, data: { location: ITEM_LOCATION.BACKPACK, equip_slot: null, quantity: 1 } });
      await refreshStatsAfterEquipmentChange(tx, character, character.character_items.map((row) => row.id === entry.id ? { ...row, location: ITEM_LOCATION.BACKPACK, equip_slot: null } : row));
      return { success: true, message: 'Item unequipped.' };
    });
    if (result.error) return result; return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('unequipCharacterItem', 'unequip item', error); }
}

async function learnFromSkillScroll(tx, character, entry) {
  const links = await tx.skills_in_items.findMany({ where: { item_id: entry.item_id, deleted: false, skill: { is: { deleted: false } } }, select: { skill: { select: { id: true, name: true } } } });
  const skills = links.map((link) => link.skill).filter(Boolean);
  if (!skills.length) return { error: `${entry.items.name} does not teach any skill.` };
  const known = await tx.character_skills.findMany({ where: { character_id: character.id, skill_id: { in: skills.map((skill) => skill.id) }, deleted: false }, select: { skill_id: true } });
  const knownIds = new Set(known.map((row) => row.skill_id));
  const toLearn = skills.filter((skill) => !knownIds.has(skill.id));
  if (!toLearn.length) return { error: `You already know ${skills.map((skill) => skill.name).join(', ')}.` };
  for (const skill of toLearn) {
    await tx.character_skills.upsert({
      where: { skill_id_character_id: { skill_id: skill.id, character_id: character.id } },
      create: { skill_id: skill.id, character_id: character.id },
      update: { deleted: false }
    });
  }
  const quantity = Number(entry.quantity || 1);
  await tx.character_items.update({ where: { id: entry.id }, data: quantity > 1 ? { quantity: { decrement: 1 } } : { quantity: 0, deleted: true } });
  return { success: true, message: `You studied ${entry.items.name} and learned ${toLearn.map((skill) => skill.name).join(', ')}.` };
}

export async function useCharacterConsumable(userId, { itemId } = {}) {
  const targetItemId = Number(itemId); if (!Number.isInteger(targetItemId) || targetItemId <= 0) return { error: 'Invalid consumable item specified.' };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForMutation(tx, userId); if (!character || character.deleted || !character.character_stat) return { error: 'Character not found.' };
      const scroll = itemRowsFor(character, ITEM_LOCATION.BACKPACK).find((row) => row.item_id === targetItemId && row.items?.type === ITEM_TYPE.SKILL_SCROLL && Number(row.quantity || 0) > 0);
      if (scroll) return learnFromSkillScroll(tx, character, scroll);
      const entry = itemRowsFor(character, ITEM_LOCATION.BACKPACK).find((row) => row.item_id === targetItemId && row.items?.is_consumable && Number(row.quantity || 0) > 0);
      if (!entry) return { error: 'Consumable item not found in your backpack.' };
      const blockedReason = await consumeBonusBlockReason(tx, character.id, entry.items); if (blockedReason) return { error: blockedReason };
      await expireBonusTimes(tx, character.id);
      const quantity = Number(entry.quantity || 1); await tx.character_items.update({ where: { id: entry.id }, data: quantity > 1 ? { quantity: { decrement: 1 } } : { quantity: 0, deleted: true } });
      const item = entry.items; const bonus = item.item_bonus || {}; const stats = character.character_stat; const derived = calculateDerivedStats(stats, { ...equipmentFromCharacter(character), ...await loadBonusEquipment(tx, character.id) });
      const maxHP = Math.max(1, Number(derived.maxHP || stats.max_hp || DEFAULT_MAX_HP)); const updates = {}; const messages = [];
      const healAmount = Math.max(0, Number(bonus.healing_current_hp || 0));
      if (healAmount > 0) { const current = Number(stats.current_hp ?? maxHP); const healed = Math.min(maxHP - current, healAmount); updates.current_hp = Math.min(maxHP, current + healAmount); messages.push(healed > 0 ? `Restored ${healed} HP.` : 'HP already at maximum.'); }
      for (const [field, label, maxField, defaultMax] of [['current_food', 'Food', 'max_food', DEFAULT_MAX_FOOD], ['current_water', 'Water', 'max_water', DEFAULT_MAX_WATER], ['current_energy', 'Energy', 'max_energy', DEFAULT_MAX_ENERGY]]) {
        const delta = Number(bonus[`${field}_bonus`] || 0); if (!delta) continue; const current = Number(stats[field] ?? stats[maxField] ?? defaultMax); const max = Number(stats[maxField] ?? defaultMax); const next = Math.max(0, Math.min(max, current + delta)); updates[field] = next; messages.push(delta > 0 ? (next > current ? `Restored ${next - current} ${label}.` : `${label} already full.`) : `Consumed ${Math.abs(delta)} ${label}.`);
      }
      if (Object.keys(updates).length) { const updated = await tx.character_stats.update({ where: { id: stats.id }, data: updates }); if (updates.current_food !== undefined) await syncHungerEffects(tx, character.id, updated); if (updates.current_water !== undefined) await syncThirstEffects(tx, character.id, updated); }
      let message = messages.length ? `Used ${item.name}. ${messages.join(' ')}` : `Used ${item.name}.`;
      if (bonus.cure_effect_type && bonus.cure_effect_type !== CURE_EFFECT_NONE) { const active = await tx.character_effects.findMany({ where: { character_id: character.id, deleted: false }, include: { effect: true } }); const cured = active.filter((effect) => effect.effect?.name?.toUpperCase() === bonus.cure_effect_type || effect.effect?.effect_type === bonus.cure_effect_type); if (cured.length) { await tx.character_effects.updateMany({ where: { character_id: character.id, effect_id: { in: cured.map((effect) => effect.effect_id) } }, data: { deleted: true } }); message += ` Cured ${bonus.cure_effect_type}.`; } }
      const bonusResult = await applyConsumeBonus(tx, character.id, item);
      if (bonusResult.message) message += ` ${bonusResult.message}`;
      if (bonusResult.changed) await syncStoredMaxHp(tx, character.id, calculateDerivedStats);
      return { success: true, message };
    });
    if (result.error) return result; return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('useCharacterConsumable', 'use consumable item', error); }
}

export async function enterSublocation(userId, sublocationId, dialogueChoice = null) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, include: { location: true } });
      if (!character || character.deleted) return { error: 'Character not found.' };
      const followerBlock = await getPartyFollowerBlock(tx, character.id);
      if (followerBlock) return { error: followerBlock };
      if (sublocationId === null || sublocationId === undefined || sublocationId === '') {
        await tx.characters.update({ where: { id: character.id }, data: { sublocation_id: null } });
        const dialogue = await closeLocationDialogueSessions(character.id, null, tx, { choice: dialogueChoice });
        const partyMove = await movePartyWithLeader(tx, character.id, { sublocationId: null });
        return { success: true, message: `Returned to ${character.location?.name || 'area'}.`, dialogue, partyMove };
      }
      const targetId = Number(sublocationId);
      const sublocation = await tx.sublocations.findFirst({ where: { id: targetId, deleted: false, location_id: character.location_id } });
      if (!sublocation) return { error: 'Sublocation not found in your current location.' };
      await tx.characters.update({ where: { id: character.id }, data: { sublocation_id: targetId } });
      const dialogue = await closeLocationDialogueSessions(character.id, targetId, tx, { choice: dialogueChoice });
      const partyMove = await movePartyWithLeader(tx, character.id, { sublocationId: targetId });
      return { success: true, message: `Entered ${sublocation.name}.`, characterId: character.id, sublocationId: targetId, dialogue, partyMove, placeName: sublocation.name };
    });
    if (result.error) return result;
    notifyPartyMoved(result.partyMove, { sublocationId: result.sublocationId || null, message: result.sublocationId ? `Your party leader led you into ${result.placeName}.` : 'Your party leader led you back outside.' });
    let encounter = null;
    if (result.sublocationId) {
      const hostileNpcs = await hostileNpcsAtSublocation(prisma, result.characterId, result.sublocationId);
      if (hostileNpcs.length) {
        const battle = await createEncounter(userId, () => getCharacterSheet(userId), hostileNpcs.map((npc) => npc.name));
        encounter = battle?.encounter || null;
      }
    }
    const response = { success: result.success, message: result.message, dialogue: result.dialogue };
    return { ...response, ...(encounter ? { encounter } : {}), character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('enterSublocation', 'enter sublocation', error); }
}
export async function takeInnLongRest(userId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, include: { sublocation: true, character_stat: true, player: true } });
      if (!character || character.deleted || !character.character_stat || !character.player) return { error: 'Character stats not found.' };
      const inn = character.sublocation;
      if (!inn || inn.deleted || inn.sublocation_type !== SUBLOCATION_TYPE.INN) return { error: 'You must be at an Inn to take a long rest.' };
      if (getBattleForUser(userId)?.status === BATTLE_STATUS.IN_PROGRESS) return { error: 'Finish your battle before taking a long rest.' };
      const owner = await getSublocationOwnerAffinity(tx, character.id, inn);
      if (owner.hostile) return { error: 'The innkeeper refuses service while hostile toward you.' };
      const cost = adjustNpcPrice(inn.long_rest_price, owner.affinity, true);
      if (cost === null) return { error: 'This Inn has an invalid long rest price.' };
      if (Number(character.player.gold || 0) < cost) return { error: `Not enough gold. Long rest costs ${cost} gold.` };
      await tx.character_stats.update({ where: { id: character.character_stat.id }, data: { current_hp: character.character_stat.max_hp, current_energy: character.character_stat.max_energy } });
      if (cost > 0) await tx.players.update({ where: { character_id: character.id }, data: { gold: { decrement: cost } } });
      return { success: true, cost, message: `Long rest complete for ${cost} gold. HP and energy fully restored.` };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
    if (result.error) return result;
    return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('takeInnLongRest', 'take a long rest', error); }
}

export async function fulfillInnFoodAndWater(userId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, include: { sublocation: true, character_stat: true, player: true } });
      if (!character || character.deleted || !character.character_stat || !character.player) return { error: 'Character stats not found.' };
      const inn = character.sublocation;
      if (!inn || inn.deleted || inn.sublocation_type !== SUBLOCATION_TYPE.INN) return { error: 'You must be at an Inn to restore food and water.' };
      if (getBattleForUser(userId)?.status === BATTLE_STATUS.IN_PROGRESS) return { error: 'Finish your battle before ordering food and water.' };
      const stats = character.character_stat;
      if (Number(stats.current_food) >= Number(stats.max_food) && Number(stats.current_water) >= Number(stats.max_water)) return { success: true, cost: 0, message: 'Food and water are already full.' };
      const owner = await getSublocationOwnerAffinity(tx, character.id, inn);
      if (owner.hostile) return { error: 'The innkeeper refuses service while hostile toward you.' };
      const cost = adjustNpcPrice(inn.food_water_refill_price, owner.affinity, true);
      if (cost === null) return { error: 'This Inn has an invalid food and water refill price.' };
      if (Number(character.player.gold || 0) < cost) return { error: `Not enough gold. Food and water service costs ${cost} gold.` };
      const updatedStats = await tx.character_stats.update({
        where: { id: stats.id },
        data: { current_food: stats.max_food, current_water: stats.max_water }
      });
      await syncHungerEffects(tx, character.id, updatedStats);
      await syncThirstEffects(tx, character.id, updatedStats);
      if (cost > 0) await tx.players.update({ where: { character_id: character.id }, data: { gold: { decrement: cost } } });
      return { success: true, cost, message: `Food and water restored for ${cost} gold.` };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
    if (result.error) return result;
    return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('fulfillInnFoodAndWater', 'restore food and water at an Inn', error); }
}
function validQuantity(value) { return Number.isSafeInteger(value) && value > 0 && value <= MAX_INT32; }

export async function sellShopItem(userId, { sublocationId, inventoryEntryId, quantity = 1 } = {}) {
  if (!validQuantity(quantity) || !validQuantity(inventoryEntryId)) return { error: 'Select an inventory item and a positive whole-number quantity.' };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForMutation(tx, userId); if (!character || character.deleted || !character.player) return { error: 'Character not found.' }; const shop = character.sublocation;
      if (!shop || shop.deleted || shop.id !== Number(sublocationId) || !TRADING_SUBLOCATION_TYPES.includes(shop.sublocation_type)) return { error: 'You must be in this shop/inn to sell items.' };
      const owner = await getSublocationOwnerAffinity(tx, character.id, shop);
      if (owner.hostile) return { error: 'The shopkeeper refuses service while hostile toward you.' };
      const entry = itemRowsFor(character, ITEM_LOCATION.BACKPACK).find((row) => row.id === inventoryEntryId); if (!entry?.items) return { error: 'Inventory item not found.' }; if (quantity > Number(entry.quantity || 1)) return { error: 'You do not own that many items in this stack.' };
      const price = Number(entry.items.price ?? 0); const total = Math.floor(price * SHOP_SELL_PRICE_PERCENT / 100) * quantity; const gold = Number(character.player.gold ?? 0); if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(total) || gold + total > MAX_INT32) return { error: 'This item has an invalid price.' };
      const remaining = Number(entry.quantity || 1) - quantity; await tx.character_items.update({ where: { id: entry.id }, data: { quantity: remaining, deleted: remaining === 0 } }); await tx.players.update({ where: { character_id: character.id }, data: { gold: gold + total } }); return { success: true, message: `Sold ×${quantity} ${entry.items.name} for ${total} gold.` };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
    if (result.error) return result; return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('sellShopItem', 'sell item to shop', error); }
}

export async function buyShopItem(userId, { sublocationId, itemId, quantity = 1 } = {}) {
  if (!validQuantity(quantity)) return { error: 'Quantity must be a positive whole number.' };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForMutation(tx, userId); if (!character || character.deleted || !character.player) return { error: 'Character not found.' };
      if (!character.sublocation || character.sublocation.id !== Number(sublocationId) || !TRADING_SUBLOCATION_TYPES.includes(character.sublocation.sublocation_type)) return { error: 'You are not in this shop/inn.' };
      const owner = await getSublocationOwnerAffinity(tx, character.id, character.sublocation);
      if (owner.hostile) return { error: 'The shopkeeper refuses to sell to you.' };
      const relation = await tx.sublocations_items.findFirst({ where: { sublocation_id: Number(sublocationId), item_id: Number(itemId), deleted: false }, include: { item: true } }); if (!relation?.item || relation.item.deleted || !relation.item.is_buyable || (isNsfwRecord(relation.item) && !canAccessNsfw(character.player))) return { error: 'This item is not available for purchase.' };
      const item = relation.item; const unitPrice = adjustNpcPrice(item.price, owner.affinity, false); const total = unitPrice * quantity; const gold = Number(character.player.gold ?? 0); if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || !Number.isSafeInteger(total)) return { error: 'This purchase has an invalid price.' }; if (gold < total) return { error: `Not enough gold. Requires ${total} gold, but you only have ${gold}.` };
      const backpack = itemRowsFor(character, ITEM_LOCATION.BACKPACK); const maxSlots = Math.max(1, Number(character.character_inventory?.max_slots ?? DEFAULT_BACKPACK_SLOTS)); const maxStack = item.is_stackable ? Math.max(1, Number(item.max_stack ?? 1)) : 1; let remaining = quantity; const stackUpdates = [];
      for (const entry of backpack.filter((row) => row.item_id === item.id && !row.prefix_id && !row.suffix_id && !row.current_level_upgraded && item.is_stackable)) { const added = Math.min(remaining, Math.max(0, maxStack - Number(entry.quantity || 1))); if (added) { stackUpdates.push({ id: entry.id, added }); remaining -= added; } if (!remaining) break; }
      if (Math.ceil(remaining / maxStack) > Math.max(0, maxSlots - backpack.length)) return { error: 'Not enough inventory space.' }; for (const update of stackUpdates) await tx.character_items.update({ where: { id: update.id }, data: { quantity: { increment: update.added } } }); while (remaining > 0) { const stack = Math.min(remaining, maxStack); await tx.character_items.create({ data: { character_id: character.id, item_id: item.id, location: ITEM_LOCATION.BACKPACK, quantity: stack } }); remaining -= stack; }
      await tx.players.update({ where: { character_id: character.id }, data: { gold: { decrement: total } } }); return { success: true, message: `Purchased ×${quantity} ${item.name} for ${total} gold.` };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
    if (result.error) return result; return { ...result, character: await getCharacterSheet(userId) };
  } catch (error) { throw databaseError('buyShopItem', 'buy item from shop', error); }
}
