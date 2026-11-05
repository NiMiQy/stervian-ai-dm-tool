import { StateGraph, START, END } from '@langchain/langgraph';
import prisma from '../../prismaClient.js';
import aiConfig from '../../../configs/aiConfig.js';
import { buildContextCheckReport } from '../../contextCheckService.js';
import { executeHookStage } from '../lifecycle/index.js';
import { MAX_HARNESS_ITERATIONS } from './shared.js';
import { HarnessStateAnnotation } from './state.js';
import { createHarnessChatModel, generateHarnessFallbackNarration } from './model.js';
import { agentNode, shouldContinue, toolsNode, finalizeStoryNode } from './nodes.js';
import { HARNESS_STEP_STATUS } from '../../../configs/constants.js';

export function shouldAfterTools(state) {
  if (state.encounter) return 'finalizeStory';
  return 'agent';
}

export function buildHarnessWorkflow() {
  return new StateGraph(HarnessStateAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addNode('finalizeStory', finalizeStoryNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      finalizeStory: 'finalizeStory'
    })
    .addConditionalEdges('tools', shouldAfterTools, {
      finalizeStory: 'finalizeStory',
      agent: 'agent'
    })
    .addEdge('finalizeStory', END);
}

export const harnessCompiledApp = buildHarnessWorkflow().compile();

// ============================================================================
// HIGH-LEVEL HARNESS RUNNER
// ============================================================================

/**
 * Main execution entrypoint for the Agent Harness.
 * Orchestrates turns via modular turnLifecycle hooks:
 *   - beforeTurn: Immersion defense, character hydration, sliding window, prompt prep
 *   - onToolExecution: Permissions verification & trace logging
 *   - afterStoryGenerated: Combat intercept & story DB persistence
 *   - onTurnEndBackground: Memory distillation worker & trace log flush
 */
export async function executeHarnessAction({
  userId,
  characterId,
  actionText,
  actionMode = 'story',
  history = [],
  modelInstance = null,
  customPrisma = null,
  customCharacter = null,
  includeContextCheck = false,
  targetNpcId = null,
  revealResult = null,
  partyTurn = null,
  fateCheck = null,
  skillCheck = null,
  playerTools = []
}) {
  const overallStart = Date.now();

  if (!actionText || typeof actionText !== 'string' || !actionText.trim()) {
    return { error: 'Action text cannot be empty.' };
  }
  const cleanAction = actionText.trim();
  const db = customPrisma || prisma;

  const turnContext = {
    userId,
    characterId,
    actionText,
    actionMode,
    targetNpcId,
    revealResult,
    partyTurn,
    partyTurnDisplay: partyTurn?.display || null,
    fateCheck,
    skillCheck,
    playerTools: Array.isArray(playerTools) ? playerTools : [],
    sceneChanges: [],
    cleanAction,
    history,
    modelInstance,
    customPrisma: db,
    customCharacter,
    db,
    overallStart,
    trace: {
      startTime: overallStart,
      steps: [],
      failedStep: null,
      failedMessage: null,
      iterationFailed: null
    },
    toolExecutions: []
  };

  // Stage 1: beforeTurn (Immersion Defense, Character Lookup, Sliding Window, Prompt Prep)
  await executeHookStage('beforeTurn', turnContext);
  if (turnContext.error) {
    return { error: turnContext.error };
  }

  const character = turnContext.character;
  const activeModel = modelInstance || createHarnessChatModel();
  turnContext.activeModel = activeModel;

  // Initialize LangGraph State
  const initialState = {
    userId,
    characterId: Number(character?.id || characterId),
    actionText: turnContext.cleanAction,
    actionMode,
    history: turnContext.activeWindow,
    character,
    party: turnContext.party,
    nearbyNpcs: turnContext.scopedNpcs,
    targetNpc: turnContext.targetNpc,
    isTargetNone: turnContext.isTargetNone,
    messages: turnContext.initialMessages,
    iterationCount: 0,
    encounter: null,
    isMetaJailbreak: turnContext.isMetaJailbreak,
    finalStory: '',
    isFallback: false,
    modelName: '',
    turnContext,
    trace: turnContext.trace
  };

  try {
    const finalState = await harnessCompiledApp.invoke(initialState, {
      configurable: {
        modelInstance: activeModel,
        prisma: db,
        character,
        characterId: Number(character?.id || characterId),
        userId,
        actionMode,
        party: turnContext.party,
        nearbyNpcs: turnContext.scopedNpcs,
        targetNpc: turnContext.targetNpc,
        isTargetNone: turnContext.isTargetNone,
        turnContext
      },
      recursionLimit: MAX_HARNESS_ITERATIONS * 2 + 2
    });

    turnContext.finalState = finalState;
    turnContext.finalStory = finalState.finalStory;
    turnContext.encounter = finalState.encounter || null;
    turnContext.modelName = finalState.modelName;
    turnContext.iterationCount = finalState.iterationCount;
    turnContext.maxIterations = MAX_HARNESS_ITERATIONS;
    turnContext.isFallback = finalState.isFallback || false;
    if (finalState.trace) {
      turnContext.trace = finalState.trace;
    }

    // Stage 3: afterStoryGenerated (Capture encounter, persist story turn to DB)
    await executeHookStage('afterStoryGenerated', turnContext);

    // Stage 4: onTurnEndBackground (Distill NPC memories & relationships, flush trace log)
    await executeHookStage('onTurnEndBackground', turnContext);

    return {
      success: true,
      action: turnContext.cleanAction,
      story: turnContext.finalStory,
      character,
      isMockFallback: finalState.isFallback || false,
      model: finalState.modelName || 'deepseek-flash',
      iterationCount: finalState.iterationCount,
      encounter: turnContext.encounter || null,
      logFile: turnContext.logFile || null,
      ...(includeContextCheck ? { contextCheck: buildContextCheckReport({
        segments: turnContext.promptSegments,
        beforeMessages: turnContext.initialMessages,
        afterMessages: finalState.isFallback ? null : finalState.messages,
        model: finalState.modelName || aiConfig.model,
        isFallback: finalState.isFallback || false
      }) } : {}),
      ...(turnContext.storyId ? { storyId: turnContext.storyId } : {}),
      ...(turnContext.dialogueSessionId ? { dialogueSessionId: turnContext.dialogueSessionId, dialogueMessageIds: turnContext.dialogueMessageIds || [] } : {}),
      ...(turnContext.dialogueClosed ? { dialogueClosed: turnContext.dialogueClosed } : {}),
      ...(turnContext.sceneChanges?.length ? { sceneChanges: turnContext.sceneChanges } : {})
    };
  } catch (harnessErr) {
    const totalDurationMs = Date.now() - overallStart;
    console.warn('LangGraph harness execution encountered an issue, generating fallback:', harnessErr.message);
    const fallbackStory = generateHarnessFallbackNarration(character, turnContext.cleanAction, harnessErr.message);

    turnContext.finalStory = fallbackStory;
    turnContext.isFallback = true;
    turnContext.modelName = 'deepseek-flash';
    turnContext.iterationCount = 1;
    turnContext.maxIterations = MAX_HARNESS_ITERATIONS;
    if (turnContext.trace) {
      turnContext.trace.failedStep = 'executeHarnessAction';
      turnContext.trace.failedMessage = harnessErr.message;
      turnContext.trace.iterationFailed = 1;
      turnContext.trace.steps = [
        {
          iteration: 1,
          node: 'executeHarnessAction',
          status: HARNESS_STEP_STATUS.FAILED,
          error: harnessErr.message,
          durationMs: totalDurationMs
        }
      ];
    }

    // Stage 3 & 4 on fallback
    await executeHookStage('afterStoryGenerated', turnContext);
    await executeHookStage('onTurnEndBackground', turnContext);

    return {
      success: true,
      action: turnContext.cleanAction,
      story: fallbackStory,
      character,
      isMockFallback: true,
      model: 'deepseek-flash',
      iterationCount: 1,
      encounter: null,
      logFile: turnContext.logFile || null,
      ...(includeContextCheck ? { contextCheck: buildContextCheckReport({
        segments: turnContext.promptSegments,
        beforeMessages: turnContext.initialMessages,
        model: aiConfig.model,
        isFallback: true
      }) } : {}),
      ...(turnContext.storyId ? { storyId: turnContext.storyId } : {})
    };
  }
}
