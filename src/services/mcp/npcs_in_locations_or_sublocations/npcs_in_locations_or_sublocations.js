import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'npcs_in_locations_or_sublocations',
  description: 'Where NPCs and monsters appear.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    npc_id: { type: INT },
    location_id: { type: INT, nullable: true },
    sublocation_id: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
