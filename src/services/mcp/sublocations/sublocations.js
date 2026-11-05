import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'sublocations',
  description: 'Places inside locations (inns, shops, dungeons).',
  keys: ['id'],
  fields: {
    id: { type: INT },
    location_id: { type: INT, nullable: true },
    name: { type: STRING },
    description: { type: STRING },
    owner_id: { type: INT, nullable: true },
    long_rest_price: { type: INT },
    food_water_refill_price: { type: INT },
    sublocation_type: { type: ENUM, values: ['DEFAULT', 'SECRET_HIDEOUT', 'HOUSE', 'CASTLE', 'MANSION', 'GUILD_OFFICE', 'ALLEY', 'SQUARE', 'INN', 'SHOP'] },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true },
    is_sheltered: { type: BOOLEAN }
  }
});
