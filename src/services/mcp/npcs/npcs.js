import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'npcs',
  description: 'NPC flags: attackable, speakable, recruitable.',
  keys: ['character_id'],
  fields: {
    character_id: { type: INT },
    is_attackable: { type: BOOLEAN, nullable: true },
    is_speakable: { type: BOOLEAN, nullable: true },
    is_recruitable: { type: BOOLEAN, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
