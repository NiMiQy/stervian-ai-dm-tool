import db from '../../database/database.js';
import character from './character.js';
import { databaseError } from '../../database/databaseError.js';

// Get Character inventory
const getCharacterInventory = async (characterId) => {
    try {
        return await db.prismaClient.character_inventory.findUnique({
            where: { character_id: characterId },
            include: {
                item_inventory: {
                    where: { deleted: false },
                    include: { item: { select: { id: true, name: true, type: true, rarity: true, size: true, is_stackable: true, is_consumable: true, is_material: true, item_bonus: true } }, prefix: true, suffix: true }
                }
            }
        });
    } catch (error) {
        throw databaseError('getCharacterInventory', 'read', error);
    }
};

export default { getCharacterInventory };
