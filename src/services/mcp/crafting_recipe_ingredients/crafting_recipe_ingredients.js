import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'crafting_recipe_ingredients',
  description: 'Ingredients required by crafting recipes.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    recipe_id: { type: INT },
    item_id: { type: INT },
    quantity: { type: INT },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
