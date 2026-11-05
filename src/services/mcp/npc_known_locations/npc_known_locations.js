import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'npc_known_locations',
  description: 'Places each NPC knows about.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    location_id: { type: INT, nullable: true },
    sublocation_id: { type: INT, nullable: true },
    location_knowledge_type: { type: ENUM, values: ['LOCAL_LANDMARK', 'SECRET_PASSAGE', 'DANGER_ZONE', 'FREQUENT_HAUNT'] },
    location_semantic_memory: { type: STRING, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
