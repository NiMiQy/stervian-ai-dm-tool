import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPrismaClient } from '../shared.js';
import { databaseError } from '../../../../database/databaseError.js';
import { CHARACTER_TYPE, NPC_IDENTITY } from '../../../../configs/constants.js';
import { introduceNames } from '../../../npcIdentityService.js';
import { findPartySpeaker } from '../../../partyTurnService.js';

function resolveSpeaker(config, speaker) {
  const partyTurn = config?.configurable?.turnContext?.partyTurn || null;
  if (!partyTurn) return { ok: true, member: null };
  const member = findPartySpeaker(partyTurn, speaker) || (speaker ? null : partyTurn.speakers.find((entry) => entry.isLeader));
  return member ? { ok: true, member } : { ok: false, reason: 'UNKNOWN_SPEAKER', speakers: partyTurn.speakers.map((entry) => entry.realName) };
}

function matchesNpcName(candidateName, requestedName) {
  const candidate = String(candidateName || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const requested = String(requestedName || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return requested.length > 0 && candidate.some((_, start) => requested.every((word, offset) => candidate[start + offset] === word));
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

export const introduceNameToNpcTool = tool(
  async ({ npc_name, spoken_names, subject, speaker }, config) => {
    try {
      const db = getPrismaClient(config);
      const speakerResult = resolveSpeaker(config, speaker);
      if (!speakerResult.ok) return JSON.stringify({ recorded: false, reason: speakerResult.reason, validSpeakers: speakerResult.speakers });
      const character = speakerResult.member ? { ...config?.configurable?.character, id: speakerResult.member.characterId, name: speakerResult.member.realName } : config?.configurable?.character;
      const playerCharacterId = Number(character?.id || config?.configurable?.characterId);
      const names = (Array.isArray(spoken_names) ? spoken_names : [spoken_names]).map((name) => String(name || '').trim()).filter(Boolean);
      if (!playerCharacterId || !String(npc_name || '').trim() || !names.length) return JSON.stringify({ recorded: false, reason: 'INVALID_CONTEXT' });
      const matches = await db.characters.findMany({
        where: { deleted: false, character_type: CHARACTER_TYPE.NPC, name: { contains: String(npc_name).trim() }, npc: { is: { deleted: false } } },
        select: {
          id: true,
          name: true,
          location_id: true,
          sublocation_id: true,
          npc: {
            select: {
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
      const npc = matches.find((candidate) => matchesNpcName(candidate.name, npc_name) && (!candidate.npc?.npc_monsters || candidate.npc.npc_monsters.deleted === true));
      if (!npc) return JSON.stringify({ recorded: false, reason: 'NPC_NOT_FOUND' });
      const party = config?.configurable?.party || null;
      const isCompanion = party && Array.isArray(party.members) && party.members.some((m) => !m.is_player && matchesNpcName(m.name, npc.name));
      if (isCompanion) return JSON.stringify({ recorded: false, reason: 'COMPANION_NPC', npcName: npc.name });
      const playerSublocId = character?.sublocation_id ?? character?.sublocation?.id ?? null;
      const playerLocId = character?.location_id ?? character?.location?.id ?? null;
      if (!isNpcInPlayerSublocation(npc, playerLocId, playerSublocId)) {
        return JSON.stringify({ recorded: false, reason: 'NPC_NOT_IN_SUBLOCATION', npcName: npc.name });
      }
      const result = await introduceNames(db, {
        speaker: { ...character, id: playerCharacterId },
        party,
        npcCharacterId: npc.id,
        spokenNames: names,
        subject: subject === NPC_IDENTITY.INTRODUCTION_SUBJECT.PARTY ? NPC_IDENTITY.INTRODUCTION_SUBJECT.PARTY : NPC_IDENTITY.INTRODUCTION_SUBJECT.SELF
      });
      return JSON.stringify({
        recorded: result.recorded.length > 0,
        npcName: npc.name,
        introductions: result.recorded.map((entry) => ({ member: entry.member || 'the speaker', nameNpcNowUses: entry.name, storedAs: entry.field })),
        ignoredNames: result.ignoredNames || [],
        instruction: `${npc.name} now knows these people by the names given. NEVER reveal or use anyone's real character name unless it is what ${npc.name} was told.`
      });
    } catch (error) {
      const wrapped = databaseError('introduceNameToNpcTool', 'record name introduction', error);
      return JSON.stringify({ recorded: false, error: wrapped.message });
    }
  },
  {
    name: 'introduce_name_to_npc',
    description: 'Record the name a canonical NPC is told, exactly as spoken. Call it when the player introduces themself by ANY name (true or false), or when the party leader introduces party members by name. It only changes the name the NPC believes; it never reveals the real name. Call before roleplay_npc.',
    schema: z.object({
      npc_name: z.string().describe('The canonical NPC who heard the introduction (present in the current area).'),
      spoken_names: z.array(z.string()).describe('The names exactly as spoken, in the order spoken. For subject "party", the first name belongs to party member #2, the next to #3, and so on (as numbered in the party section).'),
      subject: z.enum(['self', 'party']).describe('"self" when the speaker names themself; "party" when the speaker introduces the other party members.'),
      speaker: z.string().optional().describe('Party turns only: the bracketed real name of the member who spoke the introduction.')
    })
  }
);
