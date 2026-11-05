import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, JSON_DATA } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_items',
  description: 'Items owned by characters (backpack, equipped, vault).',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    item_id: { type: INT },
    location: { type: ENUM, values: ['NONE', 'BACKPACK', 'VAULT', 'EQUIPPED'] },
    equip_slot: { type: ENUM, values: ['NONE', 'HELMET', 'ARMOR', 'GLOVES', 'SHOES', 'LEFT_HAND', 'RIGHT_HAND', 'LEFT_EARRING', 'RIGHT_EARRING', 'LEFT_RING', 'RIGHT_RING', 'NECKLACE', 'BELT'], nullable: true },
    quantity: { type: INT, nullable: true },
    current_level_upgraded: { type: INT, nullable: true },
    prefix_id: { type: INT, nullable: true },
    suffix_id: { type: INT, nullable: true },
    prefix_stats: { type: JSON_DATA, nullable: true },
    suffix_stats: { type: JSON_DATA, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
