import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { broadcastToUsers } from './webSocketService.js';
import { getGameTime, onGameTimeSlotChange } from './gameClockService.js';
import { getLocationWeather, pickWeighted } from './locationWeatherService.js';
import { createStoryTurn } from './storyService.js';
import { getOnlineTracker } from './onlineResourceService.js';
import { AMBIENCE, ANY_TIME_SLOT, CHARACTER_TYPE, GAME_CLOCK, WEBSOCKET_EVENTS } from '../configs/constants.js';

const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

export function ambienceScopeKey(locationId, sublocationId = null) {
  return `${Number(locationId) || 0}:${Number(sublocationId) || 0}`;
}

export function pickFigures(figures = [], minFigures = 0, maxFigures = 0, random = Math.random) {
  const pool = figures.filter((figure) => figure?.label && Number(figure.weight) > 0).map((figure) => ({ ...figure }));
  const low = Math.max(0, Math.min(Number(minFigures) || 0, Number(maxFigures) || 0));
  const high = Math.max(low, Number(maxFigures) || 0);
  const count = Math.min(pool.length, low + Math.floor(random() * (high - low + 1)));
  const picked = [];
  for (let index = 0; index < count; index += 1) {
    const key = pickWeighted(Object.fromEntries(pool.map((figure, position) => [position, Number(figure.weight)])), random);
    const [figure] = pool.splice(Number(key), 1);
    picked.push(figure.label);
  }
  return picked;
}

function slotLabel(slot) {
  return GAME_CLOCK.SLOTS.find((entry) => entry.slot === slot)?.label || slot;
}

function previousSlotLabel(slot) {
  const index = GAME_CLOCK.SLOTS.findIndex((entry) => entry.slot === slot);
  if (index === -1) return null;
  return GAME_CLOCK.SLOTS[(index - 1 + GAME_CLOCK.SLOTS.length) % GAME_CLOCK.SLOTS.length].label;
}

export function isAmbienceFresh(state, gameTime = getGameTime()) {
  return isFresh(state, gameTime);
}

function isFresh(state, gameTime) {
  return Boolean(state) && state.time_slot === gameTime.slot && new Date(state.slot_started_at).getTime() >= new Date(gameTime.startedAt).getTime() - 1000;
}

async function findMatchingTemplates(client, locationId, sublocationId, slot, weather) {
  return client.ambiences.findMany({
    where: {
      location_id: Number(locationId),
      sublocation_id: sublocationId ? Number(sublocationId) : null,
      deleted: { not: true },
      is_active: true,
      weight: { gt: 0 },
      time_slot: { in: [slot, ANY_TIME_SLOT] },
      OR: [{ weather: null }, ...(weather ? [{ weather }] : [])],
    },
    include: { figures: true },
  });
}

async function buildStateData(client, locationId, sublocationId, gameTime, random = Math.random) {
  const weatherRecord = await getLocationWeather(locationId, client);
  const weather = weatherRecord?.weather || null;
  const templates = await findMatchingTemplates(client, locationId, sublocationId, gameTime.slot, weather);
  const base = {
    location_id: Number(locationId),
    sublocation_id: sublocationId ? Number(sublocationId) : null,
    time_slot: gameTime.slot,
    weather,
    slot_started_at: new Date(gameTime.startedAt),
  };
  if (!templates.length) return { ...base, ambience_id: null, crowd_level: null, description: null, figures: [] };
  const weights = Object.fromEntries(templates.map((template) => [template.id, template.weight]));
  const pickedId = pickWeighted(weights, random);
  const template = templates.find((entry) => String(entry.id) === String(pickedId)) || templates[0];
  return {
    ...base,
    ambience_id: template.id,
    crowd_level: template.crowd_level,
    description: template.description,
    figures: pickFigures(template.figures, template.min_figures, template.max_figures, random),
  };
}

export async function rollAmbience(locationId, sublocationId = null, { client = prisma, gameTime = getGameTime() } = {}) {
  const scopeKey = ambienceScopeKey(locationId, sublocationId);
  try {
    const existing = await client.location_ambience_states.findUnique({ where: { scope_key: scopeKey } });
    if (isFresh(existing, gameTime)) return { state: existing, rolled: false };
    const data = await buildStateData(client, locationId, sublocationId, gameTime);
    if (existing) {
      const result = await client.location_ambience_states.updateMany({ where: { id: existing.id, slot_started_at: existing.slot_started_at }, data });
      const state = await client.location_ambience_states.findUnique({ where: { scope_key: scopeKey } });
      return { state, rolled: result.count > 0 };
    }
    try {
      const state = await client.location_ambience_states.create({ data: { scope_key: scopeKey, ...data } });
      return { state, rolled: true };
    } catch (error) {
      if (error?.code !== PRISMA_UNIQUE_CONSTRAINT_CODE) throw error;
      return { state: await client.location_ambience_states.findUnique({ where: { scope_key: scopeKey } }), rolled: false };
    }
  } catch (error) {
    throw databaseError('rollAmbience', 'roll location ambience', error);
  }
}

export async function getCurrentAmbience(locationId, sublocationId = null, client = prisma) {
  if (!Number(locationId)) return null;
  const { state } = await rollAmbience(locationId, sublocationId, { client });
  return state?.ambience_id ? state : null;
}

function figureList(figures) {
  const list = Array.isArray(figures) ? figures.filter(Boolean) : [];
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

const ROLE_WORD_MIN_LENGTH = 4;

function roleWords(value) {
  return (String(value || '').toLowerCase().match(/[\p{L}]+/gu) || []).filter((word) => word.length >= ROLE_WORD_MIN_LENGTH);
}

function canonicalNpcSummary(npc) {
  const character = npc?.character || npc || {};
  return { name: character.name, job: character.job || '', race: character.race || '' };
}

export function findRoleOverlaps(figures = [], canonicalNpcs = []) {
  const overlaps = [];
  for (const npc of canonicalNpcs.map(canonicalNpcSummary).filter((entry) => entry.name)) {
    const npcWords = roleWords(`${npc.job} ${npc.name}`);
    const matched = figures.filter((figure) => roleWords(figure).some((word) => npcWords.some((npcWord) => word.startsWith(npcWord) || npcWord.startsWith(word))));
    if (matched.length) overlaps.push({ npc, figures: matched });
  }
  return overlaps;
}

export function formatAmbienceForPrompt(state, canonicalNpcs = []) {
  if (!state?.ambience_id) return '';
  const figures = Array.isArray(state.figures) ? state.figures.filter(Boolean) : [];
  const canonical = canonicalNpcs.map(canonicalNpcSummary).filter((entry) => entry.name);
  const canonicalList = canonical.length
    ? canonical.map((npc) => `${npc.name}${npc.job ? ` (${npc.job})` : ''}`).join('; ')
    : 'none listed here';
  const lines = [
    `### Ambience: ${state.crowd_level} (${AMBIENCE.CROWD_LABELS[state.crowd_level] || 'moderately busy'})`,
    `- Scene: ${state.description}`,
    '',
    '#### Two SEPARATE groups of people are present. Never mix them.',
    `1. CANONICAL NPCs (real, named world characters from the NPC table above): ${canonicalList}.`,
    '   - They have names, memories and relationships, can be spoken to with roleplay tools, and are the only people (besides world events) who can give quests, items or rewards.',
    '   - When they appear in narration, keep their own identity: use their name or their own distinctive appearance.',
    `2. NON-CANONICAL CROWD EXTRAS (unnamed, narration-only, shared by every player here): ${figures.length ? figures.join('; ') : 'none in particular'}.`,
    '   - They have NO names, NO stats, NO memories. Refer to them only by role and activity.',
    '   - They MAY speak briefly (see the Conversational Target rules): short quoted words inside a narration sentence, never [Speaker: ...] tags, never a standalone quoted paragraph, never the roleplay_npc tool.',
    '   - They are NOT in the NPC table, cannot be targeted with roleplay tools, cannot give or sell quests, items, gold, keys, maps, rewards or quest-unlocking information, and cannot join the party. If the player tries, narrate a plausible in-world refusal or dead end.',
    '- SEPARATION RULES:',
    '   - A crowd extra is NEVER a canonical NPC, and a canonical NPC is NEVER one of the crowd extras.',
    "   - Never give a crowd extra a canonical NPC's name, rank, title, armor, weapon, crest or other distinctive appearance, and never describe a canonical NPC as part of the crowd.",
    '   - If both groups share a role (e.g. a guard captain and ordinary guards), narrate them as clearly different people.',
    '   - If the player addresses an ambiguous person (e.g. "the guard") and a canonical NPC fits that role, they mean the canonical NPC.',
    '- Mention the crowd extras when the player looks around or arrives. Do not invent additional people beyond these two groups; small non-human details (smoke, animals, sounds) are fine.',
    '- Keep the crowd level and these extras consistent until the time of day changes.',
  ];
  for (const overlap of findRoleOverlaps(figures, canonicalNpcs)) {
    lines.push(`- ROLE OVERLAP: ${overlap.npc.name}${overlap.npc.job ? ` (${overlap.npc.job})` : ''} is a separate, named canonical person. The crowd extras "${overlap.figures.join('", "')}" are ordinary unnamed people, not ${overlap.npc.name}. Do not give them ${overlap.npc.name}'s appearance, gear, rank or name.`);
  }
  return lines.join('\n');
}

export function buildAmbienceNotice(state, placeName) {
  if (!state?.ambience_id) return '';
  const previous = previousSlotLabel(state.time_slot);
  const current = slotLabel(state.time_slot);
  const crowd = AMBIENCE.CROWD_LABELS[state.crowd_level] || 'moderately busy';
  const figures = figureList(state.figures);
  const transition = previous ? `${previous} gives way to ${current.toLowerCase()} in ${placeName}.` : `It is now ${current.toLowerCase()} in ${placeName}.`;
  return `*${transition}* ${state.description} The place is ${crowd}${figures ? `; among those here: ${figures}` : ''}.`;
}

async function placeName(client, locationId, sublocationId) {
  if (sublocationId) {
    const sublocation = await client.sublocations.findUnique({ where: { id: Number(sublocationId) }, select: { name: true } });
    if (sublocation?.name) return sublocation.name;
  }
  const location = await client.locations.findUnique({ where: { id: Number(locationId) }, select: { name: true } });
  return location?.name || 'this place';
}

async function notifyPlayersInScope(client, state) {
  const players = await client.characters.findMany({
    where: {
      deleted: { not: true },
      character_type: CHARACTER_TYPE.PLAYER,
      user_id: { not: null },
      location_id: state.location_id,
      sublocation_id: state.sublocation_id ?? null,
    },
    select: { id: true, user_id: true },
  });
  const onlinePlayers = players.filter((player) => getOnlineTracker(player.user_id));
  if (!onlinePlayers.length) return 0;
  const story = buildAmbienceNotice(state, await placeName(client, state.location_id, state.sublocation_id));
  if (!story) return 0;
  let delivered = 0;
  for (const player of onlinePlayers) {
    const turn = await createStoryTurn({
      userId: player.user_id,
      characterId: player.id,
      actionFromPlayer: '',
      story,
      locationId: state.location_id,
      sublocationId: state.sublocation_id,
    });
    delivered += broadcastToUsers(player.user_id, WEBSOCKET_EVENTS.AMBIENCE_NOTICE, { storyId: turn.id, story, timestamp: Date.now() });
  }
  return delivered;
}

export async function rollAllAmbiences(gameTime = getGameTime(), { client = prisma, notify = true } = {}) {
  let scopes;
  try {
    scopes = await client.ambiences.findMany({
      where: { deleted: { not: true }, is_active: true },
      distinct: ['location_id', 'sublocation_id'],
      select: { location_id: true, sublocation_id: true },
    });
  } catch (error) {
    throw databaseError('rollAllAmbiences', 'load ambience scopes', error);
  }
  let rolled = 0;
  let notified = 0;
  for (const scope of scopes) {
    try {
      const result = await rollAmbience(scope.location_id, scope.sublocation_id, { client, gameTime });
      if (!result.rolled) continue;
      rolled += 1;
      if (notify) notified += await notifyPlayersInScope(client, result.state);
    } catch (error) {
      console.warn(`[rollAllAmbiences] Scope ${ambienceScopeKey(scope.location_id, scope.sublocation_id)} failed:`, error.message);
    }
  }
  return { scopes: scopes.length, rolled, notified };
}

let unsubscribe = null;

export function startAmbienceSystem() {
  if (unsubscribe) return stopAmbienceSystem;
  unsubscribe = onGameTimeSlotChange((gameTime) => rollAllAmbiences(gameTime));
  rollAllAmbiences(getGameTime(), { notify: false }).catch((error) => console.warn('[startAmbienceSystem] Initial ambience roll failed:', error.message));
  return stopAmbienceSystem;
}

export function stopAmbienceSystem() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}
