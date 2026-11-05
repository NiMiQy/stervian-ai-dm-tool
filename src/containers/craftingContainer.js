import { databaseError, isTransactionConflict } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { getCharacterSheet } from './characterContainer.js';
import { characterItemInclude, buildEquipment } from '../components/logics/characterItems.js';
import { loadBonusEquipment } from '../services/itemBonusTimeService.js';
import { canAccessNsfw, isNsfwRecord, recipeHasNsfw } from '../services/nsfwAccessService.js';
import { calculateDerivedStats } from './core/battleSystemCore.js';
import { calculateBdoLifeSkillFormulas, applyLifeSkillExpGain, rollBdoCraftingYield, rollRecipeOutputQuantity } from './core/lifeskillCore.js';

import {
  ACCESSORY_ITEM_TYPES,
  DEFAULT_BACKPACK_SLOTS,
  DEFAULT_MAX_ENERGY,
  ERROR_NAMES,
  HTTP_STATUS,
  ITEM_LOCATION,
  ITEM_TYPE,
  LIFESKILL_RECIPE_DURATION_SECONDS,
  MASS_PROCESS_MAX_QUANTITY,
  MASS_PROCESS_UNLOCK_LEVEL,
  NON_EQUIPMENT_ITEM_TYPES,
  STORAGE_LOCATIONS,
  TRANSACTION_ISOLATION,
  UPGRADE_BASE_GOLD_COST,
  UPGRADE_MATERIAL_CATEGORY,
  UPGRADE_MATERIAL_NAMES,
  UPGRADE_RARITY_COST,
  WEAPON_ITEM_TYPES,
} from '../configs/constants.js';
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

class CraftingRuleError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) { super(message); this.name = ERROR_NAMES.CRAFTING_RULE; this.statusCode = statusCode; }
}

class CraftingConflictError extends CraftingRuleError {
  constructor(message) { super(message, HTTP_STATUS.CONFLICT); this.name = ERROR_NAMES.CRAFTING_CONFLICT; }
}

export { isTransactionConflict };

function ownedRows(character, location) {
  return (character.character_items || []).filter((row) => !row.deleted && (!location || row.location === location) && number(row.quantity, 1) > 0);
}

async function getCharacter(client, userId) {
  return client.characters.findUnique({
    where: { user_id: userId },
    include: {
      player: true,
      character_stat: true,
      character_inventory: true,
      sublocation: true,
      vault: true,
      character_lifeskills: { where: { deleted: false }, include: { lifeskill: true } },
      character_items: { where: { deleted: false }, include: characterItemInclude, orderBy: { id: 'asc' } }
    }
  });
}

function recipeView(recipe, characterRecipes, lifeskills) {
  const learned = characterRecipes.find((entry) => entry.recipe_id === recipe.id);
  const skill = recipe.lifeskill_id ? lifeskills.find((entry) => entry.lifeskill_id === recipe.lifeskill_id) : null;
  const currentLevel = recipe.lifeskill_id ? (skill ? number(skill.current_level, 0) : (number(recipe.required_level, 1) <= 1 ? 1 : 0)) : number(recipe.required_level, 1);
  const formulas = calculateBdoLifeSkillFormulas(currentLevel);
  return {
    id: recipe.id, name: recipe.name, description: recipe.description, output_quantity: recipe.output_quantity,
    max_output_quantity: recipe.max_output_quantity ?? recipe.output_quantity,
    duration_seconds: recipe.duration_seconds || LIFESKILL_RECIPE_DURATION_SECONDS,
    required_level: recipe.required_level, exp_reward: recipe.exp_reward, stamina_cost: recipe.stamina_cost,
    success_rate: recipe.success_rate, unlocked: recipe.is_auto_unlocked || Boolean(learned),
    lifeskill: recipe.lifeskill ? { id: recipe.lifeskill.id, name: recipe.lifeskill.name } : null,
    current_level: currentLevel,
    times_crafted: number(learned?.times_crafted),
    bdo_rank: formulas.rank,
    bdo_mastery: formulas.mastery,
    free_energy_chance_pct: formulas.freeEnergyChancePct,
    bonus_yield_chance_pct: formulas.bonusYieldChancePct,
    max_yield_chance_pct: formulas.maxYieldChancePct,
    can_mass_process: Boolean(recipe.lifeskill_id) && formulas.canMassProcess,
    mass_process_max: MASS_PROCESS_MAX_QUANTITY,
    mass_process_unlock_level: MASS_PROCESS_UNLOCK_LEVEL,
    effective_success_rate: Math.min(1.0, Number(recipe.success_rate ?? 1.0) + (formulas.successRateBonusPct / 100)),
    output_item: recipe.output_item,
    ingredients: recipe.ingredients.map((ingredient) => ({ item_id: ingredient.item_id, quantity: ingredient.quantity, item: ingredient.item }))
  };
}

function materialType(itemType) { return WEAPON_ITEM_TYPES.includes(itemType) ? UPGRADE_MATERIAL_CATEGORY.WEAPON : ACCESSORY_ITEM_TYPES.includes(itemType) ? UPGRADE_MATERIAL_CATEGORY.ACCESSORY : UPGRADE_MATERIAL_CATEGORY.ARMOR; }

function upgradeMaterialName(item) { return UPGRADE_MATERIAL_NAMES[materialType(item?.type)]?.[item?.rarity] || null; }

function upgradeBlockedReason(item) {
  if (upgradeMaterialName(item)) return null;
  const rarity = item?.rarity === 'NORMAL' ? 'Common' : String(item?.rarity || 'this').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
  return `No upgrade stone exists for ${rarity} ${materialType(item?.type).toLowerCase()} yet.`;
}

function findUpgradeMaterial(materials, item) {
  const name = upgradeMaterialName(item);
  if (!name) return null;
  return materials.find((material) => String(material.name || '').trim().toLowerCase() === name) || null;
}

export async function getCraftingData(userId) {
  try {
    const character = await getCharacter(prisma, userId);
    if (!character || character.deleted) throw new CraftingRuleError('Character not found.');
    const [recipes, characterRecipes, materials] = await Promise.all([
      prisma.crafting_recipes.findMany({ where: { deleted: false }, include: { lifeskill: true, output_item: true, ingredients: { where: { deleted: false }, include: { item: true } } }, orderBy: { id: 'asc' } }),
      prisma.character_recipes.findMany({ where: { character_id: character.id, deleted: false } }),
      prisma.items.findMany({ where: { deleted: false, is_material: true }, select: { id: true, name: true } })
    ]);
    const nsfwAllowed = canAccessNsfw(character.player);
    const visibleRows = (location) => ownedRows(character, location).filter((row) => nsfwAllowed || !isNsfwRecord(row.items));
    const ownedMaterials = ownedRows(character).reduce((map, row) => map.set(row.item_id, (map.get(row.item_id) || 0) + number(row.quantity, 1)), new Map());
    return {
      character: {
        id: character.id,
        gold: number(character.player?.gold),
        energy: number(character.character_stat?.current_energy),
        max_energy: number(character.character_stat?.max_energy, DEFAULT_MAX_ENERGY),
        sublocation_id: character.sublocation_id,
        sublocation: character.sublocation ? { id: character.sublocation.id, sublocation_type: character.sublocation.sublocation_type } : null
      },
      recipes: recipes.filter((recipe) => nsfwAllowed || !recipeHasNsfw(recipe)).map((recipe) => recipeView(recipe, characterRecipes, character.character_lifeskills)),
      inventory: visibleRows(ITEM_LOCATION.BACKPACK).map((row) => ({ id: row.id, item_id: row.item_id, quantity: number(row.quantity, 1), item: row.items })),
      vault: visibleRows(ITEM_LOCATION.VAULT).map((row) => ({ id: row.id, item_id: row.item_id, quantity: number(row.quantity, 1), item: row.items })),
      upgradeable: visibleRows().filter((row) => row.items?.type && !NON_EQUIPMENT_ITEM_TYPES.includes(row.items.type)).map((row) => {
        const targetLevel = number(row.current_level_upgraded) + 1;
        const material = findUpgradeMaterial(materials, row.items);
        return { id: row.id, location: row.location, upgrade_blocked_reason: upgradeBlockedReason(row.items), current_level_upgraded: number(row.current_level_upgraded), item: row.items, next_level: targetLevel, gold_cost: (UPGRADE_BASE_GOLD_COST + number(UPGRADE_RARITY_COST[row.items.rarity])) * targetLevel, material: material ? { id: material.id, name: material.name, required: targetLevel, available: ownedMaterials.get(material.id) || 0 } : null };
      })
    };
  } catch (error) {
    if (error instanceof CraftingRuleError) throw error;
    throw databaseError('getCraftingData', 'read crafting data', error);
  }
}

async function consumeItems(tx, characterId, itemId, amount) {
  const rows = await tx.character_items.findMany({ where: { character_id: characterId, item_id: itemId, location: { in: STORAGE_LOCATIONS }, deleted: false }, orderBy: [{ location: 'asc' }, { id: 'asc' }] });
  if (rows.reduce((sum, row) => sum + number(row.quantity, 1), 0) < amount) throw new CraftingRuleError('You do not have enough required materials.');
  let remaining = amount;
  for (const row of rows) {
    const removed = Math.min(remaining, number(row.quantity, 1));
    const next = number(row.quantity, 1) - removed;
    const changed = await tx.character_items.updateMany({ where: { id: row.id, character_id: characterId, item_id: itemId, location: row.location, deleted: false, quantity: row.quantity }, data: { quantity: { decrement: removed } } });
    if (changed.count !== 1) throw new CraftingRuleError('The required materials changed before crafting completed. Please try again.');
    if (next === 0) await tx.character_items.updateMany({ where: { id: row.id, quantity: 0, deleted: false }, data: { deleted: true } });
    remaining -= removed;
    if (!remaining) break;
  }
}

async function addItem(tx, character, item, amount) {
  const maxStack = item.is_stackable ? Math.max(1, number(item.max_stack, 1)) : 1;
  let remaining = amount;
  const rows = await tx.character_items.findMany({ where: { character_id: character.id, item_id: item.id, location: ITEM_LOCATION.BACKPACK, deleted: false, prefix_id: null, suffix_id: null, current_level_upgraded: 0 }, orderBy: { id: 'asc' } });
  for (const row of rows) {
    const added = Math.min(remaining, Math.max(0, maxStack - number(row.quantity, 1)));
    if (added) { await tx.character_items.update({ where: { id: row.id }, data: { quantity: { increment: added } } }); remaining -= added; }
    if (!remaining) break;
  }
  const usedSlots = await tx.character_items.count({ where: { character_id: character.id, location: ITEM_LOCATION.BACKPACK, deleted: false } });
  if (Math.ceil(remaining / maxStack) > Math.max(0, number(character.character_inventory?.max_slots, DEFAULT_BACKPACK_SLOTS) - usedSlots)) throw new CraftingRuleError('Your backpack does not have enough space.');
  while (remaining) { const quantity = Math.min(remaining, maxStack); await tx.character_items.create({ data: { character_id: character.id, item_id: item.id, location: ITEM_LOCATION.BACKPACK, quantity } }); remaining -= quantity; }
}

export async function craftRecipe(userId, recipeId, requestedQuantity = 1) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacter(tx, userId);
      if (!character || character.deleted || !character.player || !character.character_stat) throw new CraftingRuleError('Character not found.');
      const parsedRecipeId = Number(recipeId);
      if (!Number.isSafeInteger(parsedRecipeId) || parsedRecipeId < 1) throw new CraftingRuleError('Recipe not found.');
      const batches = requestedQuantity === undefined || requestedQuantity === null || requestedQuantity === '' ? 1 : Number(requestedQuantity);
      if (!Number.isSafeInteger(batches) || batches < 1 || batches > MASS_PROCESS_MAX_QUANTITY) throw new CraftingRuleError(`Quantity must be between 1 and ${MASS_PROCESS_MAX_QUANTITY}.`);
      const recipe = await tx.crafting_recipes.findFirst({ where: { id: parsedRecipeId, deleted: false }, include: { output_item: true, ingredients: { where: { deleted: false }, include: { item: true } } } });
      if (!recipe || (recipeHasNsfw(recipe) && !canAccessNsfw(character.player))) throw new CraftingRuleError('Recipe not found.');
      const learned = await tx.character_recipes.findUnique({ where: { character_id_recipe_id: { character_id: character.id, recipe_id: recipe.id } } });
      if (!recipe.is_auto_unlocked && (!learned || learned.deleted)) throw new CraftingRuleError('You have not learned this recipe.');
      let skill = recipe.lifeskill_id ? character.character_lifeskills.find((entry) => entry.lifeskill_id === recipe.lifeskill_id) : null;
      if (recipe.lifeskill_id && !skill && number(recipe.required_level, 1) <= 1) {
        skill = await tx.character_lifeskills.upsert({
          where: { character_id_lifeskill_id: { character_id: character.id, lifeskill_id: recipe.lifeskill_id } },
          create: { character_id: character.id, lifeskill_id: recipe.lifeskill_id, current_level: 1, current_exp: 0 },
          update: { deleted: false }
        });
      }
      if (recipe.lifeskill_id && (!skill || number(skill.current_level, 0) < number(recipe.required_level, 1))) throw new CraftingRuleError('Your life skill level is too low.');
      const skillLevel = recipe.lifeskill_id ? number(skill?.current_level, 1) : 1;
      const formulas = calculateBdoLifeSkillFormulas(skillLevel);
      if (batches > 1 && (!recipe.lifeskill_id || !formulas.canMassProcess)) throw new CraftingRuleError(`Mass processing unlocks at Master rank (level ${MASS_PROCESS_UNLOCK_LEVEL}).`);
      const baseStaminaCost = number(recipe.stamina_cost);
      const stamina = number(character.character_stat.current_energy);
      if (stamina < baseStaminaCost * batches) throw new CraftingRuleError(batches > 1 ? `You need ${baseStaminaCost * batches} energy to process ${batches} times.` : 'You do not have enough energy to craft this.');
      let freeEnergyProcs = 0;
      for (let index = 0; index < batches; index += 1) if (baseStaminaCost > 0 && Math.random() < (formulas.freeEnergyChancePct / 100)) freeEnergyProcs += 1;
      const energyToDeduct = baseStaminaCost * (batches - freeEnergyProcs);

      for (const ingredient of recipe.ingredients) await consumeItems(tx, character.id, ingredient.item_id, number(ingredient.quantity, 1) * batches);
      if (energyToDeduct > 0) {
        const energyUpdate = await tx.character_stats.updateMany({ where: { id: character.character_stat.id, current_energy: { gte: energyToDeduct } }, data: { current_energy: { decrement: energyToDeduct } } });
        if (energyUpdate.count !== 1) throw new CraftingRuleError('Your energy changed before crafting completed. Please try again.');
      }
      const minQty = Math.max(1, number(recipe.output_quantity, 1));
      const maxQty = Math.max(minQty, number(recipe.max_output_quantity, minQty));
      let totalOutput = 0;
      let successes = 0;
      let bonusYields = 0;
      let maxYields = 0;
      for (let index = 0; index < batches; index += 1) {
        const roll = rollRecipeOutputQuantity(skillLevel, minQty, maxQty);
        const yieldResult = rollBdoCraftingYield(skillLevel, roll.quantity, Number(recipe.success_rate ?? 1));
        if (!yieldResult.success) continue;
        successes += 1;
        totalOutput += yieldResult.outputQuantity;
        if (yieldResult.hasBonusYield) bonusYields += 1;
        if (roll.isMaxYield && maxQty > minQty) maxYields += 1;
      }
      if (!successes) return { success: false, batches, message: batches > 1 ? `All ${batches} attempts failed, but the materials and energy were consumed.` : 'The craft failed, but the materials and energy were consumed.' };
      await addItem(tx, character, recipe.output_item, totalOutput);
      let leveledUp = false;
      let expGained = 0;
      if (recipe.lifeskill_id && number(recipe.exp_reward)) {
        expGained = number(recipe.exp_reward) * successes;
        const expResult = applyLifeSkillExpGain(skill?.current_level || 1, skill?.current_exp || 0, expGained);
        leveledUp = expResult.leveledUp;
        await tx.character_lifeskills.update({
          where: { character_id_lifeskill_id: { character_id: character.id, lifeskill_id: recipe.lifeskill_id } },
          data: { current_level: expResult.newLevel, current_exp: expResult.newExp }
        });
      }
      await tx.character_recipes.upsert({ where: { character_id_recipe_id: { character_id: character.id, recipe_id: recipe.id } }, create: { character_id: character.id, recipe_id: recipe.id, times_crafted: successes }, update: { times_crafted: { increment: successes }, deleted: false } });
      let craftMessage = batches > 1 ? `Processed ${successes}/${batches} times and made ${totalOutput} ${recipe.output_item.name}.` : `Crafted ${totalOutput} ${recipe.output_item.name}.`;
      if (maxYields) craftMessage += batches > 1 ? ` (◆ Max yield ×${maxYields})` : ' (◆ Max yield)';
      if (bonusYields) craftMessage += batches > 1 ? ` (★ Bonus yield ×${bonusYields})` : ' (★ BDO Bonus Yield: +1 output)';
      if (freeEnergyProcs) craftMessage += batches > 1 ? ` (⚡ Free energy ×${freeEnergyProcs})` : ' (⚡ BDO Free Energy proc)';
      if (expGained) craftMessage += ` +${expGained} EXP.`;
      if (leveledUp) craftMessage += ' Life skill level up!';
      return { success: true, batches, successes, message: craftMessage, output_quantity: totalOutput, exp_gained: expGained, has_bonus_yield: bonusYields > 0, is_free_energy: freeEnergyProcs > 0, leveled_up: leveledUp };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
    return { ...result, crafting: await getCraftingData(userId) };
  } catch (error) {
    if (error instanceof CraftingRuleError) throw error;
    if (isTransactionConflict(error)) throw new CraftingConflictError('Another crafting action changed your resources. Please try again.');
    throw databaseError('craftRecipe', 'craft recipe', error);
  }
}

export async function upgradeItemLevel(userId, itemEntryId) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const character = await getCharacter(tx, userId);
      if (!character || character.deleted || !character.player) throw new CraftingRuleError('Character not found.');
      const entry = character.character_items.find((row) => row.id === Number(itemEntryId) && !row.deleted && !NON_EQUIPMENT_ITEM_TYPES.includes(row.items?.type));
      if (!entry?.items || (isNsfwRecord(entry.items) && !canAccessNsfw(character.player))) throw new CraftingRuleError('Upgradeable item not found.');
      const current = number(entry.current_level_upgraded); const max = number(entry.items.max_upgrade_level);
      if (current >= max) throw new CraftingRuleError('This item is already at its upgrade limit.');
      const target = current + 1; const goldCost = (UPGRADE_BASE_GOLD_COST + number(UPGRADE_RARITY_COST[entry.items.rarity])) * target;
      const materialRows = await tx.items.findMany({ where: { deleted: false, is_material: true }, select: { id: true, name: true }, orderBy: { id: 'asc' } });
      const blockedReason = upgradeBlockedReason(entry.items);
      if (blockedReason) throw new CraftingRuleError(blockedReason);
      const material = findUpgradeMaterial(materialRows, entry.items);
      if (!material) throw new CraftingRuleError('The required upgrade material is not available yet.');
      const materialQuantity = target;
      const available = (await tx.character_items.findMany({ where: { character_id: character.id, item_id: material.id, location: { in: STORAGE_LOCATIONS }, deleted: false }, select: { quantity: true } })).reduce((sum, row) => sum + number(row.quantity, 1), 0);
      if (available < materialQuantity) throw new CraftingRuleError(`You need ${materialQuantity} ${material.name}.`);
      if (number(character.player.gold) < goldCost) throw new CraftingRuleError(`You need ${goldCost} gold.`);
      await consumeItems(tx, character.id, material.id, materialQuantity);
      const goldUpdate = await tx.players.updateMany({ where: { character_id: character.id, gold: { gte: goldCost } }, data: { gold: { decrement: goldCost } } });
      if (goldUpdate.count !== 1) throw new CraftingRuleError(`You need ${goldCost} gold.`);
      const itemUpdate = await tx.character_items.updateMany({ where: { id: entry.id, current_level_upgraded: current, deleted: false }, data: { current_level_upgraded: target } });
      if (itemUpdate.count !== 1) throw new CraftingRuleError('The item changed before the upgrade completed. Please try again.');
      if (entry.location === ITEM_LOCATION.EQUIPPED && character.character_stat) {
        const equipmentRows = character.character_items.map((row) => row.id === entry.id ? { ...row, current_level_upgraded: target } : row).filter((row) => row.location === ITEM_LOCATION.EQUIPPED && !row.deleted);
        const { maxHP } = calculateDerivedStats(character.character_stat, { ...buildEquipment(equipmentRows), ...await loadBonusEquipment(tx, character.id) });
        await tx.character_stats.update({ where: { id: character.character_stat.id }, data: { max_hp: maxHP, current_hp: Math.min(number(character.character_stat.current_hp, maxHP), maxHP) } });
      }
      return { success: true, message: `Upgraded ${entry.items.name} to +${target}.`, target_level: target, gold_cost: goldCost, material: { id: material.id, quantity: materialQuantity } };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
    return { ...result, crafting: await getCraftingData(userId), character: await getCharacterSheet(userId) };
  } catch (error) {
    if (error instanceof CraftingRuleError) throw error;
    if (isTransactionConflict(error)) throw new CraftingConflictError('Another upgrade action changed your resources. Please try again.');
    throw databaseError('upgradeItemLevel', 'upgrade item', error);
  }
}

export { CraftingConflictError, CraftingRuleError };
