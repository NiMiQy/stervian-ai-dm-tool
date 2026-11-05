import {
  ACTION_MODES,
  BYTES_PER_MB,
  HTTP_METHOD,
  JSON_BODY_LIMIT_BYTES,
  JSON_CHUNK_BYTES,
  JSON_CHUNK_HEADERS,
  JSON_CHUNK_MODES,
} from '../constants.js';
import { aiApiKeyHeaders } from './aiApiKey.js';

function byteLength(value) { return new TextEncoder().encode(value).byteLength; }

function splitJsonIntoChunks(serialized) {
  const encoder = new TextEncoder();
  const chunks = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const character of serialized) {
    const characterBytes = encoder.encode(character).byteLength;
    if (chunk && chunkBytes + characterBytes > JSON_CHUNK_BYTES) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk || serialized.length === 0) chunks.push(chunk);
  return chunks;
}

function chunkRequestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function responseData(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: `The server returned an invalid response (${response.status}).` };
  }
}

async function sendRequest(path, options) {
  const response = await fetch(path, options);
  const data = await responseData(response);
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...aiApiKeyHeaders(), ...(options.headers || {}) };
  const baseOptions = { ...options, credentials: options.credentials ?? 'same-origin', headers };
  if (typeof options.body !== 'string' || byteLength(options.body) <= JSON_CHUNK_BYTES) return sendRequest(path, baseOptions);
  if (byteLength(options.body) > JSON_BODY_LIMIT_BYTES) throw new Error(`The request body is larger than the ${JSON_BODY_LIMIT_BYTES / BYTES_PER_MB} MB limit.`);

  const chunks = splitJsonIntoChunks(options.body);
  const id = chunkRequestId();
  for (let index = 0; index < chunks.length; index += 1) {
    await sendRequest(path, {
      ...baseOptions,
      body: JSON.stringify({ chunk: chunks[index] }),
      headers: {
        ...headers,
        [JSON_CHUNK_HEADERS.id]: id,
        [JSON_CHUNK_HEADERS.index]: String(index),
        [JSON_CHUNK_HEADERS.total]: String(chunks.length),
        [JSON_CHUNK_HEADERS.mode]: JSON_CHUNK_MODES.APPEND,
      },
    });
  }

  return sendRequest(path, {
    ...baseOptions,
    body: '{}',
    headers: {
      ...headers,
      [JSON_CHUNK_HEADERS.id]: id,
      [JSON_CHUNK_HEADERS.total]: String(chunks.length),
      [JSON_CHUNK_HEADERS.mode]: JSON_CHUNK_MODES.COMMIT,
    },
  });
}

export const register = (input) => request('/api/auth/register', { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const login = (input) => request('/api/auth/login', { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const logout = () => request('/api/auth/logout', { method: HTTP_METHOD.POST });
export const getCurrentUser = () => request('/api/auth/me');
export const createCharacter = (input) => request('/api/characters', { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const getCharacter = (userId) => request(`/api/characters/${userId}`);
export const updateCharacterAvatar = (characterId, imageData) => request(`/api/characters/${characterId}/avatar`, { method: HTTP_METHOD.POST, body: JSON.stringify({ imageData }) });
export const upgradeCharacterStat = (userId, stat) => request(`/api/characters/${userId}/stats`, { method: HTTP_METHOD.POST, body: JSON.stringify({ stat }) });
export const getEncounterBattle = (monsterNames) => {
  const names = Array.isArray(monsterNames) ? monsterNames : [monsterNames];
  return request(`/api/battles/encounter?monsterNames=${encodeURIComponent(JSON.stringify(names))}`);
};
export const getActiveBattle = () => request('/api/battles/active');
export const getAreaCombatTargets = () => request('/api/battles/area-targets');
export const startAreaEncounter = (targets) => request('/api/battles/area-encounter', { method: HTTP_METHOD.POST, body: JSON.stringify({ targets }) });
export const performBattleAction = (input) => request('/api/battles/actions', { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const startTraining = (config = {}) => request('/api/battles/training/start', { method: HTTP_METHOD.POST, body: JSON.stringify({ config }) });
export const updateTrainingConfig = (config = {}) => request('/api/battles/training/config', { method: HTTP_METHOD.POST, body: JSON.stringify({ config }) });
export const resetTraining = () => request('/api/battles/training/reset', { method: HTTP_METHOD.POST });
export const getVault = () => request('/api/vault');
export const depositVaultItem = (itemId, quantity = 1) => request('/api/vault/deposit', { method: HTTP_METHOD.POST, body: JSON.stringify({ itemId, quantity }) });
export const withdrawVaultItem = (itemId, quantity = 1) => request('/api/vault/withdraw', { method: HTTP_METHOD.POST, body: JSON.stringify({ itemId, quantity }) });
export const transferVaultGold = (amount, direction) => request('/api/vault/gold', { method: HTTP_METHOD.POST, body: JSON.stringify({ amount, direction }) });
export const getShop = (sublocationId) => request(`/api/sublocations/${sublocationId}/shop`);
export const equipItem = (characterId, input) => request(`/api/characters/${characterId}/equip`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const unequipItem = (characterId, input) => request(`/api/characters/${characterId}/unequip`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const useItem = (characterId, input) => request(`/api/characters/${characterId}/use-item`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const enterSublocation = (characterId, sublocationId, dialogueChoice = null) => request(`/api/characters/${characterId}/sublocation`, { method: HTTP_METHOD.POST, body: JSON.stringify({ sublocationId, dialogueChoice }) });
export const getDialogueLeaveCheck = (characterId, { type = 'sublocation', sublocationId = null } = {}) => request(`/api/characters/${characterId}/dialogue/leave-check?${new URLSearchParams({ type, ...(sublocationId ? { sublocationId: String(sublocationId) } : {}) })}`);
export const getResumableDialogues = (characterId) => request(`/api/characters/${characterId}/dialogue/resumable`);
export const resumeDialogues = (characterId) => request(`/api/characters/${characterId}/dialogue/resume`, { method: HTTP_METHOD.POST });
export const endDialogue = (characterId, targetNpcId) => request(`/api/characters/${characterId}/dialogue/end`, { method: HTTP_METHOD.POST, body: JSON.stringify({ targetNpcId }) });
export const getWorldTime = () => request('/api/world/time');
export const getWorldWeather = () => request('/api/world/weather');
export const getWorldTravelMap = (characterId) => request(`/api/characters/${characterId}/world-map`);
export const travelToLocation = (characterId, destinationId, dialogueChoice = null) => request(`/api/characters/${characterId}/travel`, { method: HTTP_METHOD.POST, body: JSON.stringify({ destinationId, dialogueChoice }) });
export const buyShopItem = (characterId, input) => request(`/api/characters/${characterId}/buy-item`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const sellShopItem = (characterId, input) => request(`/api/characters/${characterId}/sell-item`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const takeInnLongRest = (characterId) => request(`/api/characters/${characterId}/long-rest`, { method: HTTP_METHOD.POST });
export const fulfillInnFoodAndWater = (characterId) => request(`/api/characters/${characterId}/food-water`, { method: HTTP_METHOD.POST });
export const sendGameAction = (characterId, action, history = [], includeContextCheck = false, actionMode = ACTION_MODES.STORY, targetNpcId = null, revealNpcId = null, partyTurn = null, fateCheckId = null, skillCheckId = null, checkOrder = null, playerTools = null) => request(`/api/characters/${characterId}/action`, { method: HTTP_METHOD.POST, body: JSON.stringify({ action, history, includeContextCheck, actionMode, targetNpcId, ...(revealNpcId ? { revealNpcId } : {}), ...(partyTurn ? { partyTurn } : {}), ...(fateCheckId ? { fateCheckId } : {}), ...(skillCheckId ? { skillCheckId } : {}), ...(checkOrder ? { checkOrder } : {}), ...(playerTools?.length ? { playerTools } : {}) }) });
export const sendObserveAction = (characterId, { observeNpcAId, observeNpcBId, repeatCount, direction = '', history = [] }) => request(`/api/characters/${characterId}/observe`, { method: HTTP_METHOD.POST, body: JSON.stringify({ observeNpcAId, observeNpcBId, repeatCount, direction, history }) });
export const requestFateCheck = (characterId, question, odds, chaosFactor = null) => request(`/api/characters/${characterId}/fate-check`, { method: HTTP_METHOD.POST, body: JSON.stringify({ question, odds, chaosFactor }) });
export const requestSkillCheck = (characterId, skill, dc, rollMode) => request(`/api/characters/${characterId}/skill-check`, { method: HTTP_METHOD.POST, body: JSON.stringify({ skill, dc, rollMode }) });
export const getCharacterScenes = (characterId) => request(`/api/characters/${characterId}/scenes`);
export const createCharacterScene = (characterId, input) => request(`/api/characters/${characterId}/scenes`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const updateCharacterScene = (characterId, sceneId, input) => request(`/api/characters/${characterId}/scenes/${sceneId}`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
export const solveCharacterScene = (characterId, sceneId, resolution = '') => request(`/api/characters/${characterId}/scenes/${sceneId}/solve`, { method: HTTP_METHOD.POST, body: JSON.stringify({ resolution }) });
export const deleteCharacterScene = (characterId, sceneId) => request(`/api/characters/${characterId}/scenes/${sceneId}`, { method: HTTP_METHOD.DELETE });
export const getContextCheck = (characterId, action, history = [], actionMode = ACTION_MODES.STORY, targetNpcId = null) => request(`/api/characters/${characterId}/context-check`, { method: HTTP_METHOD.POST, body: JSON.stringify({ action, history, actionMode, targetNpcId }) });
export const getStoryHistory = (characterId) => request(`/api/characters/${characterId}/history`);
export const createStoryTurn = (characterId, input) => request(`/api/characters/${characterId}/stories`, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
export const updateStoryTurn = (storyId, input) => request(`/api/stories/${storyId}`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
export const deleteStoryTurn = (storyId) => request(`/api/stories/${storyId}`, { method: HTTP_METHOD.DELETE });
export const clearStoryHistory = (characterId) => request(`/api/characters/${characterId}/history`, { method: HTTP_METHOD.DELETE });
export const getCraftingData = () => request('/api/crafting');
export const craftRecipe = (recipeId, quantity = 1) => request(`/api/crafting/${recipeId}/craft`, { method: HTTP_METHOD.POST, body: JSON.stringify({ quantity }) });
export const upgradeItemLevel = (itemEntryId) => request('/api/crafting/upgrade', { method: HTTP_METHOD.POST, body: JSON.stringify({ itemEntryId }) });

export const getParty = () => request('/api/party');
export const getAllNpcs = () => request('/api/npcs');
export const getNearbyNpcs = () => request('/api/npcs/nearby');
export const getMetNpcs = () => request('/api/npcs/met');
export const getQuestBoard = () => request('/api/quests');
export const acceptQuest = (questId) => request(`/api/quests/${questId}/accept`, { method: HTTP_METHOD.POST });
export const completeQuest = (runId) => request(`/api/quests/${runId}/complete`, { method: HTTP_METHOD.POST });
export const abandonQuest = (runId) => request(`/api/quests/${runId}/abandon`, { method: HTTP_METHOD.POST });
export const createParty = (name) => request('/api/party/create', { method: HTTP_METHOD.POST, body: JSON.stringify({ name }) });
export const invitePartyMember = (target) => request('/api/party/invite', { method: HTTP_METHOD.POST, body: JSON.stringify({ target }) });
export const respondPartyInvite = (inviteId, accept) => request(`/api/party/invites/${inviteId}/respond`, { method: HTTP_METHOD.POST, body: JSON.stringify({ accept }) });
export const recruitNpc = (npcId) => request('/api/party/recruit-npc', { method: HTTP_METHOD.POST, body: JSON.stringify({ npcId }) });
export const dismissCompanion = (companionId) => request('/api/party/dismiss-npc', { method: HTTP_METHOD.POST, body: JSON.stringify({ companionId }) });
export const leaveParty = () => request('/api/party/leave', { method: HTTP_METHOD.POST });
export const updateCompanionTactics = (memberId, tacticsRole) => request(`/api/party/members/${memberId}/tactics`, { method: HTTP_METHOD.PATCH, body: JSON.stringify({ tacticsRole }) });
export const getGatheringData = () => request('/api/gathering');
export const executeGather = () => request('/api/gathering/gather', { method: HTTP_METHOD.POST });
export const getFishingData = () => request('/api/fishing');
export const executeFish = () => request('/api/fishing/fish', { method: HTTP_METHOD.POST });
export const getCampfire = () => request('/api/campfire');
export const restAtCampfire = (mode) => request('/api/campfire/rest', { method: HTTP_METHOD.POST, body: JSON.stringify({ mode }) });
export const getFarmingData = () => request('/api/farming');
export const executeFarm = (recipeId) => request('/api/farming/farm', { method: HTTP_METHOD.POST, body: JSON.stringify({ recipeId }) });
export const buyFarmingSeed = (seedItemId, quantity = 1) => request('/api/farming/buy-seeds', { method: HTTP_METHOD.POST, body: JSON.stringify({ seedItemId, quantity }) });

