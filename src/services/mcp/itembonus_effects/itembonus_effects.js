import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'itembonus_effects',
  description: 'Effects granted by item bonuses.',
  keys: ['item_bonus_id', 'effect_id'],
  fields: {
    item_bonus_id: { type: INT },
    effect_id: { type: INT },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
