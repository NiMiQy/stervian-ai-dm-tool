import { databaseError, isTransactionConflict } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { characterItemInclude } from '../components/logics/characterItems.js';
import { canAccessNsfw, nsfwItemWhere, recipeHasNsfw } from '../services/nsfwAccessService.js';
import { calculateBdoLifeSkillFormulas, applyLifeSkillExpGain, rollBdoCraftingYield } from './core/lifeskillCore.js';
import {
  DEFAULT_BACKPACK_SLOTS,
  DEFAULT_FARMING_ENERGY_COST,
  DEFAULT_FARMING_EXP_REWARD,
  DEFAULT_MAX_ENERGY,
  DEFAULT_RECIPE_DURATION_SECONDS,
  DEFAULT_SEED_PRICE,
  ERROR_NAMES,
  HTTP_STATUS,
  ITEM_LOCATION,
  LIFESKILL_DESCRIPTIONS,
  LIFESKILL_NAMES,
  MAX_SEED_PURCHASE_QUANTITY,
  TRANSACTION_ISOLATION,
} from '../configs/constants.js';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

class FarmingRuleError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = ERROR_NAMES.FARMING_RULE;
    this.statusCode = statusCode;
  }
}

class FarmingConflictError extends FarmingRuleError {
  constructor(message) {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = ERROR_NAMES.FARMING_CONFLICT;
  }
}

export { isTransactionConflict };

export function calculateBdoFarmingFormulas(level) {
  return calculateBdoLifeSkillFormulas(level);
}

async function getCharacterForFarming(client, userId) {
  return client.characters.findUnique({
    where: { user_id: userId },
    include: {
      player: true,
      character_stat: true,
      character_inventory: true,
      location: true,
      character_lifeskills: {
        where: { deleted: false, lifeskill: { name: LIFESKILL_NAMES.FARMING } },
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

async function addFarmingItem(tx, character, item, amount) {
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
    throw new FarmingRuleError('Your backpack is full. Please make space in your inventory.');
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

async function consumeFarmingSeed(tx, characterId, itemId, amount) {
  const rows = await tx.character_items.findMany({
    where: {
      character_id: characterId,
      item_id: itemId,
      location: ITEM_LOCATION.BACKPACK,
      deleted: false
    },
    orderBy: { id: 'asc' }
  });

  const totalAvailable = rows.reduce((sum, row) => sum + number(row.quantity, 1), 0);
  if (totalAvailable < amount) {
    throw new FarmingRuleError('You do not have enough seeds to plant.');
  }

  let remaining = amount;
  for (const row of rows) {
    const removed = Math.min(remaining, number(row.quantity, 1));
    const nextQuantity = number(row.quantity, 1) - removed;
    const changed = await tx.character_items.updateMany({
      where: {
        id: row.id,
        character_id: characterId,
        item_id: itemId,
        location: ITEM_LOCATION.BACKPACK,
        deleted: false,
        quantity: row.quantity
      },
      data: { quantity: { decrement: removed } }
    });

    if (changed.count !== 1) {
      throw new FarmingRuleError('Your seeds changed before farming completed. Please try again.');
    }

    if (nextQuantity === 0) {
      await tx.character_items.updateMany({
        where: { id: row.id, quantity: 0, deleted: false },
        data: { deleted: true }
      });
    }

    remaining -= removed;
    if (!remaining) break;
  }
}

export async function getFarmingData(userId) {
  try {
    const character = await getCharacterForFarming(prisma, userId);
    if (!character || character.deleted) throw new FarmingRuleError('Character not found.');

    const farmingLsRecord = character.character_lifeskills[0] || null;
    const currentLevel = number(farmingLsRecord?.current_level, 1);
    const currentExp = number(farmingLsRecord?.current_exp, 0);
    const formulas = calculateBdoFarmingFormulas(currentLevel);

    const nsfwAllowed = canAccessNsfw(character.player);
    const allRecipes = await prisma.crafting_recipes.findMany({
      where: {
        deleted: false,
        lifeskill: { name: LIFESKILL_NAMES.FARMING }
      },
      include: {
        output_item: true,
        ingredients: {
          where: { deleted: false },
          include: { item: true },
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });

    const recipes = allRecipes.filter((recipe) => nsfwAllowed || !recipeHasNsfw(recipe));
    const ownedSeedsMap = new Map();
    character.character_items.forEach((itemRow) => {
      if (!itemRow.deleted) {
        ownedSeedsMap.set(itemRow.item_id, (ownedSeedsMap.get(itemRow.item_id) || 0) + number(itemRow.quantity, 1));
      }
    });

    const formattedRecipes = recipes.map((recipe) => {
      const minQty = Math.max(1, number(recipe.output_quantity, 1));
      const maxQty = Math.max(minQty, number(recipe.max_output_quantity, minQty));
      const durationSeconds = Math.max(1, number(recipe.duration_seconds, DEFAULT_RECIPE_DURATION_SECONDS));

      return {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        duration_seconds: durationSeconds,
        output_quantity: minQty,
        max_output_quantity: maxQty,
        required_level: number(recipe.required_level, 1),
        exp_reward: number(recipe.exp_reward, DEFAULT_FARMING_EXP_REWARD),
        stamina_cost: number(recipe.stamina_cost, DEFAULT_FARMING_ENERGY_COST),
        output_item: {
          id: recipe.output_item.id,
          name: recipe.output_item.name,
          description: recipe.output_item.description,
          type: recipe.output_item.type,
          price: number(recipe.output_item.price, 0)
        },
        ingredients: recipe.ingredients.map((ing) => ({
          item_id: ing.item_id,
          name: ing.item?.name || 'Unknown Seed',
          description: ing.item?.description || '',
          quantity: number(ing.quantity, 1),
          price: number(ing.item?.price, DEFAULT_SEED_PRICE),
          is_buyable: Boolean(ing.item?.is_buyable),
          owned_quantity: ownedSeedsMap.get(ing.item_id) || 0
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
        bonus_yield_chance_pct: formulas.bonusYieldChancePct,
        free_energy_chance_pct: formulas.freeEnergyChancePct
      },
      recipes: formattedRecipes
    };
  } catch (error) {
    if (error instanceof FarmingRuleError) throw error;
    throw databaseError('getFarmingData', 'retrieve farming data', error);
  }
}

export async function buyFarmingSeeds(userId, { seedItemId, quantity = 1 } = {}) {
  const qty = Math.floor(Number(quantity));
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > MAX_SEED_PURCHASE_QUANTITY) {
    throw new FarmingRuleError(`Purchase quantity must be between 1 and ${MAX_SEED_PURCHASE_QUANTITY}.`);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForFarming(tx, userId);
      if (!character || character.deleted || !character.player) {
        throw new FarmingRuleError('Character not found.');
      }

      const seedItem = await tx.items.findFirst({
        where: { id: Number(seedItemId), deleted: false, is_buyable: true, ...nsfwItemWhere(canAccessNsfw(character.player)) }
      });
      if (!seedItem) {
        throw new FarmingRuleError('That seed is not available for purchase.');
      }

      const unitPrice = Math.max(0, number(seedItem.price, 0));
      const totalCost = unitPrice * qty;
      const currentGold = number(character.player.gold, 0);

      if (currentGold < totalCost) {
        throw new FarmingRuleError(`Not enough gold. Requires ${totalCost} gold, but you only have ${currentGold}.`);
      }

      await addFarmingItem(tx, character, seedItem, qty);

      await tx.players.update({
        where: { character_id: character.id },
        data: { gold: { decrement: totalCost } }
      });

      const updatedPlayer = await tx.players.findUnique({ where: { character_id: character.id } });
      const ownedRows = await tx.character_items.findMany({
        where: { character_id: character.id, item_id: seedItem.id, location: ITEM_LOCATION.BACKPACK, deleted: false }
      });
      const ownedQuantity = ownedRows.reduce((sum, r) => sum + number(r.quantity, 1), 0);
      const usedSlots = await tx.character_items.count({
        where: { character_id: character.id, location: ITEM_LOCATION.BACKPACK, deleted: false }
      });

      return {
        success: true,
        message: `Purchased x${qty} ${seedItem.name} for ${totalCost} gold.`,
        gold: number(updatedPlayer?.gold, 0),
        seed_item_id: seedItem.id,
        owned_quantity: ownedQuantity,
        used_slots: usedSlots
      };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });

    return result;
  } catch (error) {
    if (error instanceof FarmingRuleError) throw error;
    if (isTransactionConflict(error)) {
      throw new FarmingConflictError('Another action modified your character inventory. Please try again.');
    }
    throw databaseError('buyFarmingSeeds', 'purchase farming seeds', error);
  }
}

export async function executeFarm(userId, { recipeId } = {}) {
  const parsedRecipeId = Number(recipeId);
  if (!Number.isSafeInteger(parsedRecipeId) || parsedRecipeId < 1) {
    throw new FarmingRuleError('Invalid crop recipe.');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacterForFarming(tx, userId);
      if (!character || character.deleted || !character.player || !character.character_stat) {
        throw new FarmingRuleError('Character not found.');
      }
      if (!character.location?.is_safe_zone) {
        throw new FarmingRuleError('Farming is only available in a safe zone.');
      }

      const recipe = await tx.crafting_recipes.findFirst({
        where: { id: parsedRecipeId, deleted: false },
        include: {
          lifeskill: true,
          output_item: true,
          ingredients: {
            where: { deleted: false },
            include: { item: true }
          }
        }
      });

      if (!recipe || !recipe.output_item || (recipeHasNsfw(recipe) && !canAccessNsfw(character.player))) {
        throw new FarmingRuleError('Crop recipe not found.');
      }

      let farmingLifeskill = await tx.lifeskills.findFirst({ where: { name: LIFESKILL_NAMES.FARMING } });
      if (!farmingLifeskill) {
        farmingLifeskill = await tx.lifeskills.create({
          data: { name: LIFESKILL_NAMES.FARMING, description: LIFESKILL_DESCRIPTIONS.FARMING }
        });
      }

      let charLs = character.character_lifeskills[0];
      if (!charLs) {
        charLs = await tx.character_lifeskills.create({
          data: {
            character_id: character.id,
            lifeskill_id: farmingLifeskill.id,
            current_level: 1,
            current_exp: 0
          }
        });
      }

      const currentLevel = number(charLs.current_level, 1);
      const currentExp = number(charLs.current_exp, 0);
      const requiredLevel = number(recipe.required_level, 1);

      if (currentLevel < requiredLevel) {
        throw new FarmingRuleError(`Your Farming level is too low. Requires Farming Lv. ${requiredLevel}.`);
      }

      const baseEnergyCost = number(recipe.stamina_cost, DEFAULT_FARMING_ENERGY_COST);
      const currentEnergy = number(character.character_stat.current_energy, 0);
      if (currentEnergy < baseEnergyCost) {
        throw new FarmingRuleError('You do not have enough energy to farm.');
      }

      for (const ingredient of recipe.ingredients) {
        const requiredQty = number(ingredient.quantity, 1);
        const rows = await tx.character_items.findMany({
          where: {
            character_id: character.id,
            item_id: ingredient.item_id,
            location: ITEM_LOCATION.BACKPACK,
            deleted: false
          }
        });
        const ownedQty = rows.reduce((sum, r) => sum + number(r.quantity, 1), 0);
        if (ownedQty < requiredQty) {
          throw new FarmingRuleError(`You do not have enough ${ingredient.item?.name || 'seeds'} to plant.`);
        }
      }

      for (const ingredient of recipe.ingredients) {
        await consumeFarmingSeed(tx, character.id, ingredient.item_id, number(ingredient.quantity, 1));
      }

      const formulas = calculateBdoFarmingFormulas(currentLevel);
      const isFreeEnergy = baseEnergyCost > 0 && Math.random() < (formulas.freeEnergyChancePct / 100);
      const energyConsumed = isFreeEnergy ? 0 : baseEnergyCost;

      if (energyConsumed > 0) {
        const energyUpdate = await tx.character_stats.updateMany({
          where: { id: character.character_stat.id, current_energy: { gte: energyConsumed } },
          data: { current_energy: { decrement: energyConsumed } }
        });
        if (energyUpdate.count !== 1) {
          throw new FarmingRuleError('Your energy changed before farming completed. Please try again.');
        }
      }

      const minQty = Math.max(1, number(recipe.output_quantity, 1));
      const maxQty = Math.max(minQty, number(recipe.max_output_quantity, minQty));
      const rolledBaseQty = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
      const yieldResult = rollBdoCraftingYield(currentLevel, rolledBaseQty, Number(recipe.success_rate ?? 1.0));

      await addFarmingItem(tx, character, recipe.output_item, yieldResult.outputQuantity);

      const expGained = number(recipe.exp_reward, DEFAULT_FARMING_EXP_REWARD);
      const expResult = applyLifeSkillExpGain(currentLevel, currentExp, expGained);

      await tx.character_lifeskills.update({
        where: {
          character_id_lifeskill_id: {
            character_id: character.id,
            lifeskill_id: farmingLifeskill.id
          }
        },
        data: {
          current_level: expResult.newLevel,
          current_exp: expResult.newExp
        }
      });

      await tx.character_recipes.upsert({
        where: {
          character_id_recipe_id: {
            character_id: character.id,
            recipe_id: recipe.id
          }
        },
        create: {
          character_id: character.id,
          recipe_id: recipe.id,
          times_crafted: 1
        },
        update: {
          times_crafted: { increment: 1 },
          deleted: false
        }
      });

      const finalStat = await tx.character_stats.findUnique({ where: { id: character.character_stat.id } });
      const finalPlayer = await tx.players.findUnique({ where: { character_id: character.id } });
      const finalUsedSlots = await tx.character_items.count({
        where: { character_id: character.id, location: ITEM_LOCATION.BACKPACK, deleted: false }
      });
      const maxSlots = Math.max(0, number(character.character_inventory?.max_slots, DEFAULT_BACKPACK_SLOTS));
      const nextFormulas = calculateBdoFarmingFormulas(expResult.newLevel);

      const primaryIngredient = recipe.ingredients[0];
      let remainingSeedCount = 0;
      if (primaryIngredient) {
        const seedRows = await tx.character_items.findMany({
          where: {
            character_id: character.id,
            item_id: primaryIngredient.item_id,
            location: ITEM_LOCATION.BACKPACK,
            deleted: false
          }
        });
        remainingSeedCount = seedRows.reduce((sum, r) => sum + number(r.quantity, 1), 0);
      }

      return {
        success: true,
        recipe_id: recipe.id,
        harvested_item: {
          id: recipe.output_item.id,
          name: recipe.output_item.name,
          quantity: yieldResult.outputQuantity,
          has_bonus_yield: yieldResult.hasBonusYield
        },
        is_free_energy: isFreeEnergy,
        energy_consumed: energyConsumed,
        exp_gained: expGained,
        leveled_up: expResult.leveledUp,
        consumed_seed: primaryIngredient ? {
          item_id: primaryIngredient.item_id,
          name: primaryIngredient.item?.name || 'Seed',
          remaining_quantity: remainingSeedCount
        } : null,
        lifeskill: {
          level: expResult.newLevel,
          current_exp: expResult.newExp,
          next_level_exp: nextFormulas.nextLevelExp,
          rank: nextFormulas.rank,
          mastery: nextFormulas.mastery,
          bonus_yield_chance_pct: nextFormulas.bonusYieldChancePct,
          free_energy_chance_pct: nextFormulas.freeEnergyChancePct
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

    return result;
  } catch (error) {
    if (error instanceof FarmingRuleError) throw error;
    if (isTransactionConflict(error)) {
      throw new FarmingConflictError('Another action modified your character resources. Please try again.');
    }
    throw databaseError('executeFarm', 'execute farming action', error);
  }
}

export { FarmingConflictError, FarmingRuleError };
