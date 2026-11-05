import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import prisma from '../../prismaClient.js';
import { databaseError } from '../../../database/databaseError.js';
import { RELATIONSHIP_STATUS, evaluateRelationshipTransition, npcRelationshipManager } from './relationships.js';
import { extractJsonObject } from '../../../components/helpers/jsonParser.js';
import { invokeWithResponseLog } from '../../../logs/responseLogger.js';
import { getNpcIdentity, maskUnrevealedName, nameNpcUses } from '../../npcIdentityService.js';
import { MEMORY_ACTION_SNIPPET_MAX_LENGTH, MEMORY_PROMPT_NARRATION_MAX_LENGTH } from '../../../configs/constants.js';

export async function memoryWorldStateSubagent({
  npcName,
  character,
  actionText = '',
  narration = '',
  currentStatus = RELATIONSHIP_STATUS.STRANGER,
  currentAffinity,
  nameRevealed = false,
  modelInstance = null
}) {
  const activeStatus = evaluateRelationshipTransition(currentStatus, currentAffinity);
  const playerName = character?.name || 'a stranger';
  const nameRule = nameRevealed
    ? `${npcName} knows the player character as "${playerName}".`
    : `${npcName} does NOT know the player character's real name and only knows them as "${playerName}". Refer to them only as "${playerName}" (or "they"). Never write, guess or invent any other name for them, even if a name appears in the text above.`;

  const prompt = `### Memory & World State Subagent:
Analyze this RPG interaction between the player character ("${character?.name || 'Adventurer'}") and the NPC ("${npcName}").

Player Action: "${actionText}"
Outcome Narration: "${narration.slice(0, MEMORY_PROMPT_NARRATION_MAX_LENGTH)}"
Current Affinity: ${currentAffinity ?? 'unknown'}
Automatically Evaluated Relationship Status: ${activeStatus} (the status must match the affinity range; do not invent an affinity change)

Name rule: ${nameRule}

Tasks:
1. Distill what occurred into ONE concise memory sentence from the NPC's perspective (include their impression of the player).
2. Note any quest or world knowledge clue revealed (or empty string).

Return a single-line minified JSON object:
{"distilledMemory":"One sentence memory from NPC perspective","statusReason":"Brief summary of conduct","questOrWorldClue":""}`;

  if (modelInstance && typeof modelInstance.invoke === 'function') {
    try {
      const response = await invokeWithResponseLog(modelInstance, [
        new SystemMessage({ content: 'You are an analytical RPG memory subagent. Output only valid JSON.' }),
        new HumanMessage({ content: prompt })
      ], { agent: 'Subagent: Memory & World State', logName: character?.name, extra: { NPC: npcName } });

      const raw = String(response.content || response.additional_kwargs?.reasoning_content || '').trim();
      const parsed = extractJsonObject(raw);

      if (!parsed) {
        throw new Error(`Failed to extract valid JSON from LLM output (finish_reason: ${response.response_metadata?.finish_reason || 'unknown'})`);
      }

      const statusReason = parsed.statusReason || parsed.affinityReason || 'Standard interaction';

      return {
        distilledMemory: parsed.distilledMemory || `Spoke with ${character?.name || 'Adventurer'} in the local area.`,
        suggestedStatus: activeStatus,
        statusReason,
        affinityReason: statusReason,
        questOrWorldClue: parsed.questOrWorldClue || ''
      };
    } catch (err) {
      console.warn(`memoryWorldStateSubagent LLM call failed for ${npcName}, using rule evaluation:`, err.message);
    }
  }

  // Deterministic rule-based evaluation fallback
  return evaluateDeterministicWorldState(character, npcName, actionText, narration, activeStatus, currentAffinity);
}

function evaluateDeterministicWorldState(character, npcName, actionText, narration, currentStatus = RELATIONSHIP_STATUS.STRANGER, currentAffinity) {
  const text = `${actionText} ${narration}`.toLowerCase();
  const charName = character?.name || 'Adventurer';

  // Keep status as-is without automatic fluctuations; status transitions will be implemented later
  const suggestedStatus = evaluateRelationshipTransition(currentStatus, currentAffinity);
  const reason = `Affinity ${currentAffinity ?? 0} evaluates to ${suggestedStatus}`;
  let clue = '';

  if (/quest|bounty|honeywood|darkness|ruins|boss|monster/i.test(text)) {
    clue = `Exchanged rumors regarding regional perils with ${charName}.`;
  }

  const actionSnippet = actionText.slice(0, MEMORY_ACTION_SNIPPET_MAX_LENGTH).replace(/[.\n]/g, '');
  const distilledMemory = `${npcName} recalls ${charName} approaching to declare: "${actionSnippet}".`;

  return {
    distilledMemory,
    suggestedStatus,
    statusReason: reason,
    affinityReason: reason,
    questOrWorldClue: clue
  };
}

// ============================================================================
// 4. ASYNCHRONOUS BACKGROUND WORKER
// ============================================================================

/**
 * Runs completely asynchronously (non-blocking) after the turn response is delivered.
 * Evaluates the turn, updates two-tier relationship (in-memory + DB), and persists memorable facts.
 */
export async function runRelationshipAndMemoryWorker({
  userId,
  character,
  targetNpc,
  actionText = '',
  narration = '',
  modelInstance = null,
  db = prisma
}) {
  if (!targetNpc || !character) return null;

  const targetChar = targetNpc.character || targetNpc;
  const npcName = targetChar.name || targetNpc.name || 'NPC';
  const playerCharId = character.character_id || character.id;
  const npcCharId = targetNpc.character_id || targetChar.id;

  if (db && playerCharId && npcCharId) {
    await npcRelationshipManager.hydrateFromDb({ db, playerCharId, npcCharId, userId, characterId: playerCharId, npcName });
  }

  const currentRel = npcRelationshipManager.getNpcRelationship(userId, playerCharId, npcName);

  let characterAsKnown = character;
  let nameRevealed = false;
  try {
    const identity = await getNpcIdentity(db, playerCharId, npcCharId);
    nameRevealed = Boolean(identity?.is_player_name_revealed);
    characterAsKnown = { ...character, name: nameNpcUses(identity, character.name) || 'a stranger' };
  } catch (identityError) {
    console.warn('runRelationshipAndMemoryWorker identity lookup failed:', identityError.message);
    characterAsKnown = { ...character, name: 'a stranger' };
  }

  try {
    const evaluation = await memoryWorldStateSubagent({
      npcName,
      character: characterAsKnown,
      actionText,
      narration,
      currentStatus: currentRel.status,
      currentAffinity: currentRel.affinity,
      nameRevealed,
      modelInstance
    });
    if (!nameRevealed && evaluation.distilledMemory) {
      evaluation.distilledMemory = maskUnrevealedName(evaluation.distilledMemory, character.name, characterAsKnown.name);
    }
    const evaluatedStatus = evaluateRelationshipTransition(currentRel.status, currentRel.affinity);
    const updatedRelationship = npcRelationshipManager.recordRelationshipChange(
      userId,
      playerCharId,
      npcName,
      evaluatedStatus,
      evaluation.statusReason,
      { db, playerCharId, npcCharId }
    );
    return {
      npcName,
      evaluation,
      updatedRelationship,
      updatedAffinity: updatedRelationship
    };
  } catch (workerErr) {
    console.warn('runRelationshipAndMemoryWorker encountered an issue:', workerErr.message);
    return null;
  }
}
export const runAffinityAndMemoryWorker = runRelationshipAndMemoryWorker;
