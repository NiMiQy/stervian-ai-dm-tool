import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'skill_effects',
  description: 'Effects applied by skills.',
  keys: ['skill_id', 'effect_id'],
  fields: {
    skill_id: { type: INT },
    effect_id: { type: INT },
    duration: { type: INT, nullable: true },
    healing_current_hp: { type: INT, nullable: true },
    is_stun_cure: { type: BOOLEAN, nullable: true },
    is_daze_cure: { type: BOOLEAN, nullable: true },
    is_weak_cure: { type: BOOLEAN, nullable: true },
    is_blind_cure: { type: BOOLEAN, nullable: true },
    is_poison_cure: { type: BOOLEAN, nullable: true },
    is_cure_all: { type: BOOLEAN, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
