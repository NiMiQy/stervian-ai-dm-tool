import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { DATE_TIME, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'ambience_figures',
  description: 'Crowd figures that can appear in an ambience.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    ambience_id: { type: INT },
    label: { type: STRING },
    weight: { type: INT },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});
