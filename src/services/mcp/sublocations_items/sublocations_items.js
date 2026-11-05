import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'sublocations_items',
  description: 'Items available in sublocations.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    sublocation_id: { type: INT, nullable: true },
    item_id: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
