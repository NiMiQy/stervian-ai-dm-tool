import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { invokeWithResponseLog } from '../../../logs/responseLogger.js';
import { npcObserveRoleplaySubagent } from '../subagents/npcRoleplay.js';
import { performanceBlock } from './splitPipeline.js';
import { HARNESS_STEP_STATUS, OBSERVE_MODE } from '../../../configs/constants.js';

const BEAT_LINE_PATTERN = /\[\[BEAT:[\s\S]*?\]\]/gi;
const BEAT_HEADING_PATTERN = /(?:^|\n)\s*(?:\*\*|#{1,4}\s*)?Beat\s*(\d+)\b[^\n]*/gi;
const STRAY_SPEAKER_PATTERN = /^\[(?:Speaker:\s*)?[^\]]+\]:\s*["“']?.*?(?:["”']|$)/gim;

function messageText(message) {
  if (typeof message?.content === 'string') return message.content.trim();
  if (Array.isArray(message?.content)) return message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n\n').trim();
  return '';
}

export function observeSlotToken(index) {
  return `${OBSERVE_MODE.SLOT_TOKEN_PREFIX}${index}${OBSERVE_MODE.SLOT_TOKEN_SUFFIX}`;
}

function normalizedName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function namesMatch(candidate, expected) {
  const left = normalizedName(candidate);
  const right = normalizedName(expected);
  if (!left || !right) return false;
  return left === right || right.split(' ').includes(left) || right.startsWith(`${left} `) || left.startsWith(`${right} `);
}

export function buildBeatOrder(npcA, npcB, repeat) {
  const order = [];
  for (let round = 0; round < repeat; round += 1) {
    order.push({ speaker: npcA, listener: npcB }, { speaker: npcB, listener: npcA });
  }
  return order.map((beat, index) => ({ ...beat, number: index + 1 }));
}

function defaultIntent(listenerName) {
  return OBSERVE_MODE.DEFAULT_INTENT.replace('{other}', listenerName);
}

export function parseObservePlan(rawPlan, order = []) {
  const source = String(rawPlan || '').trim();
  if (!source) {
    return {
      premise: '',
      beats: order.map((beat) => ({ ...beat, intent: defaultIntent(beat.listener.name) }))
    };
  }

  const matches = [...source.matchAll(BEAT_HEADING_PATTERN)];
  if (!matches.length) {
    return {
      premise: '',
      beats: order.map((beat) => ({ ...beat, intent: source }))
    };
  }

  const premise = source
    .slice(0, matches[0].index)
    .replace(/^(?:\*\*|#{1,4}\s*)?Scene\s*Premise(?:\*\*|\s*:)?\s*/i, '')
    .replace(/\n+---\s*$/g, '')
    .trim();

  const intentByBeat = new Map();
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const beatNum = Number(match[1]);
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const body = source
      .slice(start, end)
      .replace(/^\s*[:—–-]+\s*/, '')
      .replace(/\n+---\s*$/g, '')
      .trim();
    if (body && !intentByBeat.has(beatNum)) {
      intentByBeat.set(beatNum, body);
    }
  }

  return {
    premise,
    beats: order.map((beat) => ({
      ...beat,
      intent: intentByBeat.get(beat.number) || source || defaultIntent(beat.listener.name)
    }))
  };
}

export function parseObserveFrame(frame, beatCount) {
  const source = String(frame || '').replace(BEAT_LINE_PATTERN, '').replace(STRAY_SPEAKER_PATTERN, '');
  const pattern = new RegExp(OBSERVE_MODE.SLOT_PATTERN_SOURCE, 'g');
  const parts = [];
  let cursor = 0;
  let slotCount = 0;
  for (const match of source.matchAll(pattern)) {
    const before = source.slice(cursor, match.index).trim();
    if (before) parts.push({ type: 'text', text: before });
    if (slotCount < beatCount) {
      parts.push({ type: 'slot' });
      slotCount += 1;
    }
    cursor = match.index + match[0].length;
  }
  const tail = source.slice(cursor).trim();
  if (tail) parts.push({ type: 'text', text: tail });
  if (slotCount < beatCount) {
    const extra = Array.from({ length: beatCount - slotCount }, () => ({ type: 'slot' }));
    const lastSlot = parts.map((part) => part.type).lastIndexOf('slot');
    if (lastSlot === -1) parts.push(...extra);
    else parts.splice(lastSlot + 1, 0, ...extra);
  }
  return { parts, slotCount };
}

export function composeObserveStory(parts = [], blocks = [], stopBeforeSlot = Infinity) {
  const output = [];
  let slot = 0;
  for (const part of parts) {
    if (part.type === 'slot') {
      if (slot >= stopBeforeSlot) break;
      if (blocks[slot]) output.push(blocks[slot]);
      slot += 1;
    } else {
      output.push(part.text);
    }
  }
  return output.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function unheardLine(beat) {
  return `${beat.speaker.name} says something to ${beat.listener.name} too quietly for you to catch.`;
}

function describeLine(name, roleplay) {
  const dialogue = String(roleplay?.dialogue || '').trim();
  const body = String(roleplay?.bodyLanguage || '').trim();
  return [body ? `${name}: ${body}` : '', dialogue ? `${name} says: ${dialogue}` : ''].filter(Boolean).join('\n');
}

function formatPerformedBeats(performedBeats) {
  return performedBeats.map(({ beat, roleplay, performed }) => {
    const slot = observeSlotToken(beat.number);
    if (!performed) {
      return `Beat ${beat.number} (${beat.speaker.name} → ${beat.listener.name}) — Slot ${slot}:\n- Action & speech: ${unheardLine(beat)}`;
    }
    const body = String(roleplay.bodyLanguage || '').trim();
    const dialogue = String(roleplay.dialogue || '').trim();
    const emotion = String(roleplay.emotion || '').trim();
    return [
      `Beat ${beat.number} (${beat.speaker.name} → ${beat.listener.name}) — Slot ${slot}:`,
      ...(body ? [`- Performed body language & action (weave into prose before ${slot}): ${body}`] : []),
      ...(emotion ? [`- Emotion / tone: ${emotion}`] : []),
      `- Spoken dialogue (inserted automatically at ${slot}; do NOT repeat in prose): ${dialogue || '(silent)'}`
    ].join('\n');
  }).join('\n\n');
}

function fallbackFrame(total) {
  return Array.from({ length: total }, (_, index) => observeSlotToken(index + 1)).join('\n\n');
}

export async function runObservePipeline({
  model,
  logName = null,
  masterSystemPrompt,
  narrationSystemPrompt,
  historyMessages = [],
  masterState,
  narrationState,
  order,
  actors,
  locationContext = '',
  nsfwAllowed = false
}) {
  const steps = [];
  const total = order.length;

  const planStart = Date.now();
  let rawPlan = '';
  try {
    const response = await invokeWithResponseLog(model, [
      new SystemMessage({ content: masterSystemPrompt }),
      ...historyMessages,
      new SystemMessage({ content: masterState }),
      new HumanMessage({ content: `Plan the observed exchange now: a brief Scene Premise followed by exactly ${total} beats in the fixed order.` })
    ], { agent: 'Observe Master', logName, extra: { Beats: total } });
    rawPlan = messageText(response);
    steps.push({
      iteration: 1,
      node: 'observeMaster',
      status: rawPlan ? HARNESS_STEP_STATUS.SUCCESS : HARNESS_STEP_STATUS.PARTIAL_ERROR,
      durationMs: Date.now() - planStart,
      decision: rawPlan ? `Raw plan passed on for ${total} beat(s) in the fixed order.` : 'Master returned an empty plan; default beat intents are used.',
      output: rawPlan
    });
  } catch (error) {
    steps.push({ iteration: 1, node: 'observeMaster', status: HARNESS_STEP_STATUS.FAILED, durationMs: Date.now() - planStart, error: error.message, decision: 'Master failed; default beat intents are used.' });
  }

  const { premise, beats } = parseObservePlan(rawPlan, order);
  const slotList = beats.map((beat) => `${observeSlotToken(beat.number)} = ${beat.speaker.name} to ${beat.listener.name}`).join('\n');

  const fullBlocks = [];
  const speechBlocks = [];
  const performedBeats = [];
  let previousLine = '';

  for (let index = 0; index < total; index += 1) {
    const beat = beats[index];
    const actor = actors.get(beat.speaker.id) || {};
    const beatStart = Date.now();
    const sceneSoFar = [premise, ...fullBlocks.slice(0, index)].filter(Boolean).join('\n\n');
    const roleplay = await npcObserveRoleplaySubagent({
      modelInstance: model,
      logName,
      nsfwAllowed,
      npcName: beat.speaker.name,
      race: beat.speaker.race || 'Human',
      job: beat.speaker.job || 'NPC',
      alignment: beat.speaker.alignment || 'Neutral',
      appearance: beat.speaker.appearance || '',
      description: beat.speaker.description || '',
      otherNpcName: beat.listener.name,
      relationship: actor.relationship || null,
      memories: actor.memories || [],
      locationContext,
      sceneSoFar,
      previousLine,
      beatIntent: beat.intent,
      beatNumber: beat.number,
      totalBeats: total
    });
    const performed = roleplay.success && Boolean(String(roleplay.dialogue || '').trim() || String(roleplay.bodyLanguage || '').trim());
    const fullBlock = performed ? performanceBlock(beat.speaker.name, roleplay) : '';
    const speechBlock = performed ? performanceBlock(beat.speaker.name, { dialogue: roleplay.dialogue }) : '';
    fullBlocks.push(fullBlock || unheardLine(beat));
    speechBlocks.push(performed ? speechBlock : unheardLine(beat));
    performedBeats.push({ beat, roleplay, performed });
    previousLine = fullBlock ? describeLine(beat.speaker.name, roleplay) : unheardLine(beat);
    steps.push({
      iteration: 1,
      node: `observeRoleplay:${beat.number}`,
      status: fullBlock ? HARNESS_STEP_STATUS.SUCCESS : HARNESS_STEP_STATUS.FAILED,
      durationMs: Date.now() - beatStart,
      ...(fullBlock ? {} : { error: roleplay.error || 'Empty roleplay reply.' }),
      decision: fullBlock ? `${beat.speaker.name} performed beat ${beat.number} of ${total} towards ${beat.listener.name}.` : `${beat.speaker.name}'s beat ${beat.number} failed; a neutral line is inserted.`,
      output: fullBlock ? JSON.stringify({ dialogue: roleplay.dialogue, bodyLanguage: roleplay.bodyLanguage, emotion: roleplay.emotion }, null, 2) : ''
    });
  }

  const frameStart = Date.now();
  let frame = '';
  let narrationFailed = false;
  try {
    const response = await invokeWithResponseLog(model, [
      new SystemMessage({ content: narrationSystemPrompt }),
      ...historyMessages,
      new SystemMessage({ content: narrationState }),
      new HumanMessage({ content: `OBSERVE PLAN:\n${rawPlan || '(No master plan)'}\n\nPERFORMED BEATS (in fixed order):\n${formatPerformedBeats(performedBeats)}\n\nSLOTS (fixed order):\n${slotList}\n\nWeave the complete scene now in present tense. Incorporate each beat's performed body language naturally into the narration and place the exact ${total} slot tokens, ${observeSlotToken(1)} to ${observeSlotToken(total)}, alone on their own lines where each spoken dialogue occurs.` })
    ], { agent: 'Observe Narration', logName, extra: { Slots: total } });
    frame = messageText(response);
    if (!frame) throw new Error('Narration agent returned an empty frame.');
  } catch (error) {
    narrationFailed = true;
    steps.push({ iteration: 1, node: 'observeNarration', status: HARNESS_STEP_STATUS.FAILED, durationMs: Date.now() - frameStart, error: error.message, decision: 'Narration failed; a frame is built from the performed beats.' });
    frame = fallbackFrame(total);
  }

  const { parts, slotCount } = parseObserveFrame(frame, total);
  if (!narrationFailed) {
    steps.push({
      iteration: 1,
      node: 'observeNarration',
      status: slotCount === total ? HARNESS_STEP_STATUS.SUCCESS : HARNESS_STEP_STATUS.PARTIAL_ERROR,
      durationMs: Date.now() - frameStart,
      decision: slotCount === total ? `Scene woven with ${total} slot(s).` : `Scene had ${slotCount} of ${total} slot(s); missing beats are placed after the last slot.`,
      output: frame
    });
  }

  const blocks = narrationFailed ? fullBlocks : speechBlocks;
  const story = composeObserveStory(parts, blocks);
  steps.push({ iteration: 1, node: 'observeMerge', status: HARNESS_STEP_STATUS.SUCCESS, durationMs: 0, decision: `${total} beat(s) merged into the woven scene in order.` });
  return {
    story,
    steps,
    plan: rawPlan,
    beats: beats.map((beat) => ({ number: beat.number, speaker: beat.speaker.name, listener: beat.listener.name }))
  };
}
