import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';

const getRegions = async () => {
    try {
        const regions = await db.prismaClient.regions.findMany({
            where: {
                deleted: false
            },
            include: {
                locations: {
                    include: {
                        characters: {
                            where: { character_type: 'NPC', deleted: false },
                            include: { npc: { include: { npc_monsters: true } } }
                        }
                    }
                }
            }
        })

        return regions.map((region) => ({
            ...region,
            locations: region.locations.map((location) => ({ ...location, npcs: location.characters }))
        }));
    }
    catch (error) {
        throw databaseError('getRegions', 'read', error);
    }
}

export default { getRegions };
