import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_recipes',
  description: 'Crafting recipes a character has unlocked.',
  keys: ['character_id', 'recipe_id'],
  fields: {
    character_id: { type: INT },
    recipe_id: { type: INT },
    times_crafted: { type: INT },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
