import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';
// Relation characters, character_stats, character_inventory(inventory_items), character_equiments, character_lifeskills, character_memories, character_spellpoints, 
// Get Character information
const getCharacter = async (userId) => {
    try {
        const character = await db.prismaClient.characters.findUnique({
            where: { user_id: userId },
            include: {
                character_stat: true,
                player: true,
                character_inventory: {
                    where: { deleted: false },
                    include: {
                        item_inventory: { where: { deleted: false }, include: { item: { include: { item_bonus: true } }, prefix: true, suffix: true } }
                    }
                },
                character_spellpoints: { where: { deleted: false } },
                character_equipment: {
                    select: {
                        helmet: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        armor: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        gloves: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        shoes: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        left_hand: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        right_hand: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        left_earring: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        right_earring: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        left_ring: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        right_ring: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        necklace: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                        belt: {
                            select: {
                                name: true,
                                type: true,
                                rarity: true,
                                item_bonus: true,
                            }
                        },
                    }
                },
                character_lifeskills: { where: { deleted: false }, include: { lifeskill: true } },
                character_owner_memories: { where: { deleted: false } },
                location: true,
                respawn_location: true,
            }
        });
        if (character) character.character_memories = character.character_owner_memories || [];
        return character;
    } catch (error) {
        throw databaseError('getCharacter', 'read', error);
    };
}

// Character registration
const characterStatUpdate = async (userId, data, statToIncrease) => {
    console.log(data);
    // '1.INT, 2.STR, 3.DEX, 4.CHA, 5.CON, 6.WIS',
    let updateObj = {}
    if (statToIncrease === 1) {
        updateObj = {
            player: { update: { current_point_spend: data.left_point_spend } },
            character_stat: {
                update: {
                    [data.column]: data.character_stat_after_increase,
                    magic_armor: data.nextMagicArmorStat,
                }
            }
        }
    }
    if (statToIncrease === 2) {
        updateObj = {
            player: { update: { current_point_spend: data.left_point_spend } },
            character_stat: {
                update: {
                    [data.column]: data.character_stat_after_increase,
                    armor: data.nextArmorStat,
                }
            }
        }
    }
    if (statToIncrease === 3) {
        updateObj = {
            player: { update: { current_point_spend: data.left_point_spend } },
            character_stat: {
                update: {
                    [data.column]: data.character_stat_after_increase,
                    armor: data.nextArmorStat,
                }
            }
        }
    }
    if (statToIncrease === 4) {
        updateObj = {
            player: { update: { current_point_spend: data.left_point_spend } },
            character_stat: {
                update: {
                    [data.column]: data.character_stat_after_increase,
                }
            }
        }
    }
    if (statToIncrease === 5) {
        updateObj = {
            player: { update: { current_point_spend: data.left_point_spend } },
            character_stat: {
                update: {
                    [data.column]: data.character_stat_after_increase,
                    max_hp: data.nextHPStat,
                    max_energy: data.nextEneStat,
                    status_resistant: data.nextStatusResStat,
                }
            }
        }
    }
    if (statToIncrease === 6) {
        updateObj = {
            player: { update: { current_point_spend: data.left_point_spend } },
            character_stat: {
                update: {
                    [data.column]: data.character_stat_after_increase,
                    fire_element_resistant: data.nextFireElementResStat ?? data.nextElementResStat,
                    ice_element_resistant: data.nextIceElementResStat ?? data.nextElementResStat,
                    earth_element_resistant: data.nextEarthElementResStat ?? data.nextElementResStat,
                    lightning_element_resistant: data.nextLightningElementResStat ?? data.nextElementResStat,
                    wind_element_resistant: data.nextWindElementResStat ?? data.nextElementResStat,
                    holy_element_resistant: data.nextHolyElementResStat ?? data.nextElementResStat,
                    dark_element_resistant: data.nextDarkElementResStat ?? data.nextElementResStat,
                }
            }
        }
    }

    try {
        const updateCharacter = await db.prismaClient.characters.update({
            where: {
                user_id: userId
            },
            data: updateObj
        });
        return updateCharacter;
    } catch (error) {
        throw databaseError('characterStatUpdate', 'update', error);
    };
}

// Character registration
const characterUpdate = async (userId, data) => {
    try {
        data.is_updated_by_user = true;
        const updateCharacter = await db.prismaClient.characters.update({
            where: {
                user_id: userId
            },
            data: data
        });
        return updateCharacter;
    } catch (error) {
        throw databaseError('characterUpdate', 'update', error);
    };
}

// Gold update
const goldUpdate = async (characterId, goldNum) => {
    try {
        const updateCharacter = await db.prismaClient.characters.update({
            where: {
                id: characterId
            },
            data: {
                player: { update: { gold: goldNum } }
            }
        });
        return updateCharacter;
    } catch (error) {
        throw databaseError('goldUpdate', 'update', error);
    };
}

// level up character
const levelUpCharacter = async (characterId, { level, spend_point, max_hp }) => {
    try {
        const updatedCharacter = await db.prismaClient.characters.update({
            where: { id: characterId },
            data: {
                level: level,
                player: { update: { current_point_spend: spend_point } },
                character_stat: {
                    update: {
                        max_hp: max_hp,
                    },
                },
            },
        });
        return updatedCharacter;
    } catch (error) {
        throw databaseError('levelUpCharacter', 'update', error);
    }
};

export default { characterUpdate, getCharacter, characterStatUpdate, goldUpdate, levelUpCharacter };
