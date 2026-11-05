import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'items',
  description: 'Item catalog.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    type: { type: ENUM, values: ['HELMET', 'ARMOR', 'SHOES', 'GLOVES', 'EARRING', 'RING', 'NECKLACE', 'BELT', 'MAIN_HAND', 'TWO_HAND', 'QUEST_ITEMS', 'MISCS', 'FOOD', 'FISH', 'POTION', 'SKILL_SCROLL'] },
    rarity: { type: ENUM, values: ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'] },
    weapon_type: { type: ENUM, values: ['NONE', 'ANY_WEAPON', 'SWORD', 'BOW', 'STAFF', 'QUARTERSTAFF', 'AXE', 'SPEAR', 'CLUB', 'GREATSWORD', 'SHORTSWORD', 'KNIFE', 'SHIELD'] },
    size: { type: INT, nullable: true },
    is_stackable: { type: BOOLEAN, nullable: true },
    max_stack: { type: INT, nullable: true },
    max_upgrade_level: { type: INT, nullable: true },
    description: { type: STRING, nullable: true },
    price: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true },
    is_buyable: { type: BOOLEAN, nullable: true },
    is_consumable: { type: BOOLEAN },
    is_material: { type: BOOLEAN },
    is_nsfw: { type: BOOLEAN }
  }
});
