import fs from 'node:fs';
import path from 'node:path';
import { CROWD_OVERFLOW_THRESHOLD, HARNESS_LOG_DIRECTORY, HARNESS_STEP_STATUS } from '../configs/constants.js';

/**
 * ============================================================================
 * STERVIAN AI DUNGEON - HARNESS TRACE LOGGER
 * ============================================================================
 * Persists comprehensive execution traces to the /logs/harness/ directory:
 * - Workflow progression & step transitions
 * - Tool calls with input arguments and outputs
 * - Failing messages, failing steps, and iteration failures
 * - Iteration count increments and loop continuation decisions
 * - Final story narration and fallback flags
 */

const LOGS_ROOT_DIR = path.resolve(process.cwd(), ...HARNESS_LOG_DIRECTORY);

/**
 * Formats a timestamp for safe filenames (e.g. 2026-09-21T08-45-12-345Z)
 */
export function getSafeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Formats a detailed, human-readable trace log.
 */
export function formatHumanReadableLog(data) {
  const lines = [];
  const charName = data.character?.name || 'Unknown';
  const charId = data.characterId || data.character?.id || 'N/A';
  const timestamp = data.timestamp || new Date().toISOString();
  const status = data.failedStep ? HARNESS_STEP_STATUS.FAILED : HARNESS_STEP_STATUS.SUCCESS;

  lines.push('================================================================================');
  lines.push('STERVIAN AGENT HARNESS EXECUTION TRACE');
  lines.push(`Timestamp:       ${timestamp}`);
  lines.push(`Character:       ${charName} (ID: ${charId}) | User: ${data.userId || 'N/A'}`);
  lines.push(`Action Text:     "${data.actionText || ''}"`);
  lines.push(`Model:           ${data.model || 'deepseek-flash'}`);
  lines.push(`Status:          ${status}`);
  lines.push(`Total Iterations:${data.iterationCount ?? 0} / Max: ${data.maxIterations ?? 4}`);
  lines.push(`Fallback Active: ${data.isFallback ? 'YES' : 'NO'}`);
  if (data.isMetaJailbreak || data.context?.isMetaJailbreak) {
    lines.push('Immersion Guard: ACTIVE (Meta-query / Creator claim / Jailbreak intercepted)');
  }

  if (data.context) {
    lines.push('--------------------------------------------------------------------------------');
    lines.push('CONTEXT MANAGEMENT:');
    lines.push(`  Active Window:           ${data.context.windowedTurns ?? 0} turns (Pruned: ${data.context.prunedTurns ?? 0} turns)`);
    const totalNearby = data.context.totalNpcCount ?? data.context.scopedNpcCount ?? 0;
    lines.push(`  Scoped Local NPCs:       ${data.context.scopedNpcCount ?? 0} (Total nearby: ${totalNearby})`);
    if (data.context.hasCrowdOverflow) {
      lines.push(`  Crowd Exploration Alert: Active (> ${CROWD_OVERFLOW_THRESHOLD} NPCs present; discovery reminder provided)`);
    }
    if (data.context.isMetaJailbreak) {
      lines.push('  Meta Injection Defense:  BLOCKED (Tool calling disabled; immersion preserved)');
    }
    lines.push(`  Targeted NPC:            ${data.context.targetNpcName || 'None'}`);
    lines.push(`  Active Memories:         ${data.context.targetMemoriesCount ?? 0} injected`);
  }

  if (data.failedStep) {
    lines.push('--------------------------------------------------------------------------------');
    lines.push('FAILURE SUMMARY:');
    lines.push(`  Failing Step:            ${data.failedStep}`);
    lines.push(`  Iteration Number Failed: ${data.iterationFailed ?? 'N/A'}`);
    lines.push(`  Failing Message:         ${data.failedMessage || 'No error message provided'}`);
  }

  lines.push('================================================================================');
  lines.push('WORKFLOW PROGRESSION & STEPS:');

  const steps = Array.isArray(data.steps) ? data.steps : [];
  if (steps.length === 0) {
    lines.push('  (No intermediate steps recorded)');
  } else {
    steps.forEach((step, idx) => {
      lines.push(`\n[STEP ${idx + 1}] Node: ${step.node} (Iteration ${step.iteration ?? 'N/A'})`);
      lines.push(`  Status:    ${step.status}`);
      lines.push(`  Duration:  ${step.durationMs ?? 0} ms`);

      if (step.decision) {
        lines.push(`  Decision:  ${step.decision}`);
      }

      if (step.error) {
        lines.push(`  Error:     ${step.error}`);
      }

      if (step.output) {
        lines.push('  Output:');
        String(step.output).split('\n').forEach((outputLine) => lines.push(`    ${outputLine}`));
      }

      if (Array.isArray(step.toolCalls) && step.toolCalls.length > 0) {
        lines.push(`  Tool Calls Requested (${step.toolCalls.length}):`);
        step.toolCalls.forEach((tc, tIdx) => {
          lines.push(`    ${tIdx + 1}. Tool: ${tc.name} [ID: ${tc.id}]`);
          lines.push(`       Args: ${JSON.stringify(tc.args)}`);
        });
      }

      if (Array.isArray(step.toolExecutions) && step.toolExecutions.length > 0) {
        lines.push(`  Tool Execution Results (${step.toolExecutions.length}):`);
        step.toolExecutions.forEach((te, teIdx) => {
          lines.push(`    ${teIdx + 1}. Tool: ${te.toolName}`);
          lines.push(`       Status:   ${te.status} (${te.durationMs ?? 0} ms)`);
          lines.push(`       Output:   ${te.output}`);
          if (te.error) {
            lines.push(`       Error:    ${te.error}`);
          }
        });
      }
    });
  }

  lines.push('\n================================================================================');
  lines.push('FINAL NARRATION (RESPONSE TO USER):');
  lines.push(data.finalStory || '(Empty narration)');
  lines.push('================================================================================\n');

  return lines.join('\n');
}

/**
 * Writes the execution trace to the /logs/harness/ directory.
 * Safely creates the directory if missing and never throws to prevent breaking player turns.
 */
export function writeHarnessLog(traceData) {
  try {
    fs.mkdirSync(LOGS_ROOT_DIR, { recursive: true });

    const date = new Date();
    const safeTime = getSafeTimestamp(date);
    const charNameClean = (traceData.character?.name || 'hero').replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseFilename = `harness_turn_${safeTime}_${charNameClean}`;

    const logFilePath = path.join(LOGS_ROOT_DIR, `${baseFilename}.log`);
    const jsonFilePath = path.join(LOGS_ROOT_DIR, `${baseFilename}.json`);

    const fullTrace = {
      timestamp: date.toISOString(),
      ...traceData
    };

    // 1. Write Human-Readable .log
    const humanLog = formatHumanReadableLog(fullTrace);
    fs.writeFileSync(logFilePath, humanLog, 'utf8');

    // 2. Write Structured .json for automated inspection
    fs.writeFileSync(jsonFilePath, JSON.stringify(fullTrace, null, 2), 'utf8');

    return {
      success: true,
      logFilePath,
      jsonFilePath
    };
  } catch (err) {
    console.warn('Failed to write harness log file:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

export default {
  LOGS_ROOT_DIR,
  getSafeTimestamp,
  formatHumanReadableLog,
  writeHarnessLog
};
