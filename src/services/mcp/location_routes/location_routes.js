import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'location_routes',
  description: 'Travel routes between locations with costs.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    location_a_id: { type: INT },
    location_b_id: { type: INT },
    energy_cost: { type: INT },
    food_cost: { type: INT },
    water_cost: { type: INT },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
