import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'loot_groups',
  description: 'Loot group definitions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    description: { type: STRING, nullable: true },
    loot_group_rarity: { type: ENUM, values: ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY', 'BOSS'] },
    min_gold: { type: INT, nullable: true },
    max_gold: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
