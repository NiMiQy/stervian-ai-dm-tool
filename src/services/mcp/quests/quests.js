import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'quests',
  description: 'Quest definitions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    source_npc_id: { type: INT },
    name: { type: STRING },
    description: { type: STRING },
    objective_type: { type: ENUM, values: ['COLLECT', 'ELIMINATE', 'CAPTURE'] },
    target_item_id: { type: INT, nullable: true },
    target_npc_character_id: { type: INT, nullable: true },
    required_quantity: { type: INT },
    repeatable: { type: BOOLEAN },
    gold_reward: { type: INT },
    exp_reward: { type: INT },
    affinity_reward: { type: INT },
    is_nsfw: { type: BOOLEAN, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
