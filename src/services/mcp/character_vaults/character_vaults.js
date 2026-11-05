import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_vaults',
  description: 'Vault capacity, tier and stored gold per character.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    max_slots: { type: INT, nullable: true },
    tier: { type: INT, nullable: true },
    stored_gold: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
