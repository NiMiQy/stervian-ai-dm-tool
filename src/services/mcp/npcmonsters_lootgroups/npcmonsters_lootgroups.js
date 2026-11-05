import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'npcmonsters_lootgroups',
  description: 'Loot groups dropped by monsters.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    npc_monster_id: { type: INT, nullable: true },
    loot_group_id: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
