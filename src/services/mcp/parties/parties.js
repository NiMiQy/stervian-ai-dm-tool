import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'parties',
  description: 'Adventuring parties.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    leader_character_id: { type: INT },
    max_size: { type: INT },
    status: { type: STRING },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
