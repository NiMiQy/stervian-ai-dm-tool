import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, JSON_DATA, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'prefixes',
  description: 'Item prefix affixes.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    rarity: { type: ENUM, values: ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'] },
    tier: { type: ENUM, values: ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'] },
    stat_range: { type: JSON_DATA, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
