import db from '../../database/database.js';
import { databaseError } from '../../database/databaseError.js';

// User registration
const userRegistration = async (userData) => {
    try {
        const newUser = await db.prismaClient.users.create({
            data: {
                username: userData.username,
                password: userData.password,
                created_at: userData.created_at,
                character: {
                    create: {
                        created_at: userData.created_at,
                        updated_at: userData.created_at,
                        character_stat: {
                            create: {
                                created_at: userData.created_at,
                                updated_at: userData.created_at,
                            }
                        },
                        character_spellpoints: {
                            create: {
                                level: 1,
                                max_current: 2,
                                current: 2
                            }
                        },
                        character_lifeskills: {
                            create: [
                                {
                                    lifeskill_id: 1,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 2,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 3,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 4,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 5,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 6,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 7,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 8,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 9,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                                {
                                    lifeskill_id: 10,
                                    created_at: userData.created_at,
                                    updated_at: userData.created_at,
                                },
                            ]
                        },
                        character_equipment: {
                            create: {
                                created_at: userData.created_at,
                                updated_at: userData.created_at,
                            }
                        },
                        character_inventory: {
                            create: {
                                created_at: userData.created_at,
                                updated_at: userData.created_at,
                            }
                        }
                    }
                }
            },
            include: {
                character: {
                    include: {
                        character_stat: true,
                        character_lifeskills: true,
                        character_spellpoints: true,
                        character_inventory: true,
                        character_equipment: true,
                        character_owner_memories: true,
                    }
                },
            }
        });
        const character = newUser.character;
        if (character) character.character_memories = character.character_owner_memories || [];
        if (character?.id && character.character_equipment_id) await db.prismaClient.character_equipments.update({ where: { id: character.character_equipment_id }, data: { character_id: character.id } });
        return newUser;
    } catch (error) {
        throw databaseError('userRegistration', 'register', error);
    };
}

export default { userRegistration };
