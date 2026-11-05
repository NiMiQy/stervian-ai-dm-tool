import { getOnlineTracker } from './onlineResourceService.js';
import { onUserPresenceChange } from './webSocketService.js';
import { getUserActiveParty, leaveParty } from '../containers/partyContainer.js';
import { markCombatantOffline } from '../containers/core/battleSystemCore.js';
import { isMultiplayerParty } from './partyTurnService.js';
import { PARTY_PRESENCE } from '../configs/constants.js';

const pendingRemovals = new Map();

function cancelPendingRemoval(userId) {
  const timer = pendingRemovals.get(userId);
  if (timer) clearTimeout(timer);
  pendingRemovals.delete(userId);
}

export async function removeMemberFromParty(userId, { ignoreConnection = false, isOnline = (id) => Boolean(getOnlineTracker(id)) } = {}) {
  if (!userId) return { removed: false, reason: 'NO_USER' };
  if (!ignoreConnection && isOnline(userId)) return { removed: false, reason: 'ONLINE' };
  const partyInfo = await getUserActiveParty(userId);
  if (!isMultiplayerParty(partyInfo?.party)) return { removed: false, reason: 'NO_MULTIPLAYER_PARTY' };
  if (await markCombatantOffline(userId)) return { removed: false, reason: 'IN_COMBAT_DEFERRED' };
  const result = await leaveParty(userId);
  return { removed: Boolean(result?.success), reason: result?.error || null };
}

function scheduleRemoval(userId) {
  cancelPendingRemoval(userId);
  const timer = setTimeout(() => {
    pendingRemovals.delete(userId);
    removeMemberFromParty(userId).catch((error) => console.warn('[partyPresence] Unable to remove offline member:', error.message));
  }, PARTY_PRESENCE.NAVIGATION_GRACE_MS);
  timer.unref?.();
  pendingRemovals.set(userId, timer);
}

export function removeMemberOnSignOut(userId) {
  cancelPendingRemoval(userId);
  return removeMemberFromParty(userId, { ignoreConnection: true });
}

let unsubscribe = null;

export function startPartyPresence() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = onUserPresenceChange((userId, isOnline) => {
    if (isOnline) cancelPendingRemoval(userId);
    else scheduleRemoval(userId);
  });
  return unsubscribe;
}
