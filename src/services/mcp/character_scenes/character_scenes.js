import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_scenes',
  description: 'Story scenes (goals, chaos factor, stage) per character.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    party_id: { type: INT, nullable: true },
    npc_character_id: { type: INT, nullable: true },
    location_id: { type: INT, nullable: true },
    sublocation_id: { type: INT, nullable: true },
    scene_goal: { type: STRING },
    scene_notes: { type: STRING, nullable: true },
    chaos_factor: { type: INT },
    affinity_reward: { type: INT },
    scene_stage: { type: ENUM, values: ['on_going', 'abandoned', 'solved'] },
    is_secret: { type: BOOLEAN, nullable: true },
    is_nsfw: { type: BOOLEAN, nullable: true },
    deleted: { type: BOOLEAN, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});
