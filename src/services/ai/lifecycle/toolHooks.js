export async function validateToolPermissions(context, extraArgs = {}) {
  const { call, toolInstance } = extraArgs;
  if (!call) return context;

  // If flagged as jailbreak / meta-query, block tool invocation
  if (context?.isMetaJailbreak) {
    extraArgs.isPermitted = false;
    extraArgs.permissionError = `Tool execution blocked by Immersion Defense: ${call.name}`;
    return context;
  }

  if (!toolInstance) {
    extraArgs.isPermitted = false;
    extraArgs.permissionError = `Unknown tool: ${call.name}`;
    return context;
  }

  // Never re-allow a call that an earlier check already blocked.
  if (extraArgs.isPermitted !== false) extraArgs.isPermitted = true;
  return context;
}

/**
 * Hook 2.2: logToolCall
 * Intercepts tool invocation metrics, recording tool arguments, duration, and output into trace steps.
 */
export async function logToolCall(context, extraArgs = {}) {
  const { call, toolExecution, durationMs, outputString } = extraArgs;
  if (!context?.trace) return context;

  if (toolExecution) {
    if (!Array.isArray(context.toolExecutions)) {
      context.toolExecutions = [];
    }
    context.toolExecutions.push(toolExecution);
  }

  return context;
}

// ============================================================================
