import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'lifeskills',
  description: 'Lifeskill definitions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    description: { type: STRING, nullable: true }
  }
});
