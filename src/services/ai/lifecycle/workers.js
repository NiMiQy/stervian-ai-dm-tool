import prisma from '../../prismaClient.js';
import { writeHarnessLog } from '../../../logs/harnessLogger.js';
import { runRelationshipAndMemoryWorker } from '../subagents/index.js';

export async function distillNpcMemoriesWorker(context) {
  const storyText = context.finalStory || context.story || '';
  const targetNpc = context.targetNpc;

  if (targetNpc && storyText) {
    const activeDb = context.customPrisma || context.db || prisma;
    const speakers = context.partyTurn
      ? context.partyTurn.speakers.filter((speaker) => speaker.text).map((speaker) => ({
        userId: speaker.userId,
        character: { ...context.character, id: speaker.characterId, character_id: speaker.characterId, name: speaker.realName, user_id: speaker.userId },
        actionText: speaker.text
      }))
      : [{ userId: context.userId, character: context.character, actionText: context.cleanAction || context.actionText || '' }];
    context.backgroundPromises = speakers.map((speaker) => runRelationshipAndMemoryWorker({
      userId: speaker.userId,
      character: speaker.character,
      targetNpc,
      actionText: speaker.actionText,
      narration: storyText,
      modelInstance: context.activeModel || context.modelInstance,
      db: activeDb
    }).catch((error) => {
      console.warn('[LifecycleHook:distillNpcMemoriesWorker] Memory worker warning:', error.message);
    }));
    if (context.awaitBackground) await Promise.allSettled(context.backgroundPromises);
  }

  return context;
}
/**
 * Hook 4.2: flushTraceLogger
 * Non-blocking logger flush persisting full execution metrics to logs/harness/*.log and *.json.
 */
export async function flushTraceLogger(context) {
  try {
    const totalDurationMs = Date.now() - (context.overallStart || Date.now());

    const logResult = writeHarnessLog({
      userId: context.userId,
      characterId: Number(context.characterId || context.character?.id),
      actionText: context.cleanAction || context.actionText || '',
      character: context.character,
      model: context.modelName || 'deepseek-flash',
      iterationCount: context.iterationCount || 1,
      maxIterations: context.maxIterations || 4,
      totalDurationMs,
      isFallback: context.isFallback || false,
      isMetaJailbreak: Boolean(context.isMetaJailbreak),
      context: context.contextMetrics || {},
      failedStep: context.trace?.failedStep || null,
      failedMessage: context.trace?.failedMessage || null,
      iterationFailed: context.trace?.iterationFailed || null,
      steps: context.trace?.steps || [],
      finalStory: context.finalStory || context.story || ''
    });

    if (logResult?.logFilePath) {
      context.logFile = logResult.logFilePath;
    }
  } catch (logErr) {
    console.warn('[LifecycleHook:flushTraceLogger] Failed to write harness log:', logErr.message);
  }

  return context;
}

// ============================================================================
