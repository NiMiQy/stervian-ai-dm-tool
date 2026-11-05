import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'players',
  description: 'Player-only data: gold, NSFW flags, stat points.',
  keys: ['character_id'],
  fields: {
    character_id: { type: INT },
    current_point_spend: { type: INT, nullable: true },
    verified: { type: BOOLEAN, nullable: true },
    is_nsfw: { type: BOOLEAN, nullable: true },
    gold: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
