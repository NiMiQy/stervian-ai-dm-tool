import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'regions',
  description: 'World regions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING },
    description: { type: STRING, nullable: true },
    geography: { type: STRING, nullable: true },
    politics: { type: STRING, nullable: true },
    culture: { type: STRING, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
