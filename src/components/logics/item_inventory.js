import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';

const positiveInt = (value, fallback = 1) => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : fallback));

async function getInventoryContext(client, inventoryId, itemId) {
    const inventory = await client.character_inventory.findUnique({
        where: { id: inventoryId },
        select: { id: true, max_slots: true, deleted: true, item_inventory: { where: { deleted: false }, select: { id: true, item_id: true, quantity: true } } }
    });
    const item = await client.items.findUnique({ where: { id: itemId }, select: { id: true, is_stackable: true, max_stack: true, deleted: true } });
    if (!inventory || inventory.deleted || !item || item.deleted) return null;
    return { inventory, item, maxStack: item.is_stackable ? positiveInt(item.max_stack, 1) : 1 };
}

// Add item to character inventory
const addItemToCharacterInventory = async (characterInventoryId, itemId, itemQuantity) => {
    try {
        return await db.prismaClient.$transaction(async (tx) => {
            const context = await getInventoryContext(tx, characterInventoryId, itemId);
            if (!context) return { error: 'Inventory or item not found.' };
            let remaining = Math.max(1, positiveInt(itemQuantity));
            const rows = [...context.inventory.item_inventory.filter((entry) => entry.item_id === itemId)];
            for (const row of rows) {
                if (remaining <= 0) break;
                const room = context.maxStack - positiveInt(row.quantity, 0);
                if (room <= 0) continue;
                const added = Math.min(room, remaining);
                await tx.item_inventory.update({ where: { id: row.id }, data: { quantity: { increment: added } } });
                remaining -= added;
            }
            const usedSlots = context.inventory.item_inventory.length;
            let freeSlots = Math.max(0, positiveInt(context.inventory.max_slots, 40) - usedSlots);
            while (remaining > 0 && freeSlots > 0) {
                const quantity = Math.min(context.maxStack, remaining);
                await tx.item_inventory.create({ data: { inventory_id: characterInventoryId, item_id: itemId, quantity } });
                remaining -= quantity;
                freeSlots -= 1;
            }
            return { added: positiveInt(itemQuantity) - remaining, remaining, inventory_id: characterInventoryId, item_id: itemId };
        });
    }
    catch (error) {
        throw databaseError('addItemToCharacterInventory', 'create', error)
    }
}

// Add exists item to character inventory
const addItemToCharacterInventoryExists = async (characterInventoryId, itemId, itemQuantity) => {
    try { return await addItemToCharacterInventory(characterInventoryId, itemId, itemQuantity); }
    catch (error) { throw databaseError('addItemToCharacterInventoryExists', 'update', error); }
}

// Get item in character inventory
const getItemInCharacterInventory = async (characterInventoryId, itemId) => {
    try {
        const items = await db.prismaClient.item_inventory.findMany({
            select: {
                item_id: true,
                quantity: true,
                item: {
                    select: {
                        price: true,
                        size: true,
                    }
                },
            },
            where: {
                inventory_id: characterInventoryId,
                item_id: itemId,
                deleted: false
            },
        });

        return items;
    }
    catch (error) {
        throw databaseError('getItemInCharacterInventory', 'read', error)
    }
}

// Remove item in character inventory
const removeItemInCharacterInventory = async (characterInventoryId, itemId) => {
    try {
        const findFirst = await db.prismaClient.item_inventory.findFirst({
            where: {
                inventory_id: characterInventoryId,
                item_id: itemId,
                is_equipped: false,
                deleted: false,
            }
        });
        if (!findFirst) {
            return false;
        }
        const remove = await db.prismaClient.item_inventory.update({
            where: { id: findFirst.id },
            data: {
                updated_at: new Date(),
                deleted: true
            }
        });

        return remove;
    }
    catch (error) {
        throw databaseError('removeItemInCharacterInventory', 'delete', error)
    }
}

// Remove item in character inventory with many quantity
const removeItemInCharacterInventoryQuantity = async (characterInventoryId, itemId, quantity) => {
    try {
        const remove = await db.prismaClient.item_inventory.updateMany({
            where: {
                inventory_id: characterInventoryId,
                item_id: itemId,
                deleted: false
            },
                data: { quantity: { decrement: quantity }, updated_at: new Date() }
        });

        return remove;
    }
    catch (error) {
        throw databaseError('removeItemInCharacterInventoryQuantity', 'update', error)
    }
}

// Get item equipment type in character inventory
const getItemEquipmentInCharacterInventory = async (characterInventoryId, itemId) => {
    try {
        const item = await db.prismaClient.item_inventory.findFirst({
            select: {
                id: true,
                item_id: true,
                is_equipped: true,
                item: {
                    select: {
                        type: true,
                    }
                }
            },
            where: {
                inventory_id: characterInventoryId,
                item_id: itemId,
                item: {
                    type: { notIn: ['QUEST_ITEMS', 'MISCS', 'FOOD', 'FISH', 'POTION'] },
                    is_consumable: false,
                    is_material: false
                },
                deleted: false
            }
        });

        return item;
    } catch (error) {
        throw databaseError('getItemEquipmentInCharacterInventory', 'read', error)
    }
}

// Update flag is_equip for not equipped item in inventory
const updateFlagIsEquip = async (itemInventoryId, characterInventoryId, itemId) => {
    try {
        const item = await db.prismaClient.item_inventory.update({
            where: {
                id: itemInventoryId,
                inventory_id: characterInventoryId,
                item_id: itemId,
                is_equipped: false,
                deleted: false
            },
            data: {
                is_equipped: true
            }
        });

        return item;
    } catch (error) {
        throw databaseError('updateFlagIsEquip', 'update', error)
    }
}

// Update flag is_equip to false for current equipped item in inventory
const updateFlagIsEquipCurrentItem = async (characterInventoryId, itemId) => {
    try {
        const item = await db.prismaClient.item_inventory.updateMany({
            where: {
                inventory_id: characterInventoryId,
                item_id: itemId,
                is_equipped: true,
                deleted: false
            },
            data: {
                is_equipped: false
            }
        });

        return item;
    } catch (error) {
        throw databaseError('updateFlagIsEquipCurrentItem', 'update', error)
    }
}

export default { addItemToCharacterInventory, addItemToCharacterInventoryExists, getItemInCharacterInventory, removeItemInCharacterInventory, removeItemInCharacterInventoryQuantity, getItemEquipmentInCharacterInventory, updateFlagIsEquip, updateFlagIsEquipCurrentItem };
