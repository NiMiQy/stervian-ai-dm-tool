import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { ENUM, INT } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'skill_weapon_types',
  description: 'Weapon types a skill requires.',
  keys: ['skill_id', 'weapon_type'],
  fields: {
    skill_id: { type: INT },
    weapon_type: { type: ENUM, values: ['NONE', 'ANY_WEAPON', 'SWORD', 'BOW', 'STAFF', 'QUARTERSTAFF', 'AXE', 'SPEAR', 'CLUB', 'GREATSWORD', 'SHORTSWORD', 'KNIFE', 'SHIELD'] }
  }
});
