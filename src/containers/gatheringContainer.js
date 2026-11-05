import { databaseError, isTransactionConflict } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { characterItemInclude } from '../components/logics/characterItems.js';
import { canAccessNsfw, nsfwItemWhere } from '../services/nsfwAccessService.js';
import { calculateBdoLifeSkillFormulas, applyLifeSkillExpGain, rollBdoEnergyCost } from './core/lifeskillCore.js';
import { createEncounter } from './core/battleSystemCore.js';
import { getCharacterSheet } from './characterContainer.js';
import {
  AMBUSH_CHANCE,
  DEFAULT_BACKPACK_SLOTS,
  DEFAULT_MAX_ENERGY,
  ERROR_NAMES,
  GATHERING_BASE_EXP,
  GATHERING_ENERGY_COST,
  GATHERING_LEVEL_DROP_BONUS_PCT,
  GATHERING_RARE_BONUS_EXP,
  FISHING_LOOT_GROUP_SUFFIX,
  HTTP_STATUS,
  ITEM_LOCATION,
  LIFESKILL_DESCRIPTIONS,
  LIFESKILL_NAMES,
  LOOT_GROUP_RARITY,
  MAX_LOOT_CHANCE_PCT,
  RARE_LOOT_GROUP_RARITIES,
  STARTING_LOCATION,
  TRANSACTION_ISOLATION,
} from '../configs/constants.js';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

class GatheringRuleError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = ERROR_NAMES.GATHERING_RULE;
    this.statusCode = statusCode;
  }
}

class GatheringConflictError extends GatheringRuleError {
  constructor(message) {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = ERROR_NAMES.GATHERING_CONFLICT;
  }
}

export { isTransactionConflict };

export function calculateBdoGatheringFormulas(level) {
  return calculateBdoLifeSkillFormulas(level);
}

export function calculateEffectiveGroupChance(baseChancePct, level) {
  const activationChance = Math.max(0, number(baseChancePct, MAX_LOOT_CHANCE_PCT));
  const currentLevel = Math.max(1, number(level, 1));
  const effectiveChance = Math.min(MAX_LOOT_CHANCE_PCT, activationChance + (currentLevel - 1) * GATHERING_LEVEL_DROP_BONUS_PCT);
  return Math.round(effectiveChance * 100) / 100;
}

// Only loot groups explicitly linked to the location (admin-managed) can drop.
export function isFishingLootGroup(group) {
  return String(group?.name || '').trim().toLowerCase().endsWith(FISHING_LOOT_GROUP_SUFFIX.toLowerCase());
}

async function getLocationLootGroups(client, locationId, includeGroup = () => true, nsfwAllowed = false) {
  if (!locationId) return [];
  const links = await client.locations_lootgroups.findMany({
    where: { location_id: locationId, deleted: false, loot_groups: { is: { deleted: false } } },
    include: {
      loot_groups: {
        include: {
          items: {
            where: { deleted: false, ...(nsfwAllowed ? {} : { items: { is: nsfwItemWhere(false) } }) },
            include: { items: true },
            orderBy: { id: 'asc' }
          }
        }
      }
    },
    orderBy: { id: 'asc' }
  });
  const seen = new Set();
  const groups = [];
  for (const link of links) {
    if (!link.loot_groups || seen.has(link.loot_groups.id) || !includeGroup(link.loot_groups)) continue;
    seen.add(link.loot_groups.id);
    groups.push({ ...link.loot_groups, base_chance_pct: number(link.chance_pct, MAX_LOOT_CHANCE_PCT) });
  }
  return groups;
}

async function getCharacterForGathering(client, userId, lifeskillName = LIFESKILL_NAMES.GATHERING) {
  return client.characters.findUnique({
    where: { user_id: userId },
    include: {
      player: true,
      character_stat: true,
      character_inventory: true,
      location: true,
      character_lifeskills: {
        where: { deleted: false, lifeskill: { name: lifeskillName } },
        include: { lifeskill: true }
      },
      character_items: {
        where: { deleted: false, location: ITEM_LOCATION.BACKPACK },
        include: characterItemInclude,
        orderBy: { id: 'asc' }
      }
    }
  });
}

async function addGatheredItem(tx, character, item, amount, RuleError = GatheringRuleError) {
  const maxStack = item.is_stackable ? Math.max(1, number(item.max_stack, 1)) : 1;
  let remaining = amount;
  const rows = await tx.character_items.findMany({
    where: {
      character_id: character.id,
      item_id: item.id,
      location: ITEM_LOCATION.BACKPACK,
      deleted: false,
      prefix_id: null,
      suffix_id: null,
      current_level_upgraded: 0
    },
    orderBy: { id: 'asc' }
  });

  for (const row of rows) {
    const spaceInStack = Math.max(0, maxStack - number(row.quantity, 1));
    const added = Math.min(remaining, spaceInStack);
    if (added > 0) {
      await tx.character_items.update({
        where: { id: row.id },
        data: { quantity: { increment: added } }
      });
      remaining -= added;
    }
    if (remaining <= 0) break;
  }

  const currentUsedSlots = await tx.character_items.count({
    where: { character_id: character.id, location: ITEM_LOCATION.BACKPACK, deleted: false }
  });
  const maxSlots = Math.max(0, number(character.character_inventory?.max_slots, DEFAULT_BACKPACK_SLOTS));
  const slotsNeeded = Math.ceil(remaining / maxStack);

  if (slotsNeeded > (maxSlots - currentUsedSlots)) {
    throw new RuleError('Your backpack is full. Please make space in your inventory.');
  }

  while (remaining > 0) {
    const quantity = Math.min(remaining, maxStack);
    await tx.character_items.create({
      data: {
        character_id: character.id,
        item_id: item.id,
        location: ITEM_LOCATION.BACKPACK,
        quantity
      }
    });
    remaining -= quantity;
  }
}

export const GATHERING_PROFILE = Object.freeze({
  lifeskillName: LIFESKILL_NAMES.GATHERING,
  lifeskillDescription: LIFESKILL_DESCRIPTIONS.GATHERING,
  energyCost: GATHERING_ENERGY_COST,
  baseExp: GATHERING_BASE_EXP,
  rareBonusExp: GATHERING_RARE_BONUS_EXP,
  includeGroup: (group) => !isFishingLootGroup(group),
  requireLootGroups: false,
  noLootGroupsMessage: '',
  noEnergyMessage: 'You do not have enough energy to gather.',
  energyChangedMessage: 'Your energy changed before gathering completed. Please try again.',
  RuleError: GatheringRuleError,
  ConflictError: GatheringConflictError,
  dataOperation: ['getGatheringData', 'retrieve gathering data'],
  actionOperation: ['executeGather', 'execute gathering action']
});

export function getGatheringData(userId) {
  return getHarvestData(userId, GATHERING_PROFILE);
}

export async function getHarvestData(userId, profile) {
  const { RuleError } = profile;
  try {
    const character = await getCharacterForGathering(prisma, userId, profile.lifeskillName);
    if (!character || character.deleted) throw new RuleError('Character not found.');

    const gatheringLsRecord = character.character_lifeskills[0] || null;
    const currentLevel = number(gatheringLsRecord?.current_level, 1);
    const currentExp = number(gatheringLsRecord?.current_exp, 0);
    const formulas = calculateBdoGatheringFormulas(currentLevel);

    const locationName = character.location?.name;
    const isHoneywood = locationName === STARTING_LOCATION.name;
    const lootGroups = await getLocationLootGroups(prisma, character.location_id, profile.includeGroup, canAccessNsfw(character.player));

    const formattedLootGroups = lootGroups.map((group) => {
      const rarity = group.loot_group_rarity || LOOT_GROUP_RARITY.COMMON;
      const isRareGroup = RARE_LOOT_GROUP_RARITIES.includes(rarity);
      const activationChance = calculateEffectiveGroupChance(group.base_chance_pct, currentLevel);
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        loot_group_rarity: rarity,
        is_rare: isRareGroup,
        min_gold: number(group.min_gold, 0),
        max_gold: number(group.max_gold, 0),
        activation_chance_pct: activationChance,
        items: group.items.map((entry) => ({
          item_id: entry.item_id,
          name: entry.items?.name || 'Unknown item',
          chance_pct: entry.chance_pct,
          min_quantity: entry.min_quantity,
          max_quantity: entry.max_quantity,
          description: entry.items?.description || ''
        }))
      };
    });

    const usedSlots = character.character_items.length;
    const maxSlots = Math.max(0, number(character.character_inventory?.max_slots, DEFAULT_BACKPACK_SLOTS));

    return {
      character: {
        id: character.id,
        name: character.name,
        location_id: character.location_id,
        location_name: character.location?.name || 'Unknown Location',
        is_honeywood: isHoneywood,
        gold: number(character.player?.gold, 0),
        current_energy: number(character.character_stat?.current_energy, 0),
        max_energy: number(character.character_stat?.max_energy, DEFAULT_MAX_ENERGY),
        used_slots: usedSlots,
        max_slots: maxSlots
      },
      lifeskill: {
        level: currentLevel,
        current_exp: currentExp,
        next_level_exp: formulas.nextLevelExp,
        rank: formulas.rank,
        mastery: formulas.mastery,
        drop_bonus_pct: calculateEffectiveGroupChance(0, currentLevel),
        free_gather_chance_pct: formulas.freeGatherChancePct
      },
      loot_groups: formattedLootGroups
    };
  } catch (error) {
    if (error instanceof RuleError) throw error;
    throw databaseError(profile.dataOperation[0], profile.dataOperation[1], error);
  }
}

const ambushEnergySpent = new Map();

export function resetAmbushChance(characterId) {
  ambushEnergySpent.delete(Number(characterId));
}

export function calculateAmbushChancePct(energySpent) {
  const spent = Math.max(0, Number(energySpent) || 0);
  if (spent < 1) return AMBUSH_CHANCE.basePct;
  return Math.min(AMBUSH_CHANCE.capPct, AMBUSH_CHANCE.basePct + (spent - 1) * AMBUSH_CHANCE.perEnergyPct);
}

async function findAreaMonsterNames(client, locationId, sublocationId) {
  if (!locationId && !sublocationId) return [];
  const appearances = await client.npcs_in_locations_or_sublocations.findMany({
    where: {
      deleted: false,
      OR: [
        ...(sublocationId ? [{ sublocation_id: sublocationId }] : []),
        ...(locationId ? [{ location_id: locationId }, { sublocation: { is: { location_id: locationId } } }] : [])
      ],
      npc: { is: { deleted: false, is_attackable: true, npc_monsters: { is: { deleted: false } }, character: { is: { deleted: false } } } }
    },
    include: { npc: { include: { character: { select: { name: true } } } } }
  });
  return [...new Set(appearances.map((entry) => entry.npc?.character?.name).filter(Boolean))];
}

export function executeGather(userId) {
  return executeHarvest(userId, GATHERING_PROFILE);
}

export async function executeHarvest(userId, profile) {
  const { RuleError, ConflictError } = profile;
  let pendingAmbushSpent = null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForGathering(tx, userId, profile.lifeskillName);
      if (!character || character.deleted || !character.player || !character.character_stat) {
        throw new RuleError('Character not found.');
      }

      const currentEnergy = number(character.character_stat.current_energy, 0);
      if (currentEnergy < profile.energyCost) {
        throw new RuleError(profile.noEnergyMessage);
      }

      const lootGroups = await getLocationLootGroups(tx, character.location_id, profile.includeGroup, canAccessNsfw(character.player));
      if (profile.requireLootGroups && lootGroups.length === 0) {
        throw new RuleError(profile.noLootGroupsMessage);
      }

      let gatheringLifeskill = await tx.lifeskills.findFirst({ where: { name: profile.lifeskillName } });
      if (!gatheringLifeskill) {
        gatheringLifeskill = await tx.lifeskills.create({
          data: { name: profile.lifeskillName, description: profile.lifeskillDescription }
        });
      }

      let charLs = character.character_lifeskills[0];
      if (!charLs) {
        charLs = await tx.character_lifeskills.create({
          data: {
            character_id: character.id,
            lifeskill_id: gatheringLifeskill.id,
            current_level: 1,
            current_exp: 0
          }
        });
      }

      const currentLevel = number(charLs.current_level, 1);
      const currentExp = number(charLs.current_exp, 0);
      const formulas = calculateBdoGatheringFormulas(currentLevel);

      const isFreeGather = Math.random() < (formulas.freeGatherChancePct / 100);
      let energyConsumed = 0;
      if (!isFreeGather) {
        const energyUpdate = await tx.character_stats.updateMany({
          where: { id: character.character_stat.id, current_energy: { gte: profile.energyCost } },
          data: { current_energy: { decrement: profile.energyCost } }
        });
        if (energyUpdate.count !== 1) {
          throw new RuleError(profile.energyChangedMessage);
        }
        energyConsumed = profile.energyCost;
      }

      const gatheredItems = [];
      let totalGoldWon = 0;
      let rareProc = false;

      for (const group of lootGroups) {
        const rarity = group.loot_group_rarity || LOOT_GROUP_RARITY.COMMON;
        const isRareGroup = RARE_LOOT_GROUP_RARITIES.includes(rarity);
        const effectiveChance = calculateEffectiveGroupChance(group.base_chance_pct, currentLevel);
        const activates = effectiveChance >= MAX_LOOT_CHANCE_PCT || Math.random() * MAX_LOOT_CHANCE_PCT < effectiveChance;
        if (!activates) continue;
        if (rarity === LOOT_GROUP_RARITY.RARE || rarity === LOOT_GROUP_RARITY.LEGENDARY) rareProc = true;

        if (group.min_gold != null && group.max_gold != null && group.max_gold >= group.min_gold && group.max_gold > 0) {
          const goldAmount = Math.floor(Math.random() * (group.max_gold - group.min_gold + 1)) + group.min_gold;
          totalGoldWon += goldAmount;
        }

        for (const entry of group.items) {
          if (!entry.items) continue;
          const roll = Math.random() * MAX_LOOT_CHANCE_PCT;
          if (roll <= entry.chance_pct) {
            const minQty = Math.max(1, number(entry.min_quantity, 1));
            const maxQty = Math.max(minQty, number(entry.max_quantity, minQty));
            const quantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
            gatheredItems.push({ item: entry.items, quantity, is_rare: isRareGroup, rarity });
          }
        }
      }

      for (const drop of gatheredItems) {
        await addGatheredItem(tx, character, drop.item, drop.quantity, RuleError);
      }

      if (totalGoldWon > 0) {
        await tx.players.update({
          where: { character_id: character.id },
          data: { gold: { increment: totalGoldWon } }
        });
      }

      const expGained = profile.baseExp + (rareProc ? profile.rareBonusExp : 0);
      const expResult = applyLifeSkillExpGain(currentLevel, currentExp, expGained);

      await tx.character_lifeskills.update({
        where: {
          character_id_lifeskill_id: {
            character_id: character.id,
            lifeskill_id: gatheringLifeskill.id
          }
        },
        data: {
          current_level: expResult.newLevel,
          current_exp: expResult.newExp
        }
      });

      let ambush = null;
      if (character.location && !character.location.is_safe_zone) {
        const energySpent = number(ambushEnergySpent.get(character.id), 0) + energyConsumed;
        const ambushChancePct = calculateAmbushChancePct(energySpent);
        const monsterNames = Math.random() < (ambushChancePct / 100) ? await findAreaMonsterNames(tx, character.location_id, character.sublocation_id) : [];
        if (monsterNames.length) {
          ambush = { monster_name: monsterNames[Math.floor(Math.random() * monsterNames.length)], chance_pct: ambushChancePct };
          ambush.character_id = character.id;
        } else {
          ambush = null;
          pendingAmbushSpent = { characterId: character.id, energySpent };
        }
      }

      const finalStat = await tx.character_stats.findUnique({ where: { id: character.character_stat.id } });
      const finalPlayer = await tx.players.findUnique({ where: { character_id: character.id } });
      const finalUsedSlots = await tx.character_items.count({
        where: { character_id: character.id, location: ITEM_LOCATION.BACKPACK, deleted: false }
      });
      const maxSlots = Math.max(0, number(character.character_inventory?.max_slots, DEFAULT_BACKPACK_SLOTS));
      const nextFormulas = calculateBdoGatheringFormulas(expResult.newLevel);

      return {
        success: true,
        gathered_items: gatheredItems.map((g) => ({
          id: g.item.id,
          name: g.item.name,
          quantity: g.quantity,
          is_rare: g.is_rare,
          rarity: g.rarity
        })),
        gold_gained: totalGoldWon,
        exp_gained: expGained,
        rare_proc: rareProc,
        is_free_gather: isFreeGather,
        energy_consumed: energyConsumed,
        ambush,
        ambush_chance_pct: character.location && !character.location.is_safe_zone ? calculateAmbushChancePct((pendingAmbushSpent?.energySpent ?? 0) + 1) : 0,
        leveled_up: expResult.leveledUp,
        lifeskill: {
          level: expResult.newLevel,
          current_exp: expResult.newExp,
          next_level_exp: nextFormulas.nextLevelExp,
          rank: nextFormulas.rank,
          mastery: nextFormulas.mastery,
          drop_bonus_pct: calculateEffectiveGroupChance(0, expResult.newLevel),
          free_gather_chance_pct: nextFormulas.freeEnergyChancePct
        },
        character: {
          current_energy: number(finalStat?.current_energy, 0),
          max_energy: number(finalStat?.max_energy, DEFAULT_MAX_ENERGY),
          gold: number(finalPlayer?.gold, 0),
          used_slots: finalUsedSlots,
          max_slots: maxSlots
        }
      };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });

    if (pendingAmbushSpent) ambushEnergySpent.set(pendingAmbushSpent.characterId, pendingAmbushSpent.energySpent);
    if (result.ambush) {
      resetAmbushChance(result.ambush.character_id);
      delete result.ambush.character_id;
      const battle = await createEncounter(userId, () => getCharacterSheet(userId), [result.ambush.monster_name]);
      result.ambush.started = Boolean(battle && !battle.error);
      if (battle?.error) result.ambush.error = battle.error;
    }
    return result;
  } catch (error) {
    if (error instanceof RuleError) throw error;
    if (isTransactionConflict(error)) {
      throw new ConflictError('Another action modified your character resources. Please try again.');
    }
    throw databaseError(profile.actionOperation[0], profile.actionOperation[1], error);
  }
}

export { GatheringConflictError, GatheringRuleError };
