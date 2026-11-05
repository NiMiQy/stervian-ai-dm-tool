import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';

// Get Character information
const getNPC = async (npcId) => {
    try {
        const character = await db.prismaClient.characters.findUnique({
            where: { id: npcId },
            include: {
                npc: { include: { npc_monsters: true } },
            }
        });
        return character?.deleted || character?.npc?.deleted ? null : character;
    } catch (error) {
        throw databaseError('getNPC', 'read', error);
    };
}

// Get character by npcid and character's location id 
const getNPCByCharacterLocation = async (npcId, characterLocationId) => {
    try {
        const npc = await db.prismaClient.characters.findFirst({
            where: { id: npcId, location_id: characterLocationId, deleted: false, npc: { deleted: false } },
            include: {
                npc: { include: { npc_monsters: true } },
                location: {
                    include: {
                        region: true,
                    }
                },
            }
        });
        return npc;
    } catch (error) {
        throw databaseError('getNPCByCharacterLocation', 'read', error);
    };
}

// Create NPC
const createNPC = async (data) => {
    try {
        const character = await db.prismaClient.characters.create({
            data: { ...data, character_type: 'NPC', npc: { create: data.npc || {} } },
            include: {
                npc: { include: { npc_monsters: true } },
            }
        });
        return character;
    } catch (error) {
        throw databaseError('createNPC', 'create', error);
    };
}

export default { getNPC, createNPC, getNPCByCharacterLocation };
