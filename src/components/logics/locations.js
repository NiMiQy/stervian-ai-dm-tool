import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';
// Get location by character location id
const getLocationByCharacter = async (charLocationId) => {

    try {
        const location = await db.prismaClient.locations.findFirst({
            where: {
                id: charLocationId,
                deleted: false
            },
            include: {
                characters: { where: { character_type: 'NPC', deleted: false }, include: { npc: { include: { npc_monsters: true } } } },
                region: true
            }
        })

        return location ? { ...location, npcs: location.characters } : null;
    }
    catch (error) {
        throw databaseError('getLocationByCharacter', 'read', error);
    }
}

export default { getLocationByCharacter };
