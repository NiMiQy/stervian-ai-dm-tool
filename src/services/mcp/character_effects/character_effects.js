import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_effects',
  description: 'Status effects currently applied to characters.',
  keys: ['effect_id', 'character_id'],
  fields: {
    effect_id: { type: INT },
    character_id: { type: INT },
    duration_turn: { type: INT, nullable: true },
    applied_value: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
