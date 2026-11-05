import { pathToFileURL } from 'node:url';
import prisma from '../../services/prismaClient.js';
import { databaseError } from '../../database/databaseError.js';

const FEATHER_SET = ['Feather Cap', 'Feather Armor', 'Feather Boots', 'Feather Gloves'];

const MATERIALS = [
  { name: 'Refined Cloth', price: 315, description: 'Tightly woven cloth processed from raw cloth, used for armor work.' },
  { name: 'Weapon Upgrade Stone', price: 3184, description: 'Tier 1 · Common. A dense whetted stone used to upgrade Common weapons.' },
  { name: 'Armor Upgrade Stone', price: 2150, description: 'Tier 1 · Common. A reinforced stone used to upgrade Common armor.' }
];

const RECIPES = [
  { name: 'Refined Cloth', output: 'Refined Cloth', description: 'Process 3 Cloth into 1 Refined Cloth.', ingredients: [['Cloth', 3]] },
  { name: 'Weapon Upgrade Stone', output: 'Weapon Upgrade Stone', description: 'Tier 1 · Common. Upgrades Common weapons.', ingredients: [['Stone', 50], ['Metal Scrap', 15], ['Refined Metal', 3]] },
  { name: 'Armor Upgrade Stone', output: 'Armor Upgrade Stone', description: 'Tier 1 · Common. Upgrades Common armor.', ingredients: [['Stone', 50], ['Metal Scrap', 5], ['Refined Cloth', 4]] }
];

const RECIPE_DEFAULTS = { output_quantity: 1, max_output_quantity: 1, required_level: 1, exp_reward: 10, stamina_cost: 1, success_rate: 1, is_auto_unlocked: true, duration_seconds: 30, deleted: false };

async function findOneItem(tx, name) {
  const matches = await tx.items.findMany({ where: { name, deleted: false }, select: { id: true } });
  if (matches.length > 1) throw new Error(`Expected at most one active item named ${name}.`);
  return matches[0] || null;
}

export async function addUpgradeStones(client = prisma) {
  try {
    return await client.$transaction(async (tx) => {
      const feather = await tx.items.updateMany({ where: { name: { in: FEATHER_SET }, deleted: false }, data: { rarity: 'NORMAL' } });

      const itemIds = new Map();
      for (const material of MATERIALS) {
        const data = { name: material.name, type: 'MISCS', rarity: 'NORMAL', is_material: true, is_stackable: true, max_stack: 100, size: 1, max_upgrade_level: 0, price: material.price, is_buyable: false, description: material.description, deleted: false };
        const existing = await findOneItem(tx, material.name);
        const saved = existing ? await tx.items.update({ where: { id: existing.id }, data }) : await tx.items.create({ data });
        itemIds.set(material.name, saved.id);
      }
      for (const name of ['Cloth', 'Stone', 'Metal Scrap', 'Refined Metal']) {
        const item = await findOneItem(tx, name);
        if (!item) throw new Error(`Ingredient item ${name} was not found.`);
        itemIds.set(name, item.id);
      }

      const processing = await tx.lifeskills.findFirst({ where: { name: 'Processing' }, select: { id: true } });
      if (!processing) throw new Error('The Processing lifeskill was not found.');

      for (const recipe of RECIPES) {
        const data = { ...RECIPE_DEFAULTS, name: recipe.name, description: recipe.description, lifeskill_id: processing.id, output_item_id: itemIds.get(recipe.output) };
        const matches = await tx.crafting_recipes.findMany({ where: { name: recipe.name, deleted: false }, select: { id: true } });
        if (matches.length > 1) throw new Error(`Expected at most one active recipe named ${recipe.name}.`);
        const saved = matches.length ? await tx.crafting_recipes.update({ where: { id: matches[0].id }, data }) : await tx.crafting_recipes.create({ data });
        await tx.crafting_recipe_ingredients.updateMany({ where: { recipe_id: saved.id }, data: { deleted: true } });
        for (const [itemName, quantity] of recipe.ingredients) {
          const itemId = itemIds.get(itemName);
          const existing = await tx.crafting_recipe_ingredients.findFirst({ where: { recipe_id: saved.id, item_id: itemId }, select: { id: true } });
          if (existing) await tx.crafting_recipe_ingredients.update({ where: { id: existing.id }, data: { quantity, deleted: false } });
          else await tx.crafting_recipe_ingredients.create({ data: { recipe_id: saved.id, item_id: itemId, quantity } });
        }
      }
      return { featherUpdated: feather.count, materials: MATERIALS.length, recipes: RECIPES.length };
    });
  } catch (error) {
    throw databaseError('addUpgradeStones', 'add upgrade stones and recipes', new Error(error.code || error.message || 'Upgrade stone migration failed'));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  addUpgradeStones()
    .then(({ featherUpdated, materials, recipes }) => console.log(`Feather set moved to Common (${featherUpdated} items). Saved ${materials} materials and ${recipes} Processing recipes.`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
