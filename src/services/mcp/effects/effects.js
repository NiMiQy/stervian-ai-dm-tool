import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'effects',
  description: 'Status effect definitions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    effect_type: { type: ENUM, values: ['NONE', 'BUFF', 'CURE', 'HEALING', 'RECOVERY', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON', 'HUNGRY', 'STARVING', 'STARVATION', 'THIRSTY', 'DEHYDRATED', 'SEVERE_DEHYDRATION', 'TAUNT'], nullable: true },
    effect_trigger: { type: ENUM, values: ['NONE', 'SELF_ONLY', 'ALL_PARTY_MEMBERS', 'ON_SELECTED_ALLY', 'ON_SELECTED_ENEMY', 'ALL_ENEMIES', 'TO_ALL'], nullable: true },
    description: { type: STRING, nullable: true },
    duration: { type: INT, nullable: true },
    lost_hp_per_turn: { type: INT, nullable: true },
    is_stackable: { type: BOOLEAN, nullable: true },
    max_stack_count: { type: INT, nullable: true },
    is_extendable: { type: BOOLEAN, nullable: true },
    extend_duration: { type: INT, nullable: true },
    is_dispellable: { type: BOOLEAN, nullable: true },
    is_debuff: { type: BOOLEAN, nullable: true },
    applied_value: { type: INT, nullable: true },
    proc_chance: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
