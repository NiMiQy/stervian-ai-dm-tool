import { defineTable } from '../core/defineTable.js';
import { MCP_DB_FIELD_TYPE } from '../../../configs/constants.js';

const { BOOLEAN, BYTES, DATE_TIME, ENUM, INT, STRING } = MCP_DB_FIELD_TYPE;

export default defineTable({
  table: 'characters',
  description: 'Players and NPCs: identity, level, position.',
  keys: ['id'],
  fields: {
    id: { type: INT },
    user_id: { type: STRING, nullable: true },
    character_type: { type: ENUM, values: ['PLAYER', 'NPC'] },
    level: { type: INT, nullable: true },
    name: { type: STRING, nullable: true },
    race: { type: STRING, nullable: true },
    age: { type: INT, nullable: true },
    job: { type: STRING, nullable: true },
    sex: { type: ENUM, values: ['MALE', 'FEMALE', 'OTHER'], nullable: true },
    alignment: { type: STRING, nullable: true },
    appearance: { type: STRING, nullable: true },
    description: { type: STRING, nullable: true },
    location_id: { type: INT, nullable: true },
    sublocation_id: { type: INT, nullable: true },
    current_exp: { type: INT, nullable: true },
    respawn_location_id: { type: INT, nullable: true },
    is_updated_by_user: { type: BOOLEAN, nullable: true },
    image_data: { type: BYTES, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true },
    deleted: { type: BOOLEAN, nullable: true }
  }
});
