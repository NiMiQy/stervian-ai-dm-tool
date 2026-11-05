import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'users',
  description: 'Login accounts (password is never returned).',
  keys: ['id'],
  hidden: ['password'],
  fields: {
    id: { type: INT },
    user_id: { type: STRING },
    username: { type: STRING },
    password: { type: STRING },
    created_at: { type: DATE_TIME },
    is_admin: { type: BOOLEAN },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
