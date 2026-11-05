import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_lifeskills',
  description: 'Lifeskill levels and exp per character.',
  keys: ['character_id', 'lifeskill_id'],
  fields: {
    character_id: { type: INT },
    lifeskill_id: { type: INT },
    current_level: { type: INT, nullable: true },
    current_exp: { type: INT, nullable: true },
    deleted: { type: BOOLEAN },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});
