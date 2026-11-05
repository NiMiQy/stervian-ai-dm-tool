import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_memories',
  description: 'Memories a character holds about the world or other characters.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    target_character_id: { type: INT, nullable: true },
    memory_type: { type: ENUM, values: ['SHORT_TERM', 'LONG_TERM', 'SEMANTIC', 'EPISODIC', 'SECRET'] },
    content: { type: STRING },
    is_secret: { type: BOOLEAN, nullable: true },
    is_nsfw: { type: BOOLEAN, nullable: true },
    add_from: { type: ENUM, values: ['AI_SUMMARIZE', 'ADMIN_SUMMARIZE_SCENES'] },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
