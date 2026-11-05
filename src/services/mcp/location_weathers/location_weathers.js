import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, ENUM, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'location_weathers',
  description: 'Current and past weather per location.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    location_id: { type: INT },
    weather: { type: ENUM, values: ['CLEAR', 'SUNNY', 'RAIN', 'HEAVYRAIN', 'STORM', 'FOG', 'SANDSTORM', 'SNOW'] },
    started_at: { type: DATE_TIME },
    expires_at: { type: DATE_TIME },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});
