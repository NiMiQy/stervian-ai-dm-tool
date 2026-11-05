import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'party_members',
  description: 'Members of parties.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    party_id: { type: INT },
    character_id: { type: INT },
    role: { type: ENUM, values: ['LEADER', 'MEMBER', 'CAPTIVE'], nullable: true },
    slot_order: { type: INT },
    tactics_role: { type: STRING },
    relationship_score: { type: INT },
    is_active: { type: BOOLEAN },
    joined_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
