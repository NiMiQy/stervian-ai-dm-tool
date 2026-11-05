import {
  ANTI_JAILBREAK_RULE_SECTION,
  NSFW_NARRATION_SECTION,
  WORLD_CURRENCY,
  WORLD_LORE_SECTION,
  CROWD_EXTRAS_RULES_SECTION,
  MASTER_DIRECTIVE,
  MEMORY_RULES_SECTION,
  NARRATION_DIRECTIVE,
  OBSERVE_MASTER_DIRECTIVE,
  OBSERVE_NARRATION_DIRECTIVE,
} from './prompt_constant.js';
import { formatCharacterContext, formatLocationContext, formatPartyContext } from './formatters.js';
import { formatGameTimeForPrompt } from '../../gameClockService.js';
import { formatWeatherForPrompt } from '../../locationWeatherService.js';
import { formatAmbienceForPrompt } from '../../locationAmbienceService.js';
import { formatNpcIdentityForPrompt, formatRevealResultForPrompt } from '../../npcIdentityService.js';
import { formatPartyRevealResultsForPrompt, formatPartyTurnForPrompt } from '../../partyTurnService.js';
import { formatFateCheckForPrompt } from '../../../containers/core/fateRules.js';
import { formatCheckOrderForPrompt, formatSkillCheckForPrompt } from '../../../containers/core/skillCheckRules.js';
import { formatPlayerToolResultsForPrompt } from '../../playerToolService.js';
import { CHECK_ORDER, MAX_ONGOING_SCENES, MEMORY_TTL_MS, MEMORY_TYPE, PROMPT_ROLE } from '../../../configs/constants.js';

export { WORLD_LORE_SECTION, formatCharacterContext, formatLocationContext, formatPartyContext };

export const SECTION_SEPARATOR = '\n\n---\n\n';

export const CURRENT_STATE_HEADER = `### Current State (authoritative for this turn)
Everything below describes the world right now. It overrides anything earlier in the conversation.`;

export const SAFE_CONTENT_RULE = `### Content Rating: General (NSFW disabled for this player)
- Do not write sexual, erotic, or sexually explicit content of any kind. Romance stays non-sexual; fade to black and move the scene on.
- Do not use crude sexual language or describe nudity or sexual anatomy.
- Violence and dark fantasy themes are allowed, but avoid gratuitous gore.
- If the player pushes for sexual content, steer the story elsewhere in-world without breaking immersion.`;

export function toSafeContentSection(text) {
  return String(text || '')
    .replace(/adult, \+18, fully explicit allowed\./g, 'non-sexual, suitable for a general audience.')
    .replace(/\nSome things about you:[\s\S]*?(?=\n# DM TIPS)/g, '\nYou are the authoritative, evocative Dungeon Master (DM) for Stervian Land.\n')
    .replace(/^- During explicit scenes.*$\n?/gm, '')
    .replace(/ \(especially explicit content\)/g, '')
    .replace(/\nAs an AI DM[\s\S]*$/g, '')
    .trim();
}

function createSegmentList() {
  const segments = [];

  const add = (category, text) => {
    const value = String(text || '').trim();
    if (!value) return;
    if (segments.length) segments.push({ category: 'system', text: SECTION_SEPARATOR });
    segments.push({ category, text: value });
  };

  return { segments, add };
}

export function joinSegments(segments = []) {
  return segments.map((segment) => segment.text).join('');
}

export function buildStaticPromptSegments({ role = PROMPT_ROLE.MASTER, nsfwAllowed = false } = {}) {
  const { segments, add } = createSegmentList();
  const rated = (text) => (nsfwAllowed ? text : toSafeContentSection(text));

  if (role === PROMPT_ROLE.NARRATION) add('system', rated(WORLD_LORE_SECTION));
  else add('system', WORLD_CURRENCY);

  if (!nsfwAllowed && role !== PROMPT_ROLE.NARRATION) {
    add('system', SAFE_CONTENT_RULE);
  }

  if (role === PROMPT_ROLE.NARRATION) {
    if (nsfwAllowed) add('system', NSFW_NARRATION_SECTION);
    add('system', NARRATION_DIRECTIVE);
  } else {
    add('system', ANTI_JAILBREAK_RULE_SECTION);
    add('system', MASTER_DIRECTIVE);
  }

  return segments;
}

export function buildStaticPrompt(options = {}) {
  return joinSegments(buildStaticPromptSegments(options));
}

export function buildObserveStaticPrompt({ role = PROMPT_ROLE.MASTER, nsfwAllowed = false } = {}) {
  const { segments, add } = createSegmentList();
  const rated = (text) => (nsfwAllowed ? text : toSafeContentSection(text));

  if (role === PROMPT_ROLE.NARRATION) {
    add('system', rated(WORLD_LORE_SECTION));
    if (!nsfwAllowed) add('system', SAFE_CONTENT_RULE);
    add('targetDirectives', CROWD_EXTRAS_RULES_SECTION);
    add('system', MEMORY_RULES_SECTION);
    if (nsfwAllowed) add('system', NSFW_NARRATION_SECTION);
    add('system', OBSERVE_NARRATION_DIRECTIVE);
  } else {
    add('system', WORLD_CURRENCY);
    if (!nsfwAllowed) add('system', SAFE_CONTENT_RULE);
    add('system', ANTI_JAILBREAK_RULE_SECTION);
    if (nsfwAllowed) add('system', NSFW_NARRATION_SECTION);
    add('system', OBSERVE_MASTER_DIRECTIVE);
  }

  return joinSegments(segments);
}

function targetName(targetNpc) {
  return targetNpc ? (targetNpc.character?.name || targetNpc.name || 'Target NPC') : null;
}

function formatConversationalTarget(targetNpc, character, npcIdentity, playerNameRevealed) {
  const name = targetName(targetNpc);
  if (!name) {
    return '### Conversational Target: NONE';
  }

  const identity = npcIdentity || { is_player_name_revealed: playerNameRevealed };
  return [
    `### Conversational Target: ${name}`,
    formatNpcIdentityForPrompt(identity, name, character?.name)
  ].join('\n\n');
}

function formatPartyTurnSection(partyTurn, targetNpc) {
  if (!partyTurn) return '';

  const sections = [formatPartyTurnForPrompt(partyTurn, targetName(targetNpc))];
  const reveals = formatPartyRevealResultsForPrompt(partyTurn.revealResults || []);
  if (reveals) {
    sections.push(`### Name Reveals This Turn (system-confirmed)\n${reveals}`);
  }

  return sections.join('\n\n');
}

export function formatActiveScenesForPrompt(activeScenes = []) {
  const scenes = Array.isArray(activeScenes) ? activeScenes : [];
  const lines = [`### Active Scenes (${scenes.length}/${MAX_ONGOING_SCENES} on-going)`];

  if (!scenes.length) {
    lines.push('The player has no on-going scenes.');
    return lines.join('\n');
  }

  scenes.forEach((scene) => {
    const npc = scene.npc_name ? ` | Canon NPC: ${scene.npc_name}` : '';
    const notes = scene.scene_notes ? ` | Notes: ${String(scene.scene_notes).replace(/\s+/g, ' ').slice(0, 300)}` : '';
    lines.push(`- Scene #${scene.id} | Goal: ${scene.scene_goal} | Chaos Factor: ${scene.chaos_factor}${npc}${notes}`);
  });

  return lines.join('\n');
}

function isMemoryVisible(record) {
  if (typeof record === 'string') return true;
  if (record?.is_secret || record?.memory_type === MEMORY_TYPE.SECRET) return false;

  const ttl = MEMORY_TTL_MS[record?.memory_type];
  if (ttl === undefined) return true;

  const age = Date.now() - new Date(record?.created_at || Date.now()).getTime();
  return age <= ttl;
}

function formatCharacterMemories(character) {
  const memories = (character?.character_memories || [])
    .filter(isMemoryVisible)
    .map((record) => (typeof record === 'string' ? record : record?.content || record?.memory))
    .filter((memory) => typeof memory === 'string' && memory.trim());

  if (!memories.length) return '';

  return [
    '### Active Character Memories',
    ...memories.map((memory) => `* ${memory.trim()}`)
  ].join('\n');
}

function formatTargetNpcMemories(targetNpc, targetNpcMemories) {
  if (!Array.isArray(targetNpcMemories) || !targetNpcMemories.length) return '';

  return [
    `### Persistent Memories & Past Encounters for ${targetName(targetNpc)}`,
    'Canonical events this NPC explicitly remembers from past interactions with players:',
    ...targetNpcMemories.map((memory) => `* ${memory}`)
  ].join('\n');
}

export function buildTurnStateSegments({
  character,
  nearbyNpcs = [],
  party = null,
  partySilhouette = null,
  targetNpc = null,
  targetNpcMemories = null,
  playerNameRevealed = false,
  npcIdentity = null,
  revealResult = null,
  partyTurn = null,
  totalNpcCount = 0,
  locationWeather = null,
  locationAmbience = null,
  activeScenes = [],
  fateCheck = null,
  skillCheck = null,
  sceneChangeNote = '',
  playerToolResults = []
} = {}) {
  const { segments, add } = createSegmentList();

  // Where the player is and who is around.
  add('system', CURRENT_STATE_HEADER);
  add('system', formatLocationContext(character?.location, character?.sublocation, nearbyNpcs, targetNpc, totalNpcCount));
  add('system', partySilhouette || formatPartyContext(party, character));

  // The player character.
  add('system', formatCharacterContext(character));

  // Time, weather and crowd.
  add('system', formatGameTimeForPrompt());
  if (locationWeather) add('system', formatWeatherForPrompt(locationWeather, { sublocation: character?.sublocation }));
  if (locationAmbience) add('system', formatAmbienceForPrompt(locationAmbience, nearbyNpcs));

  // Who the player is talking to.
  add('targetDirectives', formatConversationalTarget(targetNpc, character, npcIdentity, playerNameRevealed));

  // Events that only exist this turn.
  if (revealResult) add('system', formatRevealResultForPrompt(revealResult));
  add('system', formatPartyTurnSection(partyTurn, targetNpc));
  add('system', sceneChangeNote);
  const checkSections = [
    fateCheck ? formatFateCheckForPrompt(fateCheck) : '',
    skillCheck ? formatSkillCheckForPrompt(skillCheck) : ''
  ].filter(Boolean);
  if (fateCheck && skillCheck) {
    if (skillCheck.order !== CHECK_ORDER.FATE_FIRST) checkSections.reverse();
    add('system', formatCheckOrderForPrompt(skillCheck.order));
  }
  checkSections.forEach((section) => add('system', section));
  add('system', formatPlayerToolResultsForPrompt(playerToolResults));

  // Threads and memories.
  add('scenes', formatActiveScenesForPrompt(activeScenes));
  add('characterMemory', formatCharacterMemories(character));
  add('npcMemory', formatTargetNpcMemories(targetNpc, targetNpcMemories));

  return segments;
}

export function buildTurnState(options = {}) {
  return joinSegments(buildTurnStateSegments(options));
}

export function buildDungeonMasterPromptSegments(options = {}) {
  const nsfwAllowed = options.character?.nsfw_allowed === true;
  const staticSegments = buildStaticPromptSegments({ role: options.role || PROMPT_ROLE.MASTER, nsfwAllowed });
  const stateSegments = buildTurnStateSegments(options);

  return [
    ...staticSegments,
    { category: 'system', text: SECTION_SEPARATOR },
    ...stateSegments
  ];
}

export function buildDungeonMasterPrompt(options = {}) {
  return joinSegments(buildDungeonMasterPromptSegments(options));
}
