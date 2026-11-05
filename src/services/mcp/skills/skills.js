import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, FLOAT, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'skills',
  description: 'Skill definitions.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    name: { type: STRING, nullable: true },
    type: { type: ENUM, values: ['ATTACK', 'MAGIC_ATTACK', 'DEFEND', 'SPELL'] },
    rarity: { type: ENUM, values: ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'] },
    skill_target_rule: { type: ENUM, values: ['SELF_ONLY', 'ALL_PARTY_MEMBERS', 'ON_SELECTED_ALLY', 'ON_SELECTED_ENEMY', 'ALL_ENEMIES', 'TO_ALL'] },
    skill_damage_type: { type: ENUM, values: ['PHYSICAL', 'MAGICAL', 'HYBRID'] },
    healing_current_hp: { type: INT, nullable: true },
    cure_effect_type: { type: ENUM, values: ['NONE', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON'], nullable: true },
    attack_amplifier: { type: FLOAT, nullable: true },
    aggro_multiplier: { type: FLOAT, nullable: true },
    magical_attack_amplifier: { type: FLOAT, nullable: true },
    armor_amplifier: { type: FLOAT, nullable: true },
    magical_armor_amplifier: { type: FLOAT, nullable: true },
    fire_damage: { type: INT, nullable: true },
    ice_damage: { type: INT, nullable: true },
    earth_damage: { type: INT, nullable: true },
    lightning_damage: { type: INT, nullable: true },
    wind_damage: { type: INT, nullable: true },
    holy_damage: { type: INT, nullable: true },
    dark_damage: { type: INT, nullable: true },
    energy_consume_cost: { type: INT, nullable: true },
    duration: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
