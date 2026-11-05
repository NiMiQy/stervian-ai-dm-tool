import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'dialogue_participants',
  description: 'Participants of dialogue sessions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    session_id: { type: INT },
    character_id: { type: INT, nullable: true },
    name: { type: STRING },
    role: { type: STRING },
    joined_at: { type: DATE_TIME, nullable: true }
  }
});
