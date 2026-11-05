import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, FLOAT, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'item_bonus',
  description: 'Stat and consume bonuses attached to items.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    item_id: { type: INT },
    item_trigger_type: { type: ENUM, values: ['NONE', 'ON_START_OF_TURN', 'ON_END_OF_TURN', 'AT_TURN_NUMBER', 'EVERY_TURN'], nullable: true },
    consume_bonus_mode: { type: ENUM, values: ['NONE', 'TEMPORARY', 'PERMANENT_ONCE'] },
    max_hp_bonus: { type: INT, nullable: true },
    healing_current_hp: { type: INT, nullable: true },
    cure_effect_type: { type: ENUM, values: ['NONE', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON'], nullable: true },
    current_food_bonus: { type: INT, nullable: true },
    current_water_bonus: { type: INT, nullable: true },
    current_energy_bonus: { type: INT, nullable: true },
    proficiency_bonus: { type: INT, nullable: true },
    intelligent_bonus: { type: INT, nullable: true },
    strength_bonus: { type: INT, nullable: true },
    dexterity_bonus: { type: INT, nullable: true },
    charisma_bonus: { type: INT, nullable: true },
    constitution_bonus: { type: INT, nullable: true },
    wisdom_bonus: { type: INT, nullable: true },
    physical_attack_bonus: { type: INT, nullable: true },
    magical_attack_bonus: { type: INT, nullable: true },
    armor_bonus: { type: INT, nullable: true },
    magical_armor_bonus: { type: INT, nullable: true },
    effect_resistant_bonus: { type: INT, nullable: true },
    fire_element_resistant: { type: INT, nullable: true },
    ice_element_resistant: { type: INT, nullable: true },
    earth_element_resistant: { type: INT, nullable: true },
    lightning_element_resistant: { type: INT, nullable: true },
    wind_element_resistant: { type: INT, nullable: true },
    holy_element_resistant: { type: INT, nullable: true },
    dark_element_resistant: { type: INT, nullable: true },
    crit_chance_bonus: { type: FLOAT, nullable: true },
    crit_damage_bonus: { type: FLOAT, nullable: true },
    evade_chance_bonus: { type: FLOAT, nullable: true },
    accuracy_bonus: { type: FLOAT, nullable: true },
    buff_duration_minutes: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
