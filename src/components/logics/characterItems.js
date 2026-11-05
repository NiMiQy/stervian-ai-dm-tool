import { DEFAULT_BACKPACK_SLOTS, EQUIP_SLOT_FIELDS, ITEM_LOCATION, UPGRADE_RATES } from '../../configs/constants.js';

const ITEM_BONUS_FIELDS = [
  'max_hp_bonus', 'healing_current_hp',
  'proficiency_bonus', 'intelligent_bonus', 'strength_bonus', 'dexterity_bonus',
  'charisma_bonus', 'constitution_bonus', 'wisdom_bonus',
  'physical_attack_bonus', 'magical_attack_bonus', 'armor_bonus',
  'magical_armor_bonus', 'effect_resistant_bonus',
  'fire_element_resistant', 'ice_element_resistant', 'earth_element_resistant',
  'lightning_element_resistant', 'wind_element_resistant',
  'holy_element_resistant', 'dark_element_resistant',
  'crit_chance_bonus', 'crit_damage_bonus',
  'current_food_bonus', 'current_water_bonus', 'evade_chance_bonus', 'accuracy_bonus'
];

const LEGACY_BONUS_ALIASES = { crit_chance_bonus: 'crit_chance', crit_damage_bonus: 'crit_damage' };

export const characterItemInclude = {
  items: { include: { item_bonus: true, skills_in_items: { where: { deleted: false }, select: { skill: { select: { id: true, name: true, type: true, deleted: true } } } } } },
  prefix: true,
  suffix: true
};

export { EQUIP_SLOT_FIELDS };

export const EQUIP_FIELD_SLOTS = Object.fromEntries(
  Object.entries(EQUIP_SLOT_FIELDS).map(([slot, field]) => [field, slot])
);

export async function getCharacterItems(client, characterId, location) {
  return client.character_items.findMany({
    where: {
      character_id: characterId,
      deleted: false,
      ...(location ? { location } : {})
    },
    include: characterItemInclude,
    orderBy: { id: 'asc' }
  });
}

function mergeBonuses(item, prefix, suffix) {
  if (!item) return null;
  const bonuses = [item.item_bonus, prefix, suffix].filter(Boolean);
  if (!bonuses.length) return item;
  const itemBonus = { ...item.item_bonus };
  for (const field of ITEM_BONUS_FIELDS) {
    const total = bonuses.reduce((sum, bonus) => sum + (Number(bonus[field] ?? bonus[LEGACY_BONUS_ALIASES[field]]) || 0), 0);
    if (total || Object.prototype.hasOwnProperty.call(itemBonus, field)) itemBonus[field] = total;
  }
  return { ...item, item_bonus: itemBonus };
}

const UPGRADE_FIELDS = new Set([
  'physical_attack_bonus', 'magical_attack_bonus', 'armor_bonus', 'magical_armor_bonus', 'max_hp_bonus',
  'fire_element_resistant', 'ice_element_resistant', 'earth_element_resistant', 'lightning_element_resistant',
  'wind_element_resistant', 'holy_element_resistant', 'dark_element_resistant', 'crit_chance_bonus', 'crit_damage_bonus'
]);

function mergeUpgradedBonuses(item, bonus, level) {
  const rate = UPGRADE_RATES[item?.type] || 0;
  const upgradeLevel = Math.max(0, Number(level) || 0);
  if (!rate || !upgradeLevel || !bonus) return bonus;
  const scaled = { ...bonus };
  for (const field of UPGRADE_FIELDS) {
    if (scaled[field] === null || scaled[field] === undefined) continue;
    scaled[field] = Math.round(Number(scaled[field]) * (1 + upgradeLevel * rate));
  }
  return scaled;
}

export function toCharacterItemView(row) {
  const baseItem = row.items?.item_bonus
    ? { ...row.items, item_bonus: mergeUpgradedBonuses(row.items, row.items.item_bonus, row.current_level_upgraded) }
    : row.items;
  const item = mergeBonuses(baseItem, row.prefix, row.suffix);
  return {
    ...row,
    item,
    equipped: row.location === ITEM_LOCATION.EQUIPPED
  };
}

export function buildEquipment(rows = []) {
  const equipment = {};
  for (const [slot, field] of Object.entries(EQUIP_SLOT_FIELDS)) {
    const row = rows.find((entry) => entry.equip_slot === slot && entry.location === ITEM_LOCATION.EQUIPPED);
    equipment[`${field}_id`] = row?.item_id ?? null;
    equipment[field] = row ? toCharacterItemView(row).item : null;
  }
  return equipment;
}

export function projectCharacterItems(character, rows = character.character_items || []) {
  const backpackRows = rows.filter((row) => row.location === ITEM_LOCATION.BACKPACK).map(toCharacterItemView);
  const vaultRows = rows.filter((row) => row.location === ITEM_LOCATION.VAULT).map(toCharacterItemView);
  const equippedRows = rows.filter((row) => row.location === ITEM_LOCATION.EQUIPPED);

  character.character_inventory = character.character_inventory
    ? { ...character.character_inventory, item_inventory: backpackRows }
    : { id: null, character_id: character.id, max_slots: DEFAULT_BACKPACK_SLOTS, deleted: false, item_inventory: backpackRows };
  character.vault = character.vault
    ? { ...character.vault, vault_items: vaultRows }
    : null;
  character.character_equipment = buildEquipment(equippedRows);
  character.character_items = rows.map(toCharacterItemView);
  return character;
}

export function itemRowsToEquipment(rows = []) {
  return buildEquipment(rows);
}
