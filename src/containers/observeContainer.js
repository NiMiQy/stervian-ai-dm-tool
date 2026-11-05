import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { getNearbyNpcs } from './npcContainer.js';
import { createStoryTurn } from '../services/storyService.js';
import { createNpcMemory, retrieveNpcMemories } from '../services/characterMemoryService.js';
import { nsfwWhere } from '../services/nsfwAccessService.js';
import { getLocationWeather, formatWeatherForPrompt } from '../services/locationWeatherService.js';
import { getCurrentAmbience, formatAmbienceForPrompt } from '../services/locationAmbienceService.js';
import { formatGameTimeForPrompt } from '../services/gameClockService.js';
import { formatLocationContext } from '../services/ai/prompts/formatters.js';
import { buildObserveStaticPrompt, CURRENT_STATE_HEADER, SECTION_SEPARATOR } from '../services/ai/prompts/builder.js';
import { applySlidingWindow } from '../services/ai/contextManager.js';
import { createHarnessChatModel } from '../services/ai/agentHarness/model.js';
import { buildBeatOrder, runObservePipeline } from '../services/ai/agentHarness/observePipeline.js';
import { extractJsonObject } from '../components/helpers/jsonParser.js';
import { invokeWithResponseLog } from '../logs/responseLogger.js';
import { writeHarnessLog } from '../logs/harnessLogger.js';
import { CHARACTER_TYPE, HTTP_STATUS, MEMORY_TYPE, OBSERVE_MODE, PROMPT_ROLE } from '../configs/constants.js';

export class ObserveError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = 'ObserveError';
    this.statusCode = statusCode;
  }
}

function positiveId(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function normalizeObserveRequest(body = {}) {
  const npcAId = positiveId(body.observeNpcAId);
  const npcBId = positiveId(body.observeNpcBId);
  if (!npcAId || !npcBId) throw new ObserveError('Pick two NPCs to observe.');
  if (npcAId === npcBId) throw new ObserveError('Pick two different NPCs.');

  const rawRepeat = body.repeatCount ?? OBSERVE_MODE.DEFAULT_REPEAT;
  const repeat = typeof rawRepeat === 'number' || (typeof rawRepeat === 'string' && rawRepeat.trim()) ? Number(rawRepeat) : NaN;
  if (!Number.isInteger(repeat) || repeat < OBSERVE_MODE.MIN_REPEAT || repeat > OBSERVE_MODE.MAX_REPEAT) {
    throw new ObserveError(`Repeat count must be ${OBSERVE_MODE.MIN_REPEAT} to ${OBSERVE_MODE.MAX_REPEAT}.`);
  }

  if (body.direction !== undefined && body.direction !== null && typeof body.direction !== 'string') {
    throw new ObserveError('Direction must be text.');
  }
  const direction = String(body.direction || '').replace(/\s+/g, ' ').trim();
  if (direction.length > OBSERVE_MODE.DIRECTION_MAX_LENGTH) {
    throw new ObserveError(`Direction is too long (max ${OBSERVE_MODE.DIRECTION_MAX_LENGTH} characters).`);
  }
  return { npcAId, npcBId, repeat, direction };
}

export function observeActionLabel(npcA, npcB, repeat, direction = '') {
  const label = `[${OBSERVE_MODE.ACTION_LABEL} ×${repeat}] ${npcA.name} & ${npcB.name}`;
  return direction ? `${label} — ${direction}` : label;
}

async function explainMissingNpc(db, npcId) {
  const npc = await db.npcs.findUnique({
    where: { character_id: npcId },
    select: { deleted: true, is_speakable: true, npc_monsters: { select: { character_id: true } }, character: { select: { name: true, deleted: true, character_type: true } } }
  });
  if (!npc || npc.deleted || !npc.character || npc.character.deleted || npc.character.character_type !== CHARACTER_TYPE.NPC) {
    return new ObserveError('That NPC does not exist.', HTTP_STATUS.NOT_FOUND);
  }
  if (npc.npc_monsters) return new ObserveError(`${npc.character.name} is a monster and cannot be observed.`);
  return new ObserveError(`${npc.character.name} is not here with you. Both NPCs must be in your current place.`);
}

async function loadParticipant(db, npcId, nearby) {
  const present = nearby.find((npc) => npc.id === npcId);
  if (!present) throw await explainMissingNpc(db, npcId);
  if (!present.is_speakable) throw new ObserveError(`${present.name} does not talk, so there is nothing to observe.`);
  const character = await db.characters.findUnique({
    where: { id: npcId },
    select: { id: true, name: true, race: true, job: true, alignment: true, appearance: true, description: true }
  });
  if (!character) throw new ObserveError('That NPC does not exist.', HTTP_STATUS.NOT_FOUND);
  return {
    ...character,
    name: character.name || present.name,
    description: String(character.description || '').replace(/\s+/g, ' ').trim().slice(0, OBSERVE_MODE.DESCRIPTION_MAX_LENGTH)
  };
}

async function loadActorContext(db, npc, other, nsfwAllowed) {
  const row = await db.npc_relationships.findFirst({
    where: { source_npc_id: npc.id, target_npc_id: other.id, deleted: false, ...nsfwWhere(nsfwAllowed) },
    select: { relationship_type: true, context_note: true },
    orderBy: { id: 'desc' }
  });
  const memories = await retrieveNpcMemories({ db, npcCharacterId: npc.id, targetCharacterId: other.id, limit: OBSERVE_MODE.MEMORY_LIMIT, nsfwAllowed });
  return {
    relationship: row ? { type: row.relationship_type, note: String(row.context_note || '').trim() } : null,
    memories: memories.map((memory) => String(memory.content || '').trim()).filter(Boolean)
  };
}

function formatParticipant(label, npc, other, actor, { includePrivate }) {
  const lines = [`- ${label}: ${npc.name} | ${npc.race || 'Human'} ${npc.job || 'NPC'} | ${npc.alignment || 'Neutral'}`];
  if (npc.appearance) lines.push(`  - Appearance: ${String(npc.appearance).replace(/\s+/g, ' ').trim()}`);
  if (includePrivate) {
    if (npc.description) lines.push(`  - Personality & Background: ${npc.description}`);
    lines.push(actor.relationship
      ? `  - ${npc.name}'s relationship with ${other.name}: ${actor.relationship.type}${actor.relationship.note ? ` — ${actor.relationship.note}` : ''}`
      : `  - ${npc.name} has no recorded relationship with ${other.name}.`);
    if (actor.memories.length) lines.push(`  - ${npc.name} remembers about ${other.name}: ${actor.memories.join(' | ')}`);
  } else if (actor.relationship) {
    lines.push(`  - Publicly known link to ${other.name}: ${actor.relationship.type}`);
  }
  return lines.join('\n');
}

function buildObserveState({ character, nearby, weather, ambience, npcA, npcB, actors, order, direction, includePrivate }) {
  const sections = [
    CURRENT_STATE_HEADER,
    formatLocationContext(character.location, character.sublocation, nearby, null, nearby.length),
    formatGameTimeForPrompt(),
    weather ? formatWeatherForPrompt(weather, { sublocation: character.sublocation }) : '',
    ambience ? formatAmbienceForPrompt(ambience, nearby) : '',
    `### Onlooker\nThe player character ${character.name || 'the adventurer'} is present and stays silent, only watching. Neither NPC addresses or reacts to the player.`,
    [
      '### Observe Request',
      formatParticipant('NPC A', npcA, npcB, actors.get(npcA.id), { includePrivate }),
      formatParticipant('NPC B', npcB, npcA, actors.get(npcB.id), { includePrivate }),
      `- Fixed beat order (${order.length} beats): ${order.map((beat) => `${beat.number}. ${beat.speaker.name} → ${beat.listener.name}`).join('; ')}`,
      ...(includePrivate ? [direction ? `- Player direction (follow it): "${direction}"` : '- Player direction: none. Decide the exchange yourself.'] : [])
    ].join('\n')
  ];
  return sections.filter((section) => String(section || '').trim()).join(SECTION_SEPARATOR);
}

function toHistoryMessages(history = []) {
  const { activeWindow } = applySlidingWindow(Array.isArray(history) ? history : [], OBSERVE_MODE.HISTORY_TURNS);
  return activeWindow.map((item) => {
    const text = String(item?.text || item?.content || '').trim();
    if (!text) return null;
    if (item.role === 'system') return new SystemMessage({ content: text });
    if (item.role === 'assistant') return new AIMessage({ content: text });
    return new HumanMessage({ content: text });
  }).filter(Boolean);
}

async function safeLoad(loader, label) {
  try {
    return await loader();
  } catch (error) {
    console.warn(`[observeContainer] Unable to load ${label}:`, error.message);
    return null;
  }
}

export async function runObserveScene({ userId, character, request, history = [], db = prisma, model = null }) {
  if (!character?.id) throw new ObserveError('Character not found.', HTTP_STATUS.NOT_FOUND);
  if (!character.location_id) throw new ObserveError('You are not at any location.');
  const overallStart = Date.now();
  const nsfwAllowed = character.nsfw_allowed === true;

  let npcA;
  let npcB;
  let nearby;
  const actors = new Map();
  try {
    nearby = await getNearbyNpcs(userId);
    npcA = await loadParticipant(db, request.npcAId, nearby);
    npcB = await loadParticipant(db, request.npcBId, nearby);
    actors.set(npcA.id, await loadActorContext(db, npcA, npcB, nsfwAllowed));
    actors.set(npcB.id, await loadActorContext(db, npcB, npcA, nsfwAllowed));
  } catch (error) {
    if (error instanceof ObserveError) throw error;
    throw databaseError('observeContainer', 'load observed NPCs', error);
  }

  const [weather, ambience] = await Promise.all([
    safeLoad(() => getLocationWeather(character.location_id), 'location weather'),
    safeLoad(() => getCurrentAmbience(character.location_id, character.sublocation_id || null), 'location ambience')
  ]);

  const order = buildBeatOrder(npcA, npcB, request.repeat);
  const stateOptions = { character, nearby, weather, ambience, npcA, npcB, actors, order, direction: request.direction };
  const activeModel = model || createHarnessChatModel();
  const label = observeActionLabel(npcA, npcB, request.repeat, request.direction);

  const result = await runObservePipeline({
    model: activeModel,
    logName: character.name,
    masterSystemPrompt: buildObserveStaticPrompt({ role: PROMPT_ROLE.MASTER, nsfwAllowed }),
    narrationSystemPrompt: buildObserveStaticPrompt({ role: PROMPT_ROLE.NARRATION, nsfwAllowed }),
    historyMessages: toHistoryMessages(history),
    masterState: buildObserveState({ ...stateOptions, includePrivate: true }),
    narrationState: buildObserveState({ ...stateOptions, includePrivate: false }),
    order,
    actors,
    nsfwAllowed,
    locationContext: character.sublocation?.name ? `${character.sublocation.name} (${character.location?.name || 'Stervian Land'})` : (character.location?.name || '')
  });

  try {
    writeHarnessLog({
      userId,
      characterId: Number(character.id),
      actionText: label,
      character,
      model: activeModel?.model || 'observe',
      iterationCount: 1,
      maxIterations: 1,
      totalDurationMs: Date.now() - overallStart,
      isFallback: false,
      isMetaJailbreak: false,
      context: { mode: 'observe', npcA: npcA.name, npcB: npcB.name, repeat: request.repeat, beats: order.length, direction: request.direction || null },
      failedStep: null,
      failedMessage: null,
      iterationFailed: null,
      steps: result.steps,
      finalStory: result.story
    });
  } catch (logError) {
    console.warn('[observeContainer] Failed to write the observe log:', logError.message);
  }

  return { ...result, label, npcA, npcB, model: activeModel, nsfwAllowed };
}

export async function saveObserveStory({ userId, character, label, story }) {
  return createStoryTurn({
    userId,
    characterId: character.id,
    actionFromPlayer: label,
    story,
    locationId: character.location_id ?? null,
    sublocationId: character.sublocation_id ?? null
  });
}

export async function saveObserveMemories({ db = prisma, model, npcA, npcB, story, nsfwAllowed = false }) {
  if (!model || typeof model.invoke !== 'function' || !String(story || '').trim()) return [];
  const response = await invokeWithResponseLog(model, [
    new SystemMessage({ content: 'You distill NPC memories for an RPG.' }),
    new HumanMessage({ content: `Scene between ${npcA.name} and ${npcB.name}:\n${story}\n\nWrite what each NPC will remember about the other from this scene, one short sentence each, from their own point of view, using only what happened in the scene. Do not mention any onlooker.\nReturn a single-line JSON object: {"a":"what ${npcA.name} remembers about ${npcB.name}","b":"what ${npcB.name} remembers about ${npcA.name}"}` })
  ], { agent: 'Observe Memory Worker', logName: `${npcA.name}_${npcB.name}` });
  const parsed = extractJsonObject(String(response?.content || ''));
  if (!parsed) return [];
  const saved = [];
  for (const [owner, target, content] of [[npcA, npcB, parsed.a], [npcB, npcA, parsed.b]]) {
    if (!String(content || '').trim()) continue;
    saved.push(await createNpcMemory({ db, npcCharacterId: owner.id, targetCharacterId: target.id, content, memoryType: MEMORY_TYPE.SHORT_TERM, isNsfw: nsfwAllowed, modelInstance: model }));
  }
  return saved;
}
