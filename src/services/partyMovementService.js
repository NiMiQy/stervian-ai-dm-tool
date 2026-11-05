import { databaseError } from '../database/databaseError.js';
import { broadcastToUsers } from './webSocketService.js';
import { closeLocationDialogueSessions } from '../containers/dialogueContainer.js';
import { PARTY_MOVEMENT, PARTY_STATUS, WEBSOCKET_EVENTS } from '../configs/constants.js';

async function findActiveParty(db, characterId) {
  const membership = await db.party_members.findFirst({
    where: { character_id: Number(characterId), deleted: false, party: { status: PARTY_STATUS.ACTIVE, deleted: false } },
    select: {
      party: {
        select: {
          id: true,
          leader_character_id: true,
          members: { where: { deleted: false }, select: { character_id: true } },
        },
      },
    },
  });
  return membership?.party || null;
}

export async function getPartyFollowerBlock(db, characterId) {
  if (!characterId) return null;
  try {
    const party = await findActiveParty(db, characterId);
    if (!party || Number(party.leader_character_id) === Number(characterId)) return null;
    return PARTY_MOVEMENT.FOLLOWER_BLOCKED_ERROR;
  } catch (error) {
    throw databaseError('getPartyFollowerBlock', 'check party movement', error);
  }
}

export async function movePartyWithLeader(db, leaderCharacterId, { locationId, sublocationId = null, leaveLocation = false } = {}) {
  if (!leaderCharacterId) return { moved: [] };
  try {
    const party = await findActiveParty(db, leaderCharacterId);
    if (!party || Number(party.leader_character_id) !== Number(leaderCharacterId)) return { moved: [] };
    const followerIds = party.members.map((member) => Number(member.character_id)).filter((id) => id && id !== Number(leaderCharacterId));
    if (!followerIds.length) return { moved: [] };
    const data = { sublocation_id: sublocationId ? Number(sublocationId) : null };
    if (locationId) data.location_id = Number(locationId);
    await db.characters.updateMany({ where: { id: { in: followerIds } }, data });
    const followers = await db.characters.findMany({ where: { id: { in: followerIds } }, select: { id: true, user_id: true } });
    for (const follower of followers) {
      if (follower.user_id) await closeLocationDialogueSessions(follower.id, data.sublocation_id, db, { leaveLocation });
    }
    return { partyId: party.id, moved: followers };
  } catch (error) {
    throw databaseError('movePartyWithLeader', 'move party with leader', error);
  }
}

export function notifyPartyMoved(result, payload = {}) {
  const userIds = (result?.moved || []).map((member) => member.user_id).filter(Boolean);
  if (!userIds.length) return 0;
  return broadcastToUsers(userIds, WEBSOCKET_EVENTS.PARTY_MOVED, { ...payload, timestamp: Date.now() });
}
