import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { imageDataToUrl } from '../components/helpers/imageData.js';
import { CHARACTER_TYPE, PARTY_STATUS } from '../configs/constants.js';

/**
 * Return non-monster NPCs whose appearance scope matches the player's current
 * location. A sublocation takes precedence over its parent location.
 */
export async function getNearbyNpcs(userId) {
  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { location_id: true, sublocation_id: true }
    });

    if (!character) return [];

    const scope = character.sublocation_id
      ? { sublocation_id: character.sublocation_id }
      : character.location_id
        ? { location_id: character.location_id, sublocation_id: null }
        : null;

    if (!scope) return [];

    const appearances = await prisma.npcs_in_locations_or_sublocations.findMany({
      where: {
        deleted: false,
        ...scope,
        npc: {
          is: {
            deleted: false,
            npc_monsters: { is: null },
            character: {
              is: {
                deleted: false,
                character_type: CHARACTER_TYPE.NPC
              }
            }
          }
        }
      },
      select: {
        npc: {
          select: {
            character_id: true,
            is_recruitable: true,
            is_speakable: true,
            character: {
              select: {
                id: true,
                name: true,
                race: true,
                job: true,
                appearance: true,
                image_data: true
              }
            }
          }
        }
      }
    });

    const playerCharacter = await prisma.characters.findUnique({ where: { user_id: userId }, select: { id: true } });
    const npcIds = appearances.map(({ npc }) => npc?.character_id).filter(Boolean);
    const membership = playerCharacter
      ? await prisma.party_members.findFirst({
        where: { character_id: playerCharacter.id, deleted: false, party: { status: PARTY_STATUS.ACTIVE, deleted: false } },
        select: { party: { select: { members: { where: { deleted: false }, select: { character_id: true } } } } }
      })
      : null;
    const watchedCharacterIds = [...new Set([playerCharacter?.id, ...(membership?.party?.members || []).map((member) => member.character_id)].filter(Boolean))];
    const revealedRows = watchedCharacterIds.length && npcIds.length
      ? await prisma.player_npc_relationships.findMany({
        where: { player_character_id: { in: watchedCharacterIds }, npc_character_id: { in: npcIds }, is_player_name_revealed: true, deleted: { not: true } },
        select: { npc_character_id: true, player_character_id: true }
      })
      : [];
    const revealedNpcIds = new Set(revealedRows.filter((row) => row.player_character_id === playerCharacter?.id).map((row) => row.npc_character_id));
    const revealedByNpc = new Map();
    for (const row of revealedRows) revealedByNpc.set(row.npc_character_id, [...(revealedByNpc.get(row.npc_character_id) || []), row.player_character_id]);

    const uniqueNpcs = new Map();
    appearances.forEach(({ npc }) => {
      if (!npc?.character || uniqueNpcs.has(npc.character_id)) return;
      uniqueNpcs.set(npc.character_id, {
        id: npc.character_id,
        name: npc.character.name || 'Unnamed NPC',
        race: npc.character.race || null,
        job: npc.character.job || null,
        appearance: npc.character.appearance || null,
        image_data: imageDataToUrl(npc.character.image_data),
        is_recruitable: Boolean(npc.is_recruitable),
        is_speakable: Boolean(npc.is_speakable),
        name_revealed: revealedNpcIds.has(npc.character_id),
        revealed_character_ids: revealedByNpc.get(npc.character_id) || []
      });
    });

    return [...uniqueNpcs.values()];
  } catch (error) {
    throw databaseError('getNearbyNpcs', 'read', error);
  }
}

export async function getMetNpcs(userId) {
  try {
    const playerCharacter = await prisma.characters.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!playerCharacter) return [];
    const rows = await prisma.player_npc_relationships.findMany({
      where: { player_character_id: playerCharacter.id, deleted: { not: true } },
      select: { npc_character_id: true }
    });
    const npcIds = [...new Set(rows.map((row) => row.npc_character_id).filter(Boolean))];
    if (!npcIds.length) return [];
    const npcs = await prisma.characters.findMany({
      where: { id: { in: npcIds }, deleted: false, character_type: CHARACTER_TYPE.NPC },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    return npcs.map((npc) => ({ id: npc.id, name: npc.name }));
  } catch (error) {
    throw databaseError('getMetNpcs', 'read', error);
  }
}

export async function getAllKnownNpcs() {
  try {
    const list = await prisma.npcs.findMany({
      where: {
        deleted: false,
        is_speakable: true,
        npc_monsters: { is: null },
        character: {
          is: {
            deleted: false
          }
        }
      },
      select: {
        character_id: true,
        is_recruitable: true,
        is_speakable: true,
        character: {
          select: {
            id: true,
            name: true,
            race: true,
            job: true,
            appearance: true,
            image_data: true
          }
        }
      }
    });

    return list.map(({ character_id, is_recruitable, is_speakable, character }) => ({
      id: character_id,
      name: character.name || 'Unnamed NPC',
      race: character.race || null,
      job: character.job || null,
      appearance: character.appearance || null,
      image_data: imageDataToUrl(character.image_data),
      is_recruitable: Boolean(is_recruitable),
      is_speakable: Boolean(is_speakable)
    }));
  } catch (error) {
    throw databaseError('getAllKnownNpcs', 'read', error);
  }
}
