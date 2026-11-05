import { MAX_HARNESS_ITERATIONS, getPrismaClient } from './shared.js';
import {
  GENERIC_MONSTER_TERMS,
  HARNESS_TOOLS,
  HARNESS_TOOLS_MAP,
  searchWorldNpcTool,
  getNpcMemoriesTool,
  inspectCurrentLocationTool,
  checkPartyStatusTool,
  roleplayNpcTool,
  introduceNameToNpcTool
} from './tools/index.js';
import { HarnessStateAnnotation } from './state.js';
import { createHarnessChatModel, generateHarnessFallbackNarration } from './model.js';
import { agentNode, shouldContinue, toolsNode, finalizeStoryNode } from './nodes.js';
import { buildHarnessWorkflow, harnessCompiledApp, executeHarnessAction, shouldAfterTools } from './workflow.js';
import {
  turnLifecycle,
  executeHookStage,
  isMetaOrJailbreakAttempt,
  prepareHarnessMessages
} from '../lifecycle/index.js';

export {
  MAX_HARNESS_ITERATIONS,
  getPrismaClient,
  GENERIC_MONSTER_TERMS,
  HARNESS_TOOLS,
  HARNESS_TOOLS_MAP,
  searchWorldNpcTool,
  getNpcMemoriesTool,
  inspectCurrentLocationTool,
  checkPartyStatusTool,
  roleplayNpcTool,
  introduceNameToNpcTool,
  HarnessStateAnnotation,
  createHarnessChatModel,
  generateHarnessFallbackNarration,
  agentNode,
  shouldContinue,
  toolsNode,
  finalizeStoryNode,
  buildHarnessWorkflow,
  harnessCompiledApp,
  executeHarnessAction,
  shouldAfterTools,
  turnLifecycle,
  executeHookStage,
  isMetaOrJailbreakAttempt,
  prepareHarnessMessages
};

export default {
  MAX_HARNESS_ITERATIONS,
  GENERIC_MONSTER_TERMS,
  isMetaOrJailbreakAttempt,
  HARNESS_TOOLS,
  HARNESS_TOOLS_MAP,
  searchWorldNpcTool,
  getNpcMemoriesTool,
  inspectCurrentLocationTool,
  checkPartyStatusTool,
  introduceNameToNpcTool,
  HarnessStateAnnotation,
  createHarnessChatModel,
  generateHarnessFallbackNarration,
  agentNode,
  shouldContinue,
  toolsNode,
  finalizeStoryNode,
  buildHarnessWorkflow,
  harnessCompiledApp,
  prepareHarnessMessages,
  executeHarnessAction,
  turnLifecycle,
  executeHookStage
};
