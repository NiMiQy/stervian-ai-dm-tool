import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_quests',
  description: 'Quests accepted by characters and their progress.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    quest_id: { type: INT },
    status: { type: ENUM, values: ['AVAILABLE', 'ACTIVE', 'COMPLETED', 'FAILED'] },
    progress: { type: INT },
    accepted_at: { type: DATE_TIME, nullable: true },
    completed_at: { type: DATE_TIME, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
