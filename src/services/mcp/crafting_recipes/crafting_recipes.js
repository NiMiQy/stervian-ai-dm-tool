import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, FLOAT, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'crafting_recipes',
  description: 'Crafting recipes and their outputs.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING },
    description: { type: STRING, nullable: true },
    lifeskill_id: { type: INT, nullable: true },
    output_item_id: { type: INT },
    output_quantity: { type: INT },
    max_output_quantity: { type: INT, nullable: true },
    required_level: { type: INT },
    exp_reward: { type: INT },
    stamina_cost: { type: INT },
    success_rate: { type: FLOAT },
    is_auto_unlocked: { type: BOOLEAN },
    duration_seconds: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
