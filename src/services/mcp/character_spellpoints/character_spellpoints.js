import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_spellpoints',
  description: 'Spell points per level per character.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT, nullable: true },
    level: { type: INT, nullable: true },
    max_current: { type: INT, nullable: true },
    current: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
