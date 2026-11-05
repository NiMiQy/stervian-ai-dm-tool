import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'dialogue_messages',
  description: 'Messages inside dialogue sessions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    session_id: { type: INT },
    speaker_name: { type: STRING },
    speaker_id: { type: INT, nullable: true },
    message_type: { type: ENUM, values: ['SPEECH', 'ACTION', 'NARRATION'] },
    content: { type: STRING },
    created_at: { type: DATE_TIME, nullable: true }
  }
});
