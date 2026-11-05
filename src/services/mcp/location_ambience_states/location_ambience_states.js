import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, ENUM, INT, JSON_DATA, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'location_ambience_states',
  description: 'Current ambience state per location/sublocation.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    scope_key: { type: STRING },
    location_id: { type: INT },
    sublocation_id: { type: INT, nullable: true },
    ambience_id: { type: INT, nullable: true },
    time_slot: { type: ENUM, values: ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'ANY'] },
    weather: { type: ENUM, values: ['CLEAR', 'SUNNY', 'RAIN', 'HEAVYRAIN', 'STORM', 'FOG', 'SANDSTORM', 'SNOW'], nullable: true },
    crowd_level: { type: ENUM, values: ['EMPTY', 'FEW', 'SOME', 'BUSY', 'PACKED'], nullable: true },
    description: { type: STRING, nullable: true },
    figures: { type: JSON_DATA, nullable: true },
    slot_started_at: { type: DATE_TIME },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});
