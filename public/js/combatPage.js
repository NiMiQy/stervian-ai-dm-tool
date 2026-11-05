import { getActiveBattle, getCharacter, getCurrentUser, logout } from './logics/authApi.js';
import { initialiseBattleModal } from './containers/battleContainer.js';
import { initializeSettingsMenu } from './components/settingsMenu.js';
import {
  BATTLE_STATUS,
  COMBAT_REFRESH_INTERVAL_MS,
  FLEE_ENERGY_COST,
  PAGES,
  RESPAWN_VITALS,
  STORAGE_KEY_PREFIXES,
  WEBSOCKET_PATH,
} from './constants.js';

const routeStatus = document.querySelector('#combatRouteStatus');
const resultModal = document.querySelector('#battleResultModal');
let currentCharacter = null;
let currentUser = null;
let currentBattleSnapshot = '';
let refreshTimer = null;

function keepPresenceSocket() {
  const socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${WEBSOCKET_PATH}`;
  let socket = null;
  let stopped = false;
  const connect = () => {
    socket = new WebSocket(socketUrl);
    socket.addEventListener('close', () => { if (!stopped) window.setTimeout(connect, COMBAT_REFRESH_INTERVAL_MS); });
    socket.addEventListener('error', () => socket.close());
  };
  connect();
  window.addEventListener('pagehide', () => { stopped = true; socket?.close(); }, { once: true });
}

function redirectToGame(message = 'No active combat session. Returning to the game…') {
  if (routeStatus) routeStatus.textContent = message;
  window.location.replace(PAGES.GAME);
}

async function handleBattleResult(result) {
  if (result?.status === BATTLE_STATUS.FLED && !result?.training) {
    const opponents = Array.isArray(result.opponents) ? result.opponents.filter(Boolean) : [];
    const opponentNames = opponents.length ? opponents.join(', ') : 'the enemy';
    sessionStorage.setItem(
      `${STORAGE_KEY_PREFIXES.FLEE_ACTION}${currentUser.id}`,
      `I successfully fled combat against ${opponentNames}, spending ${FLEE_ENERGY_COST} energy. Narrate how I escape and what happens immediately afterward.`
    );
  }

  if (result?.status === BATTLE_STATUS.DEFEAT) {
    const opponents = Array.isArray(result.defeatedBy) ? result.defeatedBy.filter(Boolean) : [];
    const opponentNames = opponents.length ? opponents.join(', ') : 'the enemy';
    const respawnName = result.respawn_location?.name || 'the respawn point';
    sessionStorage.setItem(
      `${STORAGE_KEY_PREFIXES.DEFEAT_ACTION}${currentUser.id}`,
      `The combat system defeated my character against ${opponentNames}. I have awakened at ${respawnName} with ${RESPAWN_VITALS.hp} HP, ${RESPAWN_VITALS.energy} energy, ${RESPAWN_VITALS.food} food, and ${RESPAWN_VITALS.water} water. Narrate what happens next after this defeat.`
    );
  }

  try {
    currentCharacter = await getCharacter(currentUser.id);
  } catch (error) {
    console.warn('Unable to refresh character after combat:', error.message);
  }
}

async function initialiseCombatPage() {
  try {
    ({ user: currentUser } = await getCurrentUser());
  } catch {
    redirectToGame();
    return;
  }

  if (!currentUser?.hasCharacter) {
    redirectToGame();
    return;
  }

  keepPresenceSocket();

  initializeSettingsMenu(async () => {
    try {
      await logout();
    } finally {
      window.location.assign(PAGES.LOGIN);
    }
  });

  let activeCheck;
  try {
    activeCheck = await getActiveBattle();
  } catch {
    redirectToGame();
    return;
  }

  if (!activeCheck?.inCombat || !activeCheck.battle) {
    redirectToGame();
    return;
  }

  try {
    currentCharacter = await getCharacter(currentUser.id);
  } catch (error) {
    console.warn('Unable to load the character record for combat:', error.message);
    currentCharacter = { user_id: currentUser.id, name: currentUser.username };
  }
  const battleController = initialiseBattleModal(
    async () => null,
    handleBattleResult,
    () => currentCharacter,
    {
      onStateChange: (battle) => { currentBattleSnapshot = JSON.stringify(battle); },
      onResultDismiss: () => window.location.replace(PAGES.GAME)
    }
  );

  try {
    const openingBattle = battleController.openWithExistingState(activeCheck.battle);
    if (routeStatus) routeStatus.hidden = true;
    document.body.classList.add('is-ready');
    await openingBattle;
  } catch (error) {
    console.error('Unable to open active combat:', error);
    redirectToGame('Unable to open combat. Returning to the game…');
    return;
  }

  const refreshCombatState = async () => {
    try {
      const active = await getActiveBattle();
      if (!active?.inCombat || !active.battle) {
        if (!resultModal?.classList.contains('is-open')) redirectToGame();
        return;
      }

      const nextSnapshot = JSON.stringify(active.battle);
      if (nextSnapshot !== currentBattleSnapshot) {
        await battleController.refreshState(active.battle);
      }
    } catch (error) {
      console.warn('Combat state refresh failed:', error.message);
    }
  };

  refreshTimer = window.setInterval(refreshCombatState, COMBAT_REFRESH_INTERVAL_MS);
  window.addEventListener('pagehide', () => window.clearInterval(refreshTimer), { once: true });
}

initialiseCombatPage();
