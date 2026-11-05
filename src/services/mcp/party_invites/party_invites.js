import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'party_invites',
  description: 'Party invitations.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    party_id: { type: INT },
    inviter_character_id: { type: INT },
    invitee_character_id: { type: INT },
    status: { type: STRING },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
