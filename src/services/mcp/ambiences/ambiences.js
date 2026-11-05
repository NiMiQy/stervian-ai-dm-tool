import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'ambiences',
  description: 'Ambience templates per location/sublocation, time slot and weather.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    location_id: { type: INT },
    sublocation_id: { type: INT, nullable: true },
    title: { type: STRING },
    time_slot: { type: ENUM, values: ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'ANY'] },
    weather: { type: ENUM, values: ['CLEAR', 'SUNNY', 'RAIN', 'HEAVYRAIN', 'STORM', 'FOG', 'SANDSTORM', 'SNOW'], nullable: true },
    crowd_level: { type: ENUM, values: ['EMPTY', 'FEW', 'SOME', 'BUSY', 'PACKED'] },
    description: { type: STRING },
    weight: { type: INT },
    min_figures: { type: INT },
    max_figures: { type: INT },
    is_active: { type: BOOLEAN },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
