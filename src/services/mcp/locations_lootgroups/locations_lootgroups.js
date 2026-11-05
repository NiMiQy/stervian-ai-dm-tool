import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, FLOAT, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'locations_lootgroups',
  description: 'Loot groups that drop in locations.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    location_id: { type: INT, nullable: true },
    loot_group_id: { type: INT, nullable: true },
    chance_pct: { type: FLOAT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
