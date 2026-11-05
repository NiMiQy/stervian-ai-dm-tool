import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, INT, JSON_DATA, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'combat_sessions',
  description: 'Persisted in-progress battle states.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    user_id: { type: STRING },
    character_id: { type: INT },
    party_id: { type: INT, nullable: true },
    status: { type: STRING },
    battle_state: { type: JSON_DATA },
    created_at: { type: DATE_TIME },
    updated_at: { type: DATE_TIME }
  }
});
