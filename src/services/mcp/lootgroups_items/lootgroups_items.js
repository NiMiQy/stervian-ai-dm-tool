import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, FLOAT, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'lootgroups_items',
  description: 'Items inside loot groups with drop chances.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    loot_group_id: { type: INT, nullable: true },
    item_id: { type: INT, nullable: true },
    chance_pct: { type: FLOAT },
    min_quantity: { type: INT },
    max_quantity: { type: INT },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
