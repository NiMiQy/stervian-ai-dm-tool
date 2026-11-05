import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, ENUM, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'dialogue_sessions',
  description: 'Conversation sessions between a player and NPCs.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    player_id: { type: INT },
    session_type: { type: ENUM, values: ['DIRECT', 'GROUP', 'AMBIENT'] },
    status: { type: ENUM, values: ['ACTIVE', 'PAUSED', 'CLOSED'] },
    location_id: { type: INT, nullable: true },
    sublocation_id: { type: INT, nullable: true },
    target_npc_id: { type: INT, nullable: true },
    last_active_at: { type: DATE_TIME },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});
