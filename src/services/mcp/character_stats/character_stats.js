import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, FLOAT, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'character_stats',
  description: 'Base stats, HP, energy, food and water per character.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    character_id: { type: INT },
    proficiency: { type: INT, nullable: true },
    intelligent: { type: INT, nullable: true },
    strength: { type: INT, nullable: true },
    dexterity: { type: INT, nullable: true },
    charisma: { type: INT, nullable: true },
    constitution: { type: INT, nullable: true },
    wisdom: { type: INT, nullable: true },
    armor: { type: INT, nullable: true },
    magic_armor: { type: INT, nullable: true },
    fire_element_resistant: { type: INT, nullable: true },
    ice_element_resistant: { type: INT, nullable: true },
    earth_element_resistant: { type: INT, nullable: true },
    lightning_element_resistant: { type: INT, nullable: true },
    wind_element_resistant: { type: INT, nullable: true },
    holy_element_resistant: { type: INT, nullable: true },
    dark_element_resistant: { type: INT, nullable: true },
    status_resistant: { type: INT, nullable: true },
    accuracy: { type: INT, nullable: true },
    max_hp: { type: INT, nullable: true },
    current_hp: { type: INT, nullable: true },
    max_energy: { type: INT, nullable: true },
    current_energy: { type: INT, nullable: true },
    max_food: { type: INT },
    current_food: { type: INT },
    max_water: { type: INT },
    current_water: { type: INT },
    base_crit_chance: { type: FLOAT, nullable: true },
    base_crit_damage: { type: FLOAT, nullable: true },
    ambush_energy_spent: { type: INT, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
