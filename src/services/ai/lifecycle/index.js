import {
  isMetaOrJailbreakAttempt,
  prepareHarnessMessages,
  immersionDefenseGuard,
  prepareContextWindow
} from './context.js';
import { logToolCall, validateToolPermissions } from './toolHooks.js';
import { interceptCombatEncounter, persistStoryTurnToDb } from './story.js';
import { distillNpcMemoriesWorker, flushTraceLogger } from './workers.js';

export {
  isMetaOrJailbreakAttempt,
  prepareHarnessMessages,
  immersionDefenseGuard,
  prepareContextWindow,
  logToolCall,
  validateToolPermissions,
  interceptCombatEncounter,
  persistStoryTurnToDb,
  distillNpcMemoriesWorker,
  flushTraceLogger
};
export const turnLifecycle = {
  beforeTurn: [
    immersionDefenseGuard,        // Chống jailbreak/hack
    prepareContextWindow          // Sliding window, nạp ký ức
  ],
  onToolExecution: [
    logToolCall,                  // Ghi trace log cho từng tool
    validateToolPermissions       // Kiểm tra tính hợp lệ của tool
  ],
  afterStoryGenerated: [
    interceptCombatEncounter,     // Bắt trigger combat
    persistStoryTurnToDb          // Lưu lượt chơi
  ],
  onTurnEndBackground: [
    distillNpcMemoriesWorker,     // Chắt lọc ký ức chạy ngầm
    flushTraceLogger              // Ghi file log
  ]
};

/**
 * Executes all registered hooks for a given lifecycle stage sequentially.
 * @param {string} stageName - 'beforeTurn' | 'onToolExecution' | 'afterStoryGenerated' | 'onTurnEndBackground'
 * @param {object} context - Shared turn context
 * @param {object} [extraArgs={}] - Optional supplemental parameters (e.g. tool call args)
 * @returns {Promise<object>} The updated context
 */
export async function executeHookStage(stageName, context, extraArgs = {}) {
  const hooks = turnLifecycle[stageName];
  if (!Array.isArray(hooks)) return context;

  for (const hook of hooks) {
    if (typeof hook === 'function') {
      try {
        await hook(context, extraArgs);
      } catch (err) {
        console.warn(`[LifecycleHook] Error in stage '${stageName}', hook '${hook.name || 'anonymous'}':`, err.message);
      }
    }
  }

  return context;
}
export default {
  turnLifecycle,
  executeHookStage,
  immersionDefenseGuard,
  prepareContextWindow,
  logToolCall,
  validateToolPermissions,
  interceptCombatEncounter,
  persistStoryTurnToDb,
  distillNpcMemoriesWorker,
  flushTraceLogger
};
