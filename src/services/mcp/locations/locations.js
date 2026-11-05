import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, FLOAT, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'locations',
  description: 'World locations inside regions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    region_id: { type: INT },
    name: { type: STRING },
    description: { type: STRING, nullable: true },
    subgeography: { type: STRING, nullable: true },
    subpolitics: { type: STRING, nullable: true },
    subculture: { type: STRING, nullable: true },
    map_x: { type: FLOAT, nullable: true },
    map_y: { type: FLOAT, nullable: true },
    is_safe_zone: { type: BOOLEAN, nullable: true },
    location_type: { type: ENUM, values: ['VILLAGE', 'TOWN', 'CAPITAL', 'FORTRESS', 'STRONGHOLD', 'DANGER_FIELD', 'HUNTING_FIELD', 'DUNGEON'] },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
