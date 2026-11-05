import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_item_bonus_time',
  description: 'Timed or permanent consumable bonuses on characters.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    item_id: { type: INT },
    is_permanent: { type: BOOLEAN },
    expires_at: { type: DATE_TIME, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
