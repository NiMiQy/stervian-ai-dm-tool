import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'player_npc_relationships',
  description: 'How each NPC regards each player character.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    player_character_id: { type: INT },
    npc_character_id: { type: INT },
    is_player_name_revealed: { type: BOOLEAN, nullable: true },
    known_as_name: { type: STRING, nullable: true },
    nickname: { type: STRING, nullable: true },
    affinity: { type: INT, nullable: true },
    status: { type: ENUM, values: ['HOSTILE', 'DISGUSTED', 'HATEFUL', 'WARY', 'DISLIKE', 'STRANGER', 'NEUTRAL', 'FRIENDLY', 'CONFIDANT', 'DEVOTED'] },
    interaction_notes: { type: STRING, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
