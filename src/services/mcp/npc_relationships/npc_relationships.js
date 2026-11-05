import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'npc_relationships',
  description: 'Relationships between NPCs.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    source_npc_id: { type: INT },
    target_npc_id: { type: INT },
    relationship_type: { type: ENUM, values: ['RIVAL', 'ENEMY', 'FAMILY', 'FRIEND', 'MASTER_DISCIPLE', 'MASTER_SERVANT', 'STRANGER', 'ACQUAINTANCE', 'SUPERIOR_SUBORDINATE', 'BUSINESS_PARTNER', 'CLOSE_FRIEND', 'VASSAL', 'NTR', 'SLAVE'] },
    is_nsfw: { type: BOOLEAN, nullable: true },
    context_note: { type: STRING, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
