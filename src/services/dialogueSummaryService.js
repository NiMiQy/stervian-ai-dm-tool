import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { createNpcMemory } from './characterMemoryService.js';
import { createHarnessChatModel } from './ai/agentHarness/model.js';
import { extractJsonObject } from '../components/helpers/jsonParser.js';
import { invokeWithResponseLog } from '../logs/responseLogger.js';
import { getNpcIdentity, maskUnrevealedName, nameNpcUses } from './npcIdentityService.js';
import {
  DIALOGUE_SESSION_STATUS,
  DIALOGUE_SESSION_TYPE,
  DIALOGUE_SUMMARY_DELAY_MS,
  DIALOGUE_SUMMARY_MESSAGE_LIMIT,
  DIALOGUE_SUMMARY_TRANSCRIPT_MAX_LENGTH,
  MEMORY_TYPE
} from '../configs/constants.js';

const summarizedSessionIds = new Set();

function buildTranscript(messages, realName, knownName, nameRevealed) {
  const lines = messages.map((message) => {
    const speaker = !nameRevealed && message.speaker_name === realName ? knownName : message.speaker_name;
    const content = String(message.content || '').replace(/\s+/g, ' ').trim();
    return `${speaker}: ${nameRevealed ? content : maskUnrevealedName(content, realName, knownName)}`;
  });
  const transcript = lines.join('\n');
  return transcript.length > DIALOGUE_SUMMARY_TRANSCRIPT_MAX_LENGTH ? transcript.slice(-DIALOGUE_SUMMARY_TRANSCRIPT_MAX_LENGTH) : transcript;
}

function fallbackSummary(npcName, realName, knownName, messages) {
  const playerLines = messages.filter((message) => message.speaker_name === realName).map((message) => String(message.content || '').trim()).filter(Boolean);
  const topic = (playerLines[0] || 'small talk').replace(/[\n"]/g, ' ').slice(0, 120);
  return `${npcName} remembers a conversation with ${knownName} that began with "${topic}" and ended after ${messages.length} exchanges.`;
}

function nameRule(npcName, playerName, nameRevealed) {
  return nameRevealed
    ? `${npcName} knows the player character as "${playerName}".`
    : `${npcName} does NOT know the player character's real name and only knows them as "${playerName}". Refer to them only as "${playerName}" (or "they"). Never write, guess or invent any other name for them.`;
}

async function summarizeWithModel(npcName, playerName, transcript, modelInstance, nameRevealed) {
  const model = modelInstance || createHarnessChatModel();
  const response = await invokeWithResponseLog(model, [
    new SystemMessage({ content: 'You are an RPG memory subagent. Output only valid JSON.' }),
    new HumanMessage({ content: `Summarize this finished conversation between the NPC "${npcName}" and the player character "${playerName}" from ${npcName}'s perspective.
Keep only what ${npcName} would remember: topics, promises, requests, deals, revealed facts and their impression of ${playerName}.
${nameRule(npcName, playerName, nameRevealed)}

Transcript:
${transcript}

Return a single-line minified JSON object:
{"summary":"One to three sentences from ${npcName}'s perspective"}` })
  ], { agent: 'Subagent: Dialogue Session Summary', logName: playerName, extra: { NPC: npcName } });
  const parsed = extractJsonObject(String(response.content || response.additional_kwargs?.reasoning_content || '').trim());
  return String(parsed?.summary || '').trim();
}

export async function summarizeClosedDialogueSession(sessionId, { db = prisma, modelInstance = null } = {}) {
  const numericSessionId = Number(sessionId);
  if (!numericSessionId || summarizedSessionIds.has(numericSessionId)) return null;
  summarizedSessionIds.add(numericSessionId);
  let session;
  try {
    session = await db.dialogue_sessions.findUnique({
      where: { id: numericSessionId },
      include: {
        player: { select: { id: true, name: true } },
        target_npc: { select: { id: true, name: true } },
        messages: { orderBy: { created_at: 'desc' }, take: DIALOGUE_SUMMARY_MESSAGE_LIMIT }
      }
    });
  } catch (error) {
    summarizedSessionIds.delete(numericSessionId);
    throw databaseError('summarizeClosedDialogueSession', 'read closed dialogue session', error);
  }
  if (!session || session.status !== DIALOGUE_SESSION_STATUS.CLOSED) {
    summarizedSessionIds.delete(numericSessionId);
    return null;
  }
  if (session.session_type !== DIALOGUE_SESSION_TYPE.DIRECT || !session.target_npc || !session.player || !session.messages.length) return null;
  const messages = [...session.messages].reverse();
  const npcName = session.target_npc.name || 'NPC';
  const realName = session.player.name || 'Adventurer';
  let identity = null;
  try {
    identity = await getNpcIdentity(db, session.player.id, session.target_npc.id);
  } catch (error) {
    console.warn(`[summarizeClosedDialogueSession] Identity lookup failed for session ${numericSessionId}, treating the player as a stranger:`, error.message);
  }
  const nameRevealed = Boolean(identity?.is_player_name_revealed);
  const knownName = nameNpcUses(identity, realName) || 'a stranger';
  let summary = '';
  try {
    summary = await summarizeWithModel(npcName, knownName, buildTranscript(messages, realName, knownName, nameRevealed), modelInstance, nameRevealed);
  } catch (error) {
    console.warn(`[summarizeClosedDialogueSession] Summary model failed for session ${numericSessionId}, using fallback:`, error.message);
  }
  const content = summary || fallbackSummary(npcName, realName, knownName, messages);
  return createNpcMemory({
    db,
    npcCharacterId: session.target_npc.id,
    targetCharacterId: session.player.id,
    content: nameRevealed ? content : maskUnrevealedName(content, realName, knownName),
    memoryType: MEMORY_TYPE.EPISODIC
  });
}

export function scheduleDialogueSessionSummaries(sessionIds = []) {
  const ids = [...new Set(sessionIds.map(Number).filter(Boolean))];
  if (!ids.length) return;
  const timer = setTimeout(() => {
    for (const id of ids) {
      summarizeClosedDialogueSession(id).catch((error) => console.warn(`[scheduleDialogueSessionSummaries] Session ${id} summary failed:`, error.message));
    }
  }, DIALOGUE_SUMMARY_DELAY_MS);
  timer.unref?.();
}
