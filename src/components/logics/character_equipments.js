import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';

const characterEquipmentWhere = (characterId) => ({
    deleted: false,
    OR: [
        { character_id: characterId },
        { characters: { some: { id: characterId, deleted: false } } }
    ]
});

// Get equipment
const getEquipment = async (characterId, columnName) => {
    try {
        const equipment = await db.prismaClient.character_equipments.findFirst({
            select: {
                [columnName]: {
                    select: {
                        id: true,
                        type: true
                    }
                },
            },
            where: characterEquipmentWhere(characterId)
        });

        return equipment;
    }
    catch (error) {
        throw databaseError('getEquipment', 'read', error);
    }
}

// Get all equipments
const getEquipments = async (characterId) => {
    try {
        const equipments = await db.prismaClient.character_equipments.findFirst({
            select: {
                helmet: { include: { item_bonus: true } }, armor: { include: { item_bonus: true } },
                gloves: { include: { item_bonus: true } }, shoes: { include: { item_bonus: true } },
                left_earring: { include: { item_bonus: true } }, right_earring: { include: { item_bonus: true } },
                left_ring: { include: { item_bonus: true } }, right_ring: { include: { item_bonus: true } },
                necklace: { include: { item_bonus: true } }, belt: { include: { item_bonus: true } },
                left_hand: { include: { item_bonus: true } }, right_hand: { include: { item_bonus: true } }
            },
            where: characterEquipmentWhere(characterId),
        });

        return equipments;
    }
    catch (error) {
        throw databaseError('getEquipments', 'read', error);
    }
}

// Set equipment
const setEquipment = async (characterId, columnName, itemId) => {
    try {
        const current = await db.prismaClient.character_equipments.findFirst({ where: characterEquipmentWhere(characterId), select: { id: true } });
        if (!current) return null;
        const set = await db.prismaClient.character_equipments.update({
            where: { id: current.id },
            data: {
                [columnName]: itemId
            }
        });

        return set;
    }
    catch (error) {
        throw databaseError('setEquipment', 'update', error);
    }
}

// Unset equipment
const unsetEquipment = async (characterId, columnName) => {
    try {
        const current = await db.prismaClient.character_equipments.findFirst({ where: characterEquipmentWhere(characterId), select: { id: true } });
        if (!current) return null;
        const unset = await db.prismaClient.character_equipments.update({
            where: { id: current.id },
            data: {
                [columnName]: null
            }
        });

        return unset;
    }
    catch (error) {
        throw databaseError('unsetEquipment', 'update', error);
    }
}

export default { setEquipment, getEquipments, getEquipment, unsetEquipment };
