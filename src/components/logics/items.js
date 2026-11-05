import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';

// Get Sellable Items
const getSellableItems = async (count = 20, page = 1, sublocationId = null) => {
    try {
        const size = Math.max(1, Number(count) || 20);
        const currentPage = Math.max(1, Number(page) || 1);
        const skip = (currentPage - 1) * size;
        const items = await db.prismaClient.items.findMany({
            skip: skip,
            take: size,
            select: {
                id: true,
                name: true,
                type: true,
                size: true,
                rarity: true,
                price: true,
                item_bonus: {
                    select: {
                        max_hp_bonus: true,
                        healing_current_hp: true,
                        proficiency_bonus: true,
                        intelligent_bonus: true,
                        strength_bonus: true,
                        dexterity_bonus: true,
                        charisma_bonus: true,
                        constitution_bonus: true,
                        wisdom_bonus: true,
                        armor_bonus: true,
                        magical_armor_bonus: true,
                        physical_attack_bonus: true,
                        magical_attack_bonus: true,
                        effect_resistant_bonus: true,
                        fire_element_resistant: true,
                        ice_element_resistant: true,
                        earth_element_resistant: true,
                        lightning_element_resistant: true,
                        wind_element_resistant: true,
                        holy_element_resistant: true,
                        dark_element_resistant: true,
                        crit_chance_bonus: true,
                        crit_damage_bonus: true,
                    }
                }
            },
            where: {
                is_buyable: true,
                deleted: false,
                ...(sublocationId ? { sublocations_items: { some: { sublocation_id: Number(sublocationId), deleted: false } } } : {})
            },
        });

        return items;
    }
    catch (error) {
        throw databaseError('getSellableItems', 'read', error);
    }
}

// BUY ITEM BY ID
const findItemById = async (itemId) => {
    try {
        const items = await db.prismaClient.items.findFirst({
            select: {
                id: true,
                name: true,
                type: true,
                rarity: true,
                price: true,
                is_stackable: true,
                max_stack: true,
                max_upgrade_level: true,
            },
            where: {
                id: itemId,
                is_buyable: true,
                deleted: false
            },
        });

        return items;
    }
    catch (error) {
        throw databaseError('findItemById', 'read', error);
    }
}

export default { getSellableItems, findItemById };
