import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { HARNESS_TOOLS_MAP, MASTER_TOOLS } from './tools/index.js';
import { MAX_HARNESS_ITERATIONS } from './shared.js';
import { createHarnessChatModel, generateHarnessFallbackNarration } from './model.js';
import { executeHookStage } from '../lifecycle/index.js';
import { HARNESS_STEP_STATUS } from '../../../configs/constants.js';
import { logAiResponse } from '../../../logs/responseLogger.js';
import { runSplitStory } from './splitPipeline.js';
import { AGENT_PIPELINE } from '../../../configs/constants.js';

function speakerMatchesTarget(speaker, targetName) {
  const words = (value) => String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const speakerWords = words(speaker);
  const targetWords = words(targetName);
  if (!speakerWords.length || !targetWords.length) return false;
  const contains = (haystack, needle) => haystack.some((_, start) => needle.every((word, offset) => haystack[start + offset] === word));
  return contains(targetWords, speakerWords) || contains(speakerWords, targetWords);
}

export function stripNonTargetSpeakers(narration, targetName) {
  if (!targetName || !narration) return narration;
  const cleaned = narration
    .replace(/^\[(?:Speaker:\s*)?([^\]]+)\]:\s*["“']?.*?(?:["”']|$)/gim, (line, speaker) => (speakerMatchesTarget(speaker, targetName) ? line : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || `${targetName} regards you quietly, waiting for you to go on.`;
}

export async function agentNode(state, config) {
  const nodeStart = Date.now();
  const model = config?.configurable?.modelInstance || createHarnessChatModel();
  // Always bind the same tool list (see MASTER_TOOLS). Mode and target limits are enforced in toolsNode.
  const modelWithTools = (!state.isMetaJailbreak && model.bindTools) ? model.bindTools(MASTER_TOOLS) : model;
  const nextIteration = state.iterationCount + 1;

  try {
    const response = await modelWithTools.invoke(state.messages);
    const durationMs = Date.now() - nodeStart;
    await logAiResponse({
      agent: 'AI DM (agentNode)',
      logName: state.character?.name,
      model: model.modelName || model.model,
      durationMs,
      inputMessages: state.messages,
      response,
      extra: { Iteration: nextIteration, 'Action mode': state.actionMode || 'n/a', 'Player action': state.actionText || '' }
    });
    const toolCalls = Array.isArray(response.tool_calls) ? response.tool_calls : [];

    let decision = '';
    if (state.isMetaJailbreak) {
      decision = 'Meta-query/jailbreak detected. Tool execution disabled. Routing to finalizeStoryNode.';
    } else if (toolCalls.length > 0) {
      if (nextIteration < MAX_HARNESS_ITERATIONS) {
        decision = `Requested ${toolCalls.length} tool call(s). Continuing iteration loop (iterationCount: ${nextIteration} < ${MAX_HARNESS_ITERATIONS}).`;
      } else {
        decision = `Requested ${toolCalls.length} tool call(s), but recursion limit reached (${nextIteration} >= ${MAX_HARNESS_ITERATIONS}). Forcibly terminating iteration loop.`;
      }
    } else {
      decision = 'No tool calls requested. Concluding iteration loop and routing to finalizeStoryNode.';
    }

    return {
      messages: [response],
      iterationCount: nextIteration,
      modelName: model.modelName || model.model || 'deepseek',
      trace: {
        steps: [
          {
            iteration: nextIteration,
            node: 'agentNode',
            status: HARNESS_STEP_STATUS.SUCCESS,
            durationMs,
            decision,
            toolCalls: toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args }))
          }
        ]
      }
    };
  } catch (apiError) {
    const durationMs = Date.now() - nodeStart;
    await logAiResponse({
      agent: 'AI DM (agentNode)',
      logName: state.character?.name,
      model: model.modelName || model.model,
      durationMs,
      inputMessages: state.messages,
      error: apiError,
      extra: { Iteration: nextIteration, 'Action mode': state.actionMode || 'n/a', 'Player action': state.actionText || '' }
    });
    console.warn('Agent reasoning node encountered API error, generating graceful fallback:', apiError.message);
    const fallbackText = generateHarnessFallbackNarration(state.character, state.actionText, apiError.message);

    return {
      messages: [new AIMessage({ content: fallbackText })],
      iterationCount: nextIteration,
      isFallback: true,
      trace: {
        failedStep: 'agentNode',
        failedMessage: apiError.message,
        iterationFailed: nextIteration,
        steps: [
          {
            iteration: nextIteration,
            node: 'agentNode',
            status: HARNESS_STEP_STATUS.FAILED,
            durationMs,
            error: apiError.message,
            decision: 'Model invocation failed. Falling back to contextual fallback narration.'
          }
        ]
      }
    };
  }
}

/**
 * Conditional Edge: Iteration Loop Arbiter
 * Decides whether to continue looping into toolsNode or finish at finalizeStoryNode.
 */
export function shouldContinue(state) {
  // If flagged as a meta-query / jailbreak / creator claim, immediately terminate loop and do not call tools
  if (state.isMetaJailbreak) {
    return 'finalizeStory';
  }

  const lastMessage = state.messages[state.messages.length - 1];

  // If the agent invoked tool calls and we haven't reached safety recursion limit:
  if (
    lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0 &&
    state.iterationCount < MAX_HARNESS_ITERATIONS
  ) {
    return 'tools';
  }

  // Otherwise, terminate loop and finalize narration
  return 'finalizeStory';
}

/**
 * Node 2: Tools Execution Node
 * Intercepts tool calls, queries authoritative Prisma DB, creates ToolMessages,
 * and records individual tool execution duration & outputs in the trace.
 */
export async function toolsNode(state, config) {
  const nodeStart = Date.now();
  const lastMessage = state.messages[state.messages.length - 1];
  const toolCalls = lastMessage?.tool_calls || [];
  const toolMessages = [];
  const toolExecutions = [];
  const turnContext = config?.configurable?.turnContext || state.turnContext || null;

  for (const call of toolCalls) {
    const toolInstance = HARNESS_TOOLS_MAP.get(call.name);
    const toolStart = Date.now();
    let outputString = '';
    let toolError = null;

    // Lifecycle Hook: onToolExecution (pre-execution validation)
    const permissionArgs = { call, toolInstance, isPermitted: true };
    const isTargetNone = state.isTargetNone || config?.configurable?.isTargetNone || (!state.targetNpc && !config?.configurable?.targetNpc);
    if (call.name === AGENT_PIPELINE.ROLEPLAY_TOOL || call.name === AGENT_PIPELINE.ROLEPLAY_PARTY_TOOL) {
      permissionArgs.isPermitted = false;
      permissionArgs.permissionError = isTargetNone
        ? 'No conversational target selected. Speaking with NPCs is disabled when target is NONE.'
        : 'Roleplay runs automatically after the narration. Do not call roleplay tools.';
    }
    if (turnContext) {
      await executeHookStage('onToolExecution', turnContext, permissionArgs);
    }

    if (permissionArgs.isPermitted === false) {
      toolError = permissionArgs.permissionError || `Tool execution blocked: ${call.name}`;
      outputString = JSON.stringify({ error: toolError });
    } else if (toolInstance) {
      try {
        const rawOutput = await toolInstance.invoke(call.args, config);
        outputString = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
      } catch (toolErr) {
        toolError = toolErr.message;
        outputString = JSON.stringify({ error: `Tool execution failed: ${toolErr.message}` });
      }
    } else {
      toolError = `Unknown tool: ${call.name}`;
      outputString = JSON.stringify({ error: toolError });
    }

    const durationMs = Date.now() - toolStart;
    const toolExec = {
      toolName: call.name,
      args: call.args,
      status: toolError ? HARNESS_STEP_STATUS.FAILED : HARNESS_STEP_STATUS.SUCCESS,
      durationMs,
      output: outputString,
      error: toolError
    };
    toolExecutions.push(toolExec);

    // Lifecycle Hook: onToolExecution (post-execution logging)
    if (turnContext) {
      await executeHookStage('onToolExecution', turnContext, { call, toolExecution: toolExec, durationMs, outputString });
    }

    toolMessages.push(
      new ToolMessage({
        tool_call_id: call.id,
        name: call.name,
        content: outputString
      })
    );
  }

  const durationMs = Date.now() - nodeStart;
  const hasFailure = toolExecutions.some((t) => t.status === HARNESS_STEP_STATUS.FAILED);

  return {
    messages: toolMessages,
    trace: {
      steps: [
        {
          iteration: state.iterationCount,
          node: 'toolsNode',
          status: hasFailure ? HARNESS_STEP_STATUS.PARTIAL_ERROR : HARNESS_STEP_STATUS.SUCCESS,
          durationMs,
          decision: `Executed ${toolExecutions.length} tool(s). Continuing loop back to agentNode.`,
          toolExecutions
        }
      ]
    }
  };
}

/**
 * Node 3: Finalize Story Node
 * Extracts clean narrative text from the final AI message and logs turn completion.
 */
export async function finalizeStoryNode(state, config) {
  const nodeStart = Date.now();
  const lastMessage = state.messages[state.messages.length - 1];
  let narration = '';
  let pipelineSteps = [];
  const useSplit = !state.isFallback;

  if (useSplit) {
    const result = await runSplitStory(state, config);
    narration = result.narration;
    pipelineSteps = result.steps;
  } else if (typeof lastMessage?.content === 'string') {
    narration = lastMessage.content.trim();
  } else if (Array.isArray(lastMessage?.content)) {
    narration = lastMessage.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n\n')
      .trim();
  }

  if (!narration) {
    narration = generateHarnessFallbackNarration(state.character, state.actionText, 'Empty narration response');
  }

  if (state.isMetaJailbreak) {
    const containsCatalogLeak =
      /(i looked up (the|in the) (database|ledger)|regarding (the )?(rabbit|wolf|boar|slime)|(list|catalog) of (monsters|npcs))/i.test(narration);

    if (containsCatalogLeak) {
      const charName = state.character?.name || 'Wanderer';
      const locName = state.character?.location?.name || 'the realm of Stervian';
      narration = `A cold, faint laugh echoes from the misty gloom. Those nearby look upon you with quiet bewilderment, as though watching a lunatic spouting nonsensical gibberish about "creators of the world," "databases," and demanding a catalog of beasts from thin air.\n\nHere in ${locName}, you are merely mortal flesh and blood. The secrets of savage beasts, starving wolf packs, and shadow lords are written in blood and steel across perilous journeys, never laid out upon parchment for a daydreaming wanderer. Steady yourself, ${charName}.\n\nWhat do you do next?`;
    }
  }

  const isTargetNone = state.isTargetNone || (!state.targetNpc);
  if (isTargetNone) {
    narration = narration
      .replace(/^\[(?:Speaker:\s*)?[^\]]+\]:\s*["“']?.*?(?:["”']|$)/gim, '')
      .replace(/^([A-Za-z\s']+):\s*["“'].+?["”']$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!narration) {
      narration = 'Your words linger into the quiet air. None of the figures nearby turn to answer or interrupt their tasks.';
    }
  } else {
    narration = stripNonTargetSpeakers(narration, state.targetNpc?.character?.name || state.targetNpc?.name || '');
  }

  const durationMs = Date.now() - nodeStart;

  return {
    finalStory: narration,
    trace: {
      steps: [
        ...pipelineSteps,
        {
          iteration: state.iterationCount,
          node: 'finalizeStoryNode',
          status: HARNESS_STEP_STATUS.SUCCESS,
          durationMs,
          decision: `Story narration prepared (${narration.length} characters). Turn completed.`
        }
      ]
    }
  };
}

// ============================================================================
