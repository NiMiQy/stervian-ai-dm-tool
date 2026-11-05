import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { createNpcMemory } from './characterMemoryService.js';
import { getAffinityStatus, npcRelationshipManager } from './ai/subagents/relationships.js';
import { CHARACTER_TYPE, MEMORY_TYPE, NPC_IDENTITY } from '../configs/constants.js';

export function normalizePersonName(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function cleanSpokenName(value) {
  return String(value || '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim().slice(0, NPC_IDENTITY.NAME_MAX_LENGTH);
}

function relationshipWhere(playerCharacterId, npcCharacterId) {
  return { player_character_id_npc_character_id: { player_character_id: Number(playerCharacterId), npc_character_id: Number(npcCharacterId) } };
}

export function nameNpcUses(identity, realName) {
  if (identity?.is_player_name_revealed) return identity.nickname || realName || null;
  return identity?.known_as_name || null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function maskUnrevealedName(text, realName, knownName = 'the stranger') {
  const source = String(text || '');
  const fullName = String(realName || '').trim();
  if (!source || !fullName) return source;
  const replacement = String(knownName || 'the stranger').trim();
  const parts = [fullName, ...fullName.split(/\s+/).filter((part) => part.length >= 3)]
    .filter((part) => normalizePersonName(part) !== normalizePersonName(replacement));
  return parts.reduce((result, part) => result.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(part)}(?![\\p{L}\\p{N}])`, 'giu'), replacement), source);
}

export async function getNpcIdentity(db, playerCharacterId, npcCharacterId) {
  if (!playerCharacterId || !npcCharacterId || !db?.player_npc_relationships?.findUnique) return null;
  try {
    return await db.player_npc_relationships.findUnique({
      where: relationshipWhere(playerCharacterId, npcCharacterId),
      select: { affinity: true, status: true, is_player_name_revealed: true, known_as_name: true, nickname: true, deleted: true },
    });
  } catch (error) {
    throw databaseError('getNpcIdentity', 'read NPC identity', error);
  }
}

export function formatNpcIdentityForPrompt(identity, npcName, realName) {
  const npc = npcName || 'The targeted NPC';
  const lines = ['### NPC Name Knowledge'];
  if (identity?.is_player_name_revealed) {
    const callName = identity.nickname || realName;
    lines.push(`- ${npc} knows the player's real name: ${realName}.${identity.nickname ? ` The player asked to be called "${identity.nickname}"; ${npc} uses that nickname.` : ''}`);
    lines.push(`- ${npc} addresses the player as "${callName}".`);
  } else if (identity?.known_as_name) {
    lines.push(`- ${npc} knows the player ONLY as "${identity.known_as_name}" and believes that is their name.`);
    lines.push(`- ${npc} addresses the player as "${identity.known_as_name}" and has NO knowledge of any other name for them.`);
  } else {
    lines.push(`- ${npc} has never been told the player's name. Address the player only as a stranger, adventurer, wanderer, or guest.`);
  }
  lines.push(`- STRICT: NPCs NEVER say or infer the player's real character name until it is revealed through the official reveal. The player's real name in the character sheet is for the narrator only.`);
  lines.push('- When the player introduces themself or a party member by name in conversation, call introduce_name_to_npc with the names exactly as spoken. Introductions never reveal the real name; only the "Reveal real name" action does.');
  return lines.join('\n');
}

async function upsertRelationship(db, playerCharacterId, npcCharacterId, update, createExtra = {}) {
  return db.player_npc_relationships.upsert({
    where: relationshipWhere(playerCharacterId, npcCharacterId),
    update: { deleted: false, ...update },
    create: { player_character_id: Number(playerCharacterId), npc_character_id: Number(npcCharacterId), affinity: 0, status: getAffinityStatus(0), ...createExtra, ...update },
  });
}

function sameScene(a, b) {
  return Number(a?.location_id || 0) === Number(b?.location_id || 0) && Number(a?.sublocation_id || 0) === Number(b?.sublocation_id || 0);
}

export async function getPresentPartyPlayers(db, party, leaderCharacter) {
  const memberIds = (party?.members || [])
    .filter((member) => member.is_player && member.character_id && Number(member.character_id) !== Number(leaderCharacter?.id))
    .map((member) => Number(member.character_id));
  if (!memberIds.length) return [];
  const rows = await db.characters.findMany({
    where: { id: { in: memberIds }, deleted: { not: true }, character_type: CHARACTER_TYPE.PLAYER },
    select: { id: true, name: true, user_id: true, location_id: true, sublocation_id: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return memberIds.map((id) => byId.get(id)).filter((member) => member && sameScene(member, leaderCharacter));
}

export async function ensurePartyRelationships(db, { party, leaderCharacter, npcCharacterId }) {
  if (!party || !npcCharacterId || !leaderCharacter?.id) return 0;
  try {
    const members = await getPresentPartyPlayers(db, party, leaderCharacter);
    if (!members.length) return 0;
    const result = await db.player_npc_relationships.createMany({
      data: members.map((member) => ({ player_character_id: member.id, npc_character_id: Number(npcCharacterId), affinity: 0, status: getAffinityStatus(0) })),
      skipDuplicates: true,
    });
    return result.count;
  } catch (error) {
    throw databaseError('ensurePartyRelationships', 'create party NPC relationships', error);
  }
}

async function setNameForCharacter(db, characterId, npcCharacterId, spokenName) {
  const identity = await getNpcIdentity(db, characterId, npcCharacterId);
  if (identity?.is_player_name_revealed) {
    await upsertRelationship(db, characterId, npcCharacterId, { nickname: spokenName });
    return { field: 'nickname', name: spokenName };
  }
  await upsertRelationship(db, characterId, npcCharacterId, { known_as_name: spokenName });
  return { field: 'known_as_name', name: spokenName };
}

export async function introduceNames(db, { speaker, party, npcCharacterId, spokenNames = [], subject = NPC_IDENTITY.INTRODUCTION_SUBJECT.SELF }) {
  const names = spokenNames.map(cleanSpokenName).filter(Boolean);
  if (!names.length || !speaker?.id || !npcCharacterId) return { recorded: [] };
  try {
    if (subject !== NPC_IDENTITY.INTRODUCTION_SUBJECT.PARTY) {
      const result = await setNameForCharacter(db, speaker.id, npcCharacterId, names[0]);
      return { recorded: [{ characterId: speaker.id, ...result }] };
    }
    const members = (party?.members || [])
      .filter((member) => member.is_player && member.character_id && Number(member.character_id) !== Number(speaker.id))
      .map((member) => ({ id: Number(member.character_id), name: member.name }));
    const recorded = [];
    for (let index = 0; index < Math.min(names.length, members.length); index += 1) {
      const result = await setNameForCharacter(db, members[index].id, npcCharacterId, names[index]);
      recorded.push({ characterId: members[index].id, member: members[index].name, ...result });
    }
    return { recorded, ignoredNames: names.slice(members.length) };
  } catch (error) {
    throw databaseError('introduceNames', 'record name introduction', error);
  }
}

function forgetCachedRelationship(characterId, npcName) {
  const store = npcRelationshipManager?.store;
  if (!store || typeof store.keys !== 'function') return;
  const suffix = `::${String(characterId).trim().toLowerCase()}::${String(npcName || '').trim().toLowerCase()}`;
  for (const key of [...store.keys()]) if (key.endsWith(suffix)) store.delete(key);
}

export async function revealRealName(db = prisma, { player, party, npc }) {
  if (!player?.id || !npc?.id) throw new Error('A player and an NPC are required to reveal a name.');
  try {
    const identity = await getNpcIdentity(db, player.id, npc.id);
    const oldName = identity?.known_as_name || null;
    const lied = Boolean(oldName) && normalizePersonName(oldName) !== normalizePersonName(player.name);
    await upsertRelationship(db, player.id, npc.id, { is_player_name_revealed: true, known_as_name: player.name });
    forgetCachedRelationship(player.id, npc.name);
    const companions = [];
    if (lied) {
      const members = await getPresentPartyPlayers(db, party, player);
      for (const target of [player, ...members]) {
        const current = await getNpcIdentity(db, target.id, npc.id);
        const isLiar = target.id === player.id;
        const memberKnownName = isLiar ? oldName : (nameNpcUses(current, target.name) || 'a companion of theirs');
        await createNpcMemory({
          db,
          npcCharacterId: npc.id,
          targetCharacterId: target.id,
          content: isLiar
            ? `The one I knew as ${oldName} is really ${player.name}; they lied to me about their name.`
            : `${memberKnownName} travels with ${player.name}, who lied to me about their name.`,
          memoryType: MEMORY_TYPE.EPISODIC,
        });
        if (!isLiar) companions.push(target.name);
      }
    }
    return { lied, oldName, realName: player.name, npcName: npc.name, companions };
  } catch (error) {
    throw databaseError('revealRealName', 'reveal real name to NPC', error);
  }
}

export function formatRevealResultForPrompt(result) {
  if (!result) return '';
  if (!result.lied) {
    return `### Name Reveal (system-confirmed)\n- The player has just told ${result.npcName} their real name: ${result.realName}. It matches what ${result.npcName} already believed (or they had no name before). Narrate it naturally; there is no conflict.`;
  }
  const members = result.companions || [];
  return [
    '### Name Reveal (system-confirmed): THE PLAYER LIED',
    `- ${result.npcName} knew the player as "${result.oldName}". The player has just revealed their real name is ${result.realName}.`,
    `- ${result.npcName} realises they were lied to. Narrate a clear, in-character reaction to the deception (hurt, anger, suspicion or cold distance, fitting their personality).`,
    ...(members.length ? [`- ${result.npcName} also regards the companions present (${members.join(', ')}) with suspicion for travelling with a liar.`] : []),
    `- From now on ${result.npcName} uses the real name ${result.realName}.`,
  ].join('\n');
}
