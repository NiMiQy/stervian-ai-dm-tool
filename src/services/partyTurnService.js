import { databaseError } from '../database/databaseError.js';
import { getOnlineTracker } from './onlineResourceService.js';
import { getNpcIdentity, nameNpcUses, revealRealName } from './npcIdentityService.js';
import { PARTY_TURN } from '../configs/constants.js';

export class PartyTurnError extends Error {}

export function normalizePartyActions(rawActions) {
  if (!Array.isArray(rawActions)) return [];
  return rawActions.map((entry) => ({
    characterId: Number(entry?.characterId),
    text: String(entry?.text || '').replace(/\s+$/g, '').trim().slice(0, PARTY_TURN.ACTION_MAX_LENGTH),
    revealName: entry?.revealName === true,
  }));
}

export function isMultiplayerParty(party) {
  return Boolean(party && Array.isArray(party.members) && party.members.filter((member) => member.is_player).length > 1);
}

export function buildPartyTurn({ leaderCharacter, party, partyId, actions, isOnline = (userId) => Boolean(getOnlineTracker(userId)) }) {
  if (!party || Number(party.id) !== Number(partyId) || Number(party.leader_character_id) !== Number(leaderCharacter?.id)) {
    throw new PartyTurnError(PARTY_TURN.NOT_LEADER_ERROR);
  }
  const eligible = party.members.filter((member) => member.is_player && member.character_id
    && (Number(member.character_id) === Number(leaderCharacter.id) || isOnline(member.user_id)));
  const byId = new Map(eligible.map((member) => [Number(member.character_id), member]));
  const seen = new Set();
  for (const action of actions) {
    if (!byId.has(action.characterId) || seen.has(action.characterId)) throw new PartyTurnError(PARTY_TURN.INVALID_MEMBER_ERROR);
    seen.add(action.characterId);
  }
  const actionById = new Map(actions.map((action) => [action.characterId, action]));
  const speakers = eligible
    .map((member) => {
      const action = actionById.get(Number(member.character_id));
      return {
        characterId: Number(member.character_id),
        userId: member.user_id,
        realName: member.name,
        text: action?.text || '',
        revealName: Boolean(action?.revealName),
        isLeader: Number(member.character_id) === Number(leaderCharacter.id),
      };
    })
    .sort((a, b) => Number(b.isLeader) - Number(a.isLeader));
  if (!speakers.some((speaker) => speaker.text || speaker.revealName)) throw new PartyTurnError(PARTY_TURN.EMPTY_ERROR);
  return { partyId: Number(party.id), speakers };
}

export function fillRevealTexts(partyTurn, npcName) {
  for (const speaker of partyTurn.speakers) {
    if (speaker.revealName && !speaker.text) speaker.text = `I tell ${npcName || 'them'} my real name: ${speaker.realName}.`;
  }
  return partyTurn;
}

export function formatPartyTurnAction(partyTurn) {
  return partyTurn.speakers
    .filter((speaker) => speaker.text)
    .map((speaker) => `[${speaker.realName}]: ${speaker.text}`)
    .join('\n');
}

export async function resolvePartyLabels(db, partyTurn, npcCharacterId) {
  let strangerCount = 0;
  const usedLabels = new Map();
  try {
    for (const speaker of partyTurn.speakers) {
      if (!npcCharacterId) {
        speaker.npcLabel = speaker.realName;
        speaker.subagentLabel = speaker.realName;
        speaker.nameRevealed = true;
        continue;
      }
      const identity = await getNpcIdentity(db, speaker.characterId, npcCharacterId);
      const known = nameNpcUses(identity, speaker.realName);
      speaker.nameRevealed = Boolean(identity?.is_player_name_revealed);
      speaker.relationshipStatus = identity?.status || null;
      speaker.affinity = identity?.affinity ?? 0;
      if (known) {
        const count = (usedLabels.get(known) || 0) + 1;
        usedLabels.set(known, count);
        speaker.npcLabel = known;
        speaker.subagentLabel = count > 1 ? `${known} (${count})` : known;
      } else {
        strangerCount += 1;
        speaker.npcLabel = PARTY_TURN.STRANGER_LABEL;
        speaker.subagentLabel = `${PARTY_TURN.SUBAGENT_STRANGER_PREFIX} ${strangerCount}`;
      }
    }
    return partyTurn;
  } catch (error) {
    throw databaseError('resolvePartyLabels', 'resolve party names for NPC', error);
  }
}

export function buildPartyTurnDisplay(partyTurn) {
  return partyTurn.speakers
    .filter((speaker) => speaker.text)
    .map((speaker) => ({ characterId: speaker.characterId, label: speaker.npcLabel || speaker.realName, text: speaker.text }));
}

export async function applyPartyReveals(db, { partyTurn, party, npc }) {
  const results = [];
  for (const speaker of partyTurn.speakers) {
    if (!speaker.revealName) continue;
    const player = await db.characters.findUnique({ where: { id: speaker.characterId }, select: { id: true, name: true, location_id: true, sublocation_id: true } });
    if (!player) continue;
    results.push(await revealRealName(db, { player, party, npc }));
  }
  return results;
}

export function findPartySpeaker(partyTurn, speakerName) {
  if (!partyTurn || !speakerName) return null;
  const wanted = String(speakerName).trim().toLowerCase();
  return partyTurn.speakers.find((speaker) => [speaker.realName, speaker.npcLabel, speaker.subagentLabel]
    .filter(Boolean)
    .some((label) => String(label).trim().toLowerCase() === wanted)) || null;
}

export function formatPartyTurnForPrompt(partyTurn, npcName = null) {
  if (!partyTurn?.speakers?.length) return '';
  const lines = partyTurn.speakers.map((speaker) => {
    const role = speaker.isLeader ? ' (party leader, acting player)' : '';
    const known = npcName ? ` - ${npcName} knows them as ${speaker.npcLabel === PARTY_TURN.STRANGER_LABEL ? 'a stranger (never told a name)' : `"${speaker.npcLabel}"`}` : '';
    return `- [${speaker.realName}]${role}${known}: ${speaker.text ? `"${speaker.text}"` : 'stays quiet and follows along.'}`;
  });
  return [
    '### Party Turn (system-structured, authoritative)',
    'The party leader wrote one row per party member. Each line below belongs ONLY to the member named in brackets; never reassign a line to someone else.',
    ...lines,
    '- Narrate ONE combined scene that covers every member\'s line. Do not write a separate narration per member.',
    npcName
      ? `- Every line is spoken to ${npcName}. Call roleplay_npc_party exactly once with npc_name "${npcName}"; it already contains every member's line. Do NOT call roleplay_npc this turn.`
      : '- No NPC is targeted. Do not call roleplay_npc_party.',
    '- For introduce_name_to_npc, pass speaker = the bracketed real name of the member who said or did it.',
    '- Only the party leader moves the party. A member\'s line about going somewhere is roleplay only; never call movement tools for it.',
    '- The bracketed real names are for the narrator only. NPCs address each member only by the name they know, or as a stranger.',
  ].join('\n');
}

export function formatPartyRevealResultsForPrompt(results = []) {
  return results.filter(Boolean).map((result) => {
    if (!result.lied) return `- ${result.realName} has just told ${result.npcName} their real name. It matches what ${result.npcName} believed. Narrate it naturally.`;
    return `- THE NAME WAS A LIE: ${result.npcName} knew this member as "${result.oldName}", but their real name is ${result.realName}. ${result.npcName} reacts to the deception in character. From now on ${result.npcName} uses ${result.realName}.`;
  }).join('\n');
}
