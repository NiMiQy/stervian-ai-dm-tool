import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPrismaClient } from '../shared.js';
import { databaseError } from '../../../../database/databaseError.js';
import { redactPlayerNameFromMemory } from '../../../characterMemoryService.js';
import { retrieveNpcMemories } from '../../../characterMemoryService.js';
import { CHARACTER_TYPE, DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT } from '../../../../configs/constants.js';

export const GENERIC_MONSTER_TERMS = new Set([
  'all', 'npc', 'npcs', 'database', 'id', 'list'
]);

function matchesEntityName(candidateName, requestedName) {
  const candidateWords = String(candidateName || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const requestedWords = String(requestedName || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return requestedWords.length > 0 && candidateWords.some((_, start) =>
    requestedWords.every((word, offset) => candidateWords[start + offset] === word)
  );
}

export const searchWorldNpcTool = tool(
  async ({ name }, config) => {
    try {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return JSON.stringify({ exists: false, message: 'NPC name cannot be empty.' });
      }
      const cleanName = name.trim();

      if (GENERIC_MONSTER_TERMS.has(cleanName.toLowerCase())) {
        return JSON.stringify({
          exists: false,
          searchedName: cleanName,
          error: 'META_SEARCH_BLOCKED',
          message: `Broad catalog searches ('${cleanName}') are not permitted. This tool checks individual NPCs or monsters encountered in the narrative.`
        });
      }

      const db = getPrismaClient(config);

      const matches = await db.characters.findMany({
        where: {
          deleted: false,
          character_type: CHARACTER_TYPE.NPC,
          name: { contains: cleanName }
        },
        include: {
          location: { select: { id: true, name: true } },
          sublocation: { select: { id: true, name: true, sublocation_type: true } },
          npc: { select: { is_attackable: true, is_speakable: true, is_recruitable: true, npc_monsters: true } }
        },
        take: 50
      });
      const match = matches.find((candidate) => matchesEntityName(candidate.name, cleanName));

      if (!match) {
        return JSON.stringify({
          exists: false,
          searchedName: cleanName,
          message: `No canonical NPC or monster named '${cleanName}' exists in the Stervian world records.`
        });
      }

      return JSON.stringify({
        exists: true,
        name: match.name,
        race: match.race || 'Unknown',
        job: match.job || 'NPC',
        alignment: match.alignment || 'Neutral',
        location: match.location?.name || 'Wildlands',
        sublocation: match.sublocation?.name || 'Open Area',
        appearance: match.appearance || 'No distinct appearance registered.',
        description: match.description || '',
        isMonster: Boolean(match.npc?.npc_monsters),
        speakable: match.npc?.is_speakable !== false
      });
    } catch (err) {
      const wrapped = databaseError('searchWorldNpcTool', 'query canonical NPC and monster records', err);
      return JSON.stringify({ error: wrapped.message });
    }
  },
  {
    name: 'search_world_npc',
    description: 'Check whether a specifically named NPC or monster exists in the canonical Stervian world records when the player encounters or addresses them. Never call this for catalogs, lists, broad meta searches, or out-of-character queries. If the named entity is absent, it may still be narrated as fiction.',
    schema: z.object({
      name: z.string().describe('The individual NPC or monster the player encountered or addressed. Do not pass catalogs or broad out-of-character searches.')
    })
  }
);

export const getNpcMemoriesTool = tool(
  async ({ npc_name }, config) => {
    try {
      if (!npc_name || typeof npc_name !== 'string') {
        return JSON.stringify({ found: false, message: 'Invalid NPC name.' });
      }
      const cleanName = npc_name.trim();
      const db = getPrismaClient(config);

      const npc = await db.characters.findFirst({
        where: {
          deleted: false,
          character_type: CHARACTER_TYPE.NPC,
          name: { contains: cleanName }
        },
        select: { id: true, name: true }
      });

      if (!npc) {
        return JSON.stringify({ found: false, message: `NPC '${cleanName}' not found in database.` });
      }

      const activeChar = config?.configurable?.character || null;
      const playerCharacterId = Number(config?.configurable?.characterId || activeChar?.id);
      const relationship = playerCharacterId ? await db.player_npc_relationships.findUnique({
        where: { player_character_id_npc_character_id: { player_character_id: playerCharacterId, npc_character_id: npc.id } },
        select: { affinity: true, is_player_name_revealed: true }
      }) : null;
      const memories = await retrieveNpcMemories({ db, npcCharacterId: npc.id, targetCharacterId: playerCharacterId, affinity: relationship?.affinity || 0, limit: DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT });

      return JSON.stringify({
        found: true,
        npc_name: npc.name,
        memories: memories
          .map((memory) => redactPlayerNameFromMemory(memory.content, activeChar?.name, relationship?.is_player_name_revealed || false))
          .filter(Boolean)
      });
    } catch (err) {
      const wrapped = databaseError('getNpcMemoriesTool', 'fetch NPC memories', err);
      return JSON.stringify({ error: wrapped.message });
    }
  },
  {
    name: 'get_npc_memories',
    description: 'Retrieve persistent memories, past duel outcomes, or rumors stored in the database for a specific NPC.',
    schema: z.object({
      npc_name: z.string().describe('The exact or partial name of the NPC whose memories should be recalled.')
    })
  }
);

export async function inspectCurrentLocation(db, characterId) {
  const targetCharId = Number(characterId);
  if (!targetCharId || isNaN(targetCharId)) {
    return { error: 'Character ID could not be resolved from context.' };
  }
  try {
    const char = await db.characters.findUnique({
      where: { id: targetCharId },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            description: true,
            sublocations: {
              where: { deleted: false },
              select: {
                id: true,
                name: true,
                sublocation_type: true,
                description: true
              },
              orderBy: { id: 'asc' }
            }
          }
        },
        sublocation: {
          include: {
            sublocations_items: {
              where: { deleted: false },
              include: { item: { select: { id: true, name: true, type: true, is_consumable: true, is_material: true } } }
            }
          }
        }
      }
    });

    if (!char) {
      return { error: 'Character not found.' };
    }

    const visibleItems = (char.sublocation?.sublocations_items || [])
      .map((si) => si.item?.name)
      .filter(Boolean);

    const availableSublocations = (char.location?.sublocations || []).map((sub) => ({
      name: sub.name,
      type: sub.sublocation_type || 'DEFAULT',
      description: sub.description || ''
    }));

    if (!char.sublocation) {
      return {
        territory: char.location?.name || 'Wildlands',
        locationDescription: char.location?.description || '',
        isInsideSublocation: false,
        currentSublocation: null,
        environmentStatus: `Outdoors in the open area of ${char.location?.name || 'the area'}. The player is NOT inside any sublocation.`,
        nearbyPointsOfInterest: availableSublocations,
        visibleGroundItems: visibleItems,
        instruction: `The player is currently OUTDOORS in the open area of ${char.location?.name || 'this location'}, NOT inside any sublocation. The nearby points of interest are external buildings and landmarks in the area that the player could choose to enter. Do NOT assume or narrate the player inside any of these buildings.`
      };
    }

    return {
      territory: char.location?.name || 'Wildlands',
      locationDescription: char.location?.description || '',
      isInsideSublocation: true,
      currentSublocation: char.sublocation.name,
      sublocationType: char.sublocation.sublocation_type || 'DEFAULT',
      currentSublocationDescription: char.sublocation.description || '',
      visibleGroundItems: visibleItems,
      otherPlacesInLocation: availableSublocations.filter((sub) => sub.name !== char.sublocation.name),
      instruction: `The player is currently INDOORS inside "${char.sublocation.name}". Confine narration to this interior space. The other places in ${char.location?.name || 'this location'} are elsewhere and not visible from here.`
    };
  } catch (err) {
    const wrapped = databaseError('inspectCurrentLocation', 'inspect current location', err);
    return { error: wrapped.message };
  }
}

export const inspectCurrentLocationTool = tool(
  async ({ character_id }, config) => {
    const db = getPrismaClient(config);
    const activeChar = config?.configurable?.character || null;
    const result = await inspectCurrentLocation(db, character_id || config?.configurable?.characterId || activeChar?.id);
    return JSON.stringify(result);
  },
  {
    name: 'inspect_current_location',
    description: 'Inspect the player\'s current location, all canonical sublocations of that location (e.g. inns, dojos, shops, camps), the current sublocation environment, and visible ground items. Call this tool whenever the player looks around, asks what they can see, arrives in a new area, or explores nearby places.',
    schema: z.object({
      character_id: z.number().optional().describe('The active player character ID (optional; automatically resolved from context if omitted).')
    })
  }
);
