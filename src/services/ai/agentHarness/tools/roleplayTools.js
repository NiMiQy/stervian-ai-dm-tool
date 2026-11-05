import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPrismaClient } from '../shared.js';
import { getNpcSocialAndSpatialContext, npcRelationshipManager, npcRoleplaySubagent } from '../../subagents/index.js';
import { retrieveNpcMemories, redactPlayerNameFromMemory } from '../../../characterMemoryService.js';
import { ensurePartyRelationships, getNpcIdentity, maskUnrevealedName, nameNpcUses } from '../../../npcIdentityService.js';
import { resolvePartyLabels } from '../../../partyTurnService.js';
import { getRecentDialogueMessages } from '../../../../containers/dialogueContainer.js';
import { databaseError } from '../../../../database/databaseError.js';
import { getNsfwAccess } from '../../../nsfwAccessService.js';
import { formatPlayerToolResultsForRoleplay } from '../../../playerToolService.js';
import {
  CHARACTER_TYPE,
  DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT,
  DIALOGUE_MESSAGE_TYPE,
  NPC_ROLE,
  ROLEPLAY_HISTORY_MESSAGE_MAX_LENGTH,
  ROLEPLAY_HISTORY_NARRATION_EXCERPT_LENGTH,
  ROLEPLAY_HISTORY_MESSAGES,
  UNREVEALED_PLAYER_NAME
} from '../../../../configs/constants.js';

const SPEAKER_LINE_PATTERN = /^\[Speaker:\s*([^\]]+)\]:\s*(.+)$/;

function clipText(text, maxLength) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

function narrationToHistoryLines(content) {
  const paragraphs = String(content || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const speech = [];
  const prose = [];
  for (const paragraph of paragraphs) {
    const match = paragraph.match(SPEAKER_LINE_PATTERN);
    if (match) speech.push(`${match[1].trim()}: ${clipText(match[2], ROLEPLAY_HISTORY_MESSAGE_MAX_LENGTH)}`);
    else prose.push(paragraph);
  }
  if (!speech.length) return prose.length ? [`Narration: ${clipText(prose.join(' '), ROLEPLAY_HISTORY_MESSAGE_MAX_LENGTH)}`] : [];
  return [
    ...(prose.length ? [`Narration: ${clipText(prose[0], ROLEPLAY_HISTORY_NARRATION_EXCERPT_LENGTH)}`] : []),
    ...speech
  ];
}

function buildRecentDialogue(messages, { playerLabel, maskName }) {
  const lines = [];
  for (const message of messages) {
    const content = maskName(message.content);
    if (!content.trim()) continue;
    if (message.message_type === DIALOGUE_MESSAGE_TYPE.NARRATION) {
      lines.push(...narrationToHistoryLines(content));
    } else {
      lines.push(`${playerLabel}: ${clipText(content, ROLEPLAY_HISTORY_MESSAGE_MAX_LENGTH)}`);
    }
  }
  return lines;
}

async function loadRecentDialogue(db, config, { partyMode, partyTurn, activeChar, nameRevealed, playerKnownName }) {
  const sessionId = config?.configurable?.turnContext?.dialogueSession?.id || null;
  if (!sessionId) return [];
  try {
    const messages = await getRecentDialogueMessages(sessionId, ROLEPLAY_HISTORY_MESSAGES, db);
    if (!messages.length) return [];
    if (partyMode && partyTurn) {
      const hidden = partyTurn.speakers.filter((speaker) => !speaker.nameRevealed && speaker.realName);
      return buildRecentDialogue(messages, {
        playerLabel: 'The party',
        maskName: (text) => hidden.reduce((result, speaker) => maskUnrevealedName(result, speaker.realName, speaker.subagentLabel || UNREVEALED_PLAYER_NAME), String(text || ''))
      });
    }
    const playerLabel = playerKnownName || 'The stranger';
    return buildRecentDialogue(messages, {
      playerLabel,
      maskName: (text) => nameRevealed ? String(text || '') : maskUnrevealedName(text, activeChar?.name, playerKnownName || UNREVEALED_PLAYER_NAME)
    });
  } catch (historyError) {
    console.warn('[roleplayNpcTool] Recent dialogue lookup failed:', historyError.message);
    return [];
  }
}

function matchesNpcName(candidateName, requestedName) {
  const candidateWords = String(candidateName || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const requestedWords = String(requestedName || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return requestedWords.length > 0 && candidateWords.some((_, start) =>
    requestedWords.every((word, offset) => candidateWords[start + offset] === word)
  );
}

function isNpcInPlayerSublocation(npc, playerLocId, playerSublocId) {
  if (!npc) return false;
  const char = npc.character || npc;
  const charSublocId = char.sublocation_id ?? char.sublocation?.id ?? null;
  const charLocId = char.location_id ?? char.location?.id ?? null;

  if (playerSublocId) {
    if (charSublocId === playerSublocId) return true;
  } else if (playerLocId) {
    if (!charSublocId && (charLocId === playerLocId || charLocId === null)) return true;
  } else {
    return true;
  }

  const appearances = char.npc?.npcs_in_locations_or_sublocations || npc.npc?.npcs_in_locations_or_sublocations || [];
  for (const app of appearances) {
    if (app.deleted) continue;
    if (playerSublocId) {
      if (app.sublocation_id === playerSublocId) return true;
    } else if (playerLocId) {
      if (!app.sublocation_id && (app.location_id === playerLocId || app.location_id === null)) return true;
    }
  }

  return false;
}

async function roleplayNpcCore({ npc_name, player_dialogue_or_intent }, config, partyMode = false) {
    const toolName = partyMode ? 'roleplay_npc_party' : 'roleplay_npc';
    const partyTurn = config?.configurable?.turnContext?.partyTurn || null;
    if (!partyMode && partyTurn) {
      return JSON.stringify({ error: 'party_turn_requires_party_roleplay', instruction: 'This is a party turn. Call roleplay_npc_party once instead of roleplay_npc.' });
    }
    if (partyMode && !partyTurn) {
      return JSON.stringify({ error: 'not_a_party_turn', instruction: 'This is not a party turn. Use roleplay_npc.' });
    }
    if (partyMode && partyTurn.roleplayDone) {
      return JSON.stringify({ error: 'party_roleplay_already_done', instruction: 'The NPC already replied to the whole party this turn. Use that reply; do not call roleplay_npc_party again.' });
    }
    try {
      if (!npc_name || typeof npc_name !== 'string' || !npc_name.trim()) {
        return JSON.stringify({ error: 'NPC name cannot be empty.' });
      }
      const cleanName = npc_name.trim();
      const selectedTarget = config?.configurable?.targetNpc || null;
      const selectedTargetName = selectedTarget?.character?.name || selectedTarget?.name || '';
      if (selectedTargetName && !matchesNpcName(selectedTargetName, cleanName) && !matchesNpcName(cleanName, selectedTargetName)) {
        return JSON.stringify({
          error: 'not_conversational_target',
          npc_name: cleanName,
          target_npc_name: selectedTargetName,
          message: `The player is addressing ${selectedTargetName}, not ${cleanName}.`,
          instruction: `Only ${selectedTargetName} may respond this turn. Call ${toolName} with npc_name "${selectedTargetName}" instead. Do NOT mention "${cleanName}" or narrate that "${cleanName}" is absent unless the player explicitly named them, and do NOT generate dialogue or [Speaker: ${cleanName}] tags for them.`
        });
      }
      const db = getPrismaClient(config);
      const activeChar = config?.configurable?.character || null;
      const userId = config?.configurable?.userId || activeChar?.user_id || 'default_user';
      const charId = config?.configurable?.characterId || activeChar?.id || 1;
      const playerSublocId = activeChar?.sublocation_id ?? activeChar?.sublocation?.id ?? null;
      const playerLocId = activeChar?.location_id ?? activeChar?.location?.id ?? null;

      let resolvedNpc = null;
      let npcRole = NPC_ROLE.WORLD_NPC;

      const scopedNpcs = config?.configurable?.nearbyNpcs || [];
      const matchNearby = scopedNpcs.find((n) => {
        const c = n.character || n;
        return matchesNpcName(c.name, cleanName);
      });

      if (matchNearby && isNpcInPlayerSublocation(matchNearby, playerLocId, playerSublocId)) {
        resolvedNpc = matchNearby.character || matchNearby;
        npcRole = (resolvedNpc.job || '').toLowerCase().includes('companion') ? NPC_ROLE.COMPANION : NPC_ROLE.WORLD_NPC;
      }

      if (!resolvedNpc) {
        const party = config?.configurable?.party || null;
        if (party && Array.isArray(party.members)) {
          const companion = party.members.find(
            (m) => !m.is_player && matchesNpcName(m.name, cleanName)
          );
          if (companion) {
            resolvedNpc = companion;
            npcRole = NPC_ROLE.COMPANION;
          }
        }
      }

      let candidate = null;
      if (!resolvedNpc) {
        const candidates = await db.characters.findMany({
          where: {
            deleted: false,
            character_type: CHARACTER_TYPE.NPC,
            name: { contains: cleanName }
          },
          include: {
            location: { select: { id: true, name: true } },
            sublocation: { select: { id: true, name: true } },
            npc: {
              include: {
                npc_monsters: true,
                npcs_in_locations_or_sublocations: {
                  where: { deleted: false },
                  select: { location_id: true, sublocation_id: true }
                }
              }
            }
          },
          take: 50
        });
        candidate = candidates.find((c) => matchesNpcName(c.name, cleanName)) || null;
        if (candidate && isNpcInPlayerSublocation(candidate, playerLocId, playerSublocId)) {
          resolvedNpc = candidate;
          if (resolvedNpc?.npc?.npc_monsters) {
            npcRole = NPC_ROLE.HOSTILE_ENEMY;
          }
        }
      }

      if (!resolvedNpc) {
        if (candidate) {
          const npcPlace = candidate.sublocation?.name || candidate.location?.name || 'another location';
          const playerPlace = playerSublocId
            ? `sublocation "${activeChar?.sublocation?.name || 'Area'}"`
            : `outdoors in "${activeChar?.location?.name || 'the open area'}"`;
          return JSON.stringify({
            error: 'NPC_NOT_COPRESENT',
            npc_name: candidate.name,
            message: `${candidate.name} is not present in your current environment (${playerPlace}). They are at ${npcPlace}. The player can only speak to NPCs when they are in the exact same immediate environment.`,
            instruction: `The character "${candidate.name}" is not present in the player's immediate area (${playerPlace}). If the player explicitly addressed or called out to "${candidate.name}" by name, briefly narrate that "${candidate.name}" is not here. If the player did not explicitly name them, DO NOT mention "${candidate.name}" at all in your narration. STRICT PROHIBITION: Do NOT generate spoken dialogue or avatar tags ([Speaker: ${candidate.name}]) for "${candidate.name}".`
          });
        }
        return JSON.stringify({
          error: 'NPC_NOT_FOUND',
          npc_name: cleanName,
          message: `No NPC named "${cleanName}" is present in your immediate area. The player can only speak to NPCs when they are in the exact same area.`,
          instruction: `There is no NPC named "${cleanName}" present in this area. If the player explicitly called out to "${cleanName}", state they are not here; otherwise do not mention them. STRICT PROHIBITION: Do NOT generate spoken dialogue or avatar tags ([Speaker: ${cleanName}]) for them.`
        });
      }

      const targetNpcName = resolvedNpc?.name || cleanName;
      const targetCharId = resolvedNpc?.id || resolvedNpc?.character_id || null;

      const { knownNpcs, knownPlaces } = targetCharId
        ? await getNpcSocialAndSpatialContext(targetCharId, db, charId ? await getNsfwAccess(db, charId) : false)
        : { knownNpcs: [], knownPlaces: [] };

      if (db && charId && targetCharId) {
        await npcRelationshipManager.hydrateFromDb({
          db,
          playerCharId: charId,
          npcCharId: targetCharId,
          userId,
          characterId: charId,
          npcName: targetNpcName
        });
      }
      const relationshipData = targetCharId
        ? npcRelationshipManager.getNpcRelationship(userId, charId, targetNpcName)
        : null;

      let partyLines = null;
      let partyMemories = [];
      if (partyMode && targetCharId) {
        if (npcRole !== NPC_ROLE.COMPANION) {
          await ensurePartyRelationships(db, { party: config?.configurable?.party || null, leaderCharacter: { ...activeChar, id: charId }, npcCharacterId: targetCharId });
        }
        await resolvePartyLabels(db, partyTurn, targetCharId);
        partyLines = partyTurn.speakers.map((speaker) => ({
          label: speaker.subagentLabel,
          text: speaker.text,
          relationshipStatus: speaker.relationshipStatus,
          nameRevealed: speaker.nameRevealed
        }));
        for (const speaker of partyTurn.speakers) {
          const speakerMemories = await retrieveNpcMemories({ db, npcCharacterId: targetCharId, targetCharacterId: speaker.characterId, affinity: speaker.affinity || 0, limit: DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT });
          partyMemories.push(...speakerMemories
            .map((memory) => redactPlayerNameFromMemory(memory.content, speaker.realName, speaker.nameRevealed))
            .filter(Boolean)
            .map((content) => `About ${speaker.subagentLabel}: ${content}`));
        }
      }

      let identity = null;
      if (!partyMode && db && charId && targetCharId && npcRole !== NPC_ROLE.COMPANION) {
        try {
          await ensurePartyRelationships(db, { party: config?.configurable?.party || null, leaderCharacter: { ...activeChar, id: charId }, npcCharacterId: targetCharId });
          identity = await getNpcIdentity(db, charId, targetCharId);
        } catch (identityError) {
          console.warn('[roleplayNpcTool] NPC identity lookup failed:', identityError.message);
        }
      }
      const nameRevealed = identity ? Boolean(identity.is_player_name_revealed) : Boolean(relationshipData?.isPlayerNameRevealed);
      const playerKnownName = identity ? nameNpcUses(identity, activeChar?.name) : (nameRevealed ? activeChar?.name : null);

      const memories = partyMode ? partyMemories : targetCharId
        ? (await retrieveNpcMemories({ db, npcCharacterId: targetCharId, targetCharacterId: charId, affinity: relationshipData?.affinity || 0, limit: DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT }))
          .map((memory) => {
            return redactPlayerNameFromMemory(memory.content, activeChar?.name, nameRevealed);
          })
          .filter(Boolean)
        : [];

      const recentDialogue = await loadRecentDialogue(db, config, { partyMode, partyTurn, activeChar, nameRevealed, playerKnownName });

      const modelInstance = config?.configurable?.modelInstance || null;
      const roleplayResult = await npcRoleplaySubagent({
        npcName: targetNpcName,
        logName: activeChar?.name || config?.configurable?.character?.name || null,
        npcRole,
        race: resolvedNpc?.race || 'Human',
        job: resolvedNpc?.job || (npcRole === NPC_ROLE.COMPANION ? 'Companion' : 'NPC'),
        alignment: resolvedNpc?.alignment || 'Neutral',
        appearance: resolvedNpc?.appearance || '',
        description: resolvedNpc?.description || '',
        relationshipStatus: relationshipData?.status,
        playerNameRevealed: nameRevealed,
        playerKnownName,
        memories,
        knownNpcs,
        knownPlaces,
        locationContext: activeChar?.location?.name || activeChar?.sublocation?.name || '',
        playerAction: player_dialogue_or_intent || 'Greets the NPC.',
        partyLines,
        recentDialogue,
        checkedFacts: formatPlayerToolResultsForRoleplay(config?.configurable?.turnContext?.playerToolResults || []),
        sceneContext: config?.configurable?.turnContext?.roleplayScene || null,
        nsfwAllowed: activeChar?.nsfw_allowed === true,
        modelInstance
      });

      if (partyMode) partyTurn.roleplayDone = true;
      return JSON.stringify({
        ...roleplayResult,
        ...(relationshipData ? { relationshipStatus: relationshipData.status, affinity: relationshipData.affinity } : {}),
        knownNpcsCount: knownNpcs.length,
        knownPlacesCount: knownPlaces.length,
        ...(partyLines ? { addressedAs: partyTurn.speakers.map((speaker) => ({ member: speaker.realName, npcCallsThem: speaker.npcLabel })) } : {}),
        instruction: partyLines
          ? `Incorporate ${targetNpcName}'s single reply to the whole party into ONE narration. ${targetNpcName} addresses each member only by npcCallsThem ("A stranger" means no name).`
          : `Incorporate ${targetNpcName}'s dialogue and body language into narration.`
      });
    } catch (err) {
      const wrapped = databaseError('roleplayNpcTool', 'resolve canonical roleplay context', err);
      return JSON.stringify({
        error: wrapped.message,
        npcName: npc_name
      });
    }
}

export const roleplayNpcTool = tool(
  async (input, config) => roleplayNpcCore(input, config, false),
  {
    name: 'roleplay_npc',
    description: 'Invoke the specialized NPC Roleplay Subagent to generate in-character dialogue, expressive body language, and reaction for an NPC (companion, neutral world NPC like Honeywood\'s Guard, or enemy). Call this ONLY when the player speaks to, questions, barters with, or confronts an NPC who is physically present in the player\'s current sublocation or party.',
    schema: z.object({
      npc_name: z.string().describe('The name of the NPC or companion to roleplay (must be present in the player\'s current sublocation or party).'),
      player_dialogue_or_intent: z.string().describe('What the player said, asked, or did towards this NPC.')
    })
  }
);

export const roleplayNpcPartyTool = tool(
  async ({ npc_name, scene_context }, config) => roleplayNpcCore({ npc_name, player_dialogue_or_intent: scene_context || '' }, config, true),
  {
    name: 'roleplay_npc_party',
    description: 'Party turns only. Invoke the NPC Roleplay Subagent ONCE for the targeted NPC; it already receives every party member\'s line from the system and returns one reply that reacts to the whole party. Never call it more than once per turn and never call roleplay_npc on a party turn.',
    schema: z.object({
      npc_name: z.string().describe('The targeted NPC (must be present in the current sublocation).'),
      scene_context: z.string().optional().describe('Optional short note on the situation (e.g. unpaid drinks on the bar). Do not restate the members\' lines.')
    })
  }
);
