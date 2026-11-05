import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { invokeWithResponseLog } from '../../../logs/responseLogger.js';
import { createHarnessChatModel } from './model.js';
import { HARNESS_TOOLS_MAP } from './tools/index.js';
import { AGENT_PIPELINE, HARNESS_STEP_STATUS } from '../../../configs/constants.js';
import { MASTER_DIRECTIVE, NARRATION_DIRECTIVE, formatNarrationSlot } from '../prompts/prompt_constant.js';

export { MASTER_DIRECTIVE, NARRATION_DIRECTIVE, formatNarrationSlot };

function messageText(message) {
  if (typeof message?.content === 'string') return message.content.trim();
  if (Array.isArray(message?.content)) return message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n\n').trim();
  return '';
}

function stripWrappingQuotes(text) {
  return String(text || '').trim().replace(/^["“]+/, '').replace(/["”]+$/, '').trim();
}

const SPEECH_PATTERN = /"([^"]+)"|“([^”]+)”|(?:^|(?<=[\s—–(]))'(.+?)'(?=[\s.,!?;:—–)]|$)|(?:^|(?<=[\s—–(]))‘(.+?)’(?=[\s.,!?;:—–)]|$)/g;

export function splitPerformance(text) {
  const source = String(text || '').trim();
  const parts = [];
  let cursor = 0;
  for (const match of source.matchAll(SPEECH_PATTERN)) {
    const action = source.slice(cursor, match.index).trim();
    if (action) parts.push({ type: 'action', text: action });
    const speech = (match[1] || match[2] || match[3] || match[4] || '').trim();
    if (speech) parts.push({ type: 'speech', text: speech });
    cursor = match.index + match[0].length;
  }
  const tail = source.slice(cursor).trim();
  if (tail) parts.push({ type: parts.length ? 'action' : 'speech', text: tail });
  return parts;
}

export function performanceBlock(npcName, roleplay) {
  const bodyLanguage = String(roleplay?.bodyLanguage || '').trim();
  const parts = splitPerformance(roleplay?.dialogue);
  const paragraphs = [];
  if (bodyLanguage) paragraphs.push(bodyLanguage);
  for (const part of parts) {
    if (part.type === 'speech') {
      const last = paragraphs[paragraphs.length - 1];
      if (last?.startsWith(`[Speaker: ${npcName}]:`)) paragraphs[paragraphs.length - 1] = `${last.slice(0, -1)} ${stripWrappingQuotes(part.text)}"`;
      else paragraphs.push(`[Speaker: ${npcName}]: "${stripWrappingQuotes(part.text)}"`);
    } else {
      paragraphs.push(part.text.replace(/^[—–\s]+|[—–\s]+$/g, ''));
    }
  }
  return paragraphs.filter(Boolean).join('\n\n');
}

export function mergeRoleplayIntoStory(story, npcName, roleplay, beat) {
  const token = AGENT_PIPELINE.NPC_SLOT_TOKEN;
  const dialogue = stripWrappingQuotes(roleplay?.dialogue);
  const block = dialogue ? performanceBlock(npcName, roleplay) : (beat || '');
  const firstSlot = story.indexOf(token);
  if (firstSlot === -1) return block ? `${story}\n\n${block}`.trim() : story;
  const before = story.slice(0, firstSlot).trimEnd();
  const after = story.slice(firstSlot + token.length).split(token).join('').trimStart();
  return [before, block, after].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function brieflyJson(value) {
  return JSON.stringify(value, null, 2);
}

export async function runSplitStory(state, config) {
  const steps = [];
  const turnContext = config?.configurable?.turnContext || state.turnContext || {};
  const model = config?.configurable?.modelInstance || turnContext.activeModel || createHarnessChatModel();
  const logName = state.character?.name;
  const targetNpc = state.targetNpc || config?.configurable?.targetNpc || null;
  const targetName = targetNpc?.character?.name || targetNpc?.name || null;

  const lastMessage = state.messages[state.messages.length - 1];
  // The Master's reply is used RAW: no parsing. The NPC chip alone decides roleplay.
  const rawBrief = messageText(lastMessage);
  const npcName = targetName || null;
  turnContext.masterBrief = rawBrief;
  steps.push({
    iteration: state.iterationCount,
    node: 'masterBrief',
    status: rawBrief ? HARNESS_STEP_STATUS.SUCCESS : HARNESS_STEP_STATUS.PARTIAL_ERROR,
    durationMs: 0,
    decision: `Raw Master brief passed on. NPC reacts: ${npcName || 'none'} (NPC chip).`,
    output: rawBrief
  });

  const narrationStart = Date.now();
  // Same layout as the Master: [static prompt] [history] [current state] [action],
  // then the per-turn NPC slot line and the Master's raw brief at the very end.
  const narrationMessages = [
    new SystemMessage({ content: turnContext.narrationSystemPrompt || '' }),
    ...(turnContext.initialMessages || []).slice(1),
    new SystemMessage({ content: formatNarrationSlot(npcName) }),
    new HumanMessage({ content: `MASTER SCENE BRIEF:\n${rawBrief}\n\nWrite the story now.` })
  ];
  let story = '';
  try {
    const response = await invokeWithResponseLog(model, narrationMessages, { agent: 'Narration Agent', logName, extra: { 'NPC slot': npcName || 'none' } });
    story = messageText(response);
    if (!story) throw new Error('Narration agent returned an empty story.');
    const slotCount = story.split(AGENT_PIPELINE.NPC_SLOT_TOKEN).length - 1;
    steps.push({
      iteration: state.iterationCount,
      node: 'narrationAgent',
      status: HARNESS_STEP_STATUS.SUCCESS,
      durationMs: Date.now() - narrationStart,
      decision: npcName ? `Draft written with ${slotCount} NPC slot(s).` : 'Draft written without an NPC slot.',
      output: story
    });
  } catch (error) {
    steps.push({ iteration: state.iterationCount, node: 'narrationAgent', status: HARNESS_STEP_STATUS.FAILED, durationMs: Date.now() - narrationStart, error: error.message, decision: 'Narration failed; the harness fallback narration is used.' });
    return { narration: '', steps, failed: true };
  }

  if (!npcName) {
    const narration = story.split(AGENT_PIPELINE.NPC_SLOT_TOKEN).join('').trim();
    return { narration, steps };
  }

  const roleplayStart = Date.now();
  let roleplay = null;
  const toolName = turnContext.partyTurn ? AGENT_PIPELINE.ROLEPLAY_PARTY_TOOL : AGENT_PIPELINE.ROLEPLAY_TOOL;
  try {
    turnContext.roleplayScene = { story, beat: rawBrief };
    const roleplayTool = HARNESS_TOOLS_MAP.get(toolName);
    const input = turnContext.partyTurn
      ? { npc_name: npcName, scene_context: rawBrief }
      : { npc_name: npcName, player_dialogue_or_intent: turnContext.cleanAction || '' };
    const rawOutput = await roleplayTool.invoke(input, config);
    roleplay = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    if (roleplay?.error) throw new Error(roleplay.error);
    steps.push({
      iteration: state.iterationCount,
      node: 'roleplayAgent',
      status: HARNESS_STEP_STATUS.SUCCESS,
      durationMs: Date.now() - roleplayStart,
      decision: `${npcName} performed via ${toolName}.`,
      output: brieflyJson({ dialogue: roleplay.dialogue, bodyLanguage: roleplay.bodyLanguage, emotion: roleplay.emotion })
    });
  } catch (error) {
    roleplay = null;
    steps.push({ iteration: state.iterationCount, node: 'roleplayAgent', status: HARNESS_STEP_STATUS.FAILED, durationMs: Date.now() - roleplayStart, error: error.message, decision: 'Roleplay failed; the slot is removed.' });
  } finally {
    turnContext.roleplayScene = null;
  }

  const hasSlot = story.includes(AGENT_PIPELINE.NPC_SLOT_TOKEN);
  const narration = mergeRoleplayIntoStory(story, npcName, roleplay, '');
  steps.push({
    iteration: state.iterationCount,
    node: 'mergeStory',
    status: HARNESS_STEP_STATUS.SUCCESS,
    durationMs: 0,
    decision: hasSlot ? 'Roleplay reply placed at the narrator slot.' : 'Narrator left no slot; roleplay reply appended at the end.'
  });
  return { narration, steps };
}
