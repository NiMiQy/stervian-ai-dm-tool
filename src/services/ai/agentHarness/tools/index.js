import {
  GENERIC_MONSTER_TERMS,
  searchWorldNpcTool,
  getNpcMemoriesTool,
  inspectCurrentLocationTool
} from './worldTools.js';
import { checkPartyStatusTool } from './partyTools.js';
import { roleplayNpcTool, roleplayNpcPartyTool } from './roleplayTools.js';
import { introduceNameToNpcTool } from './relationshipTools.js';
import { updateSceneTool } from './sceneTools.js';

export {
  GENERIC_MONSTER_TERMS,
  searchWorldNpcTool,
  getNpcMemoriesTool,
  inspectCurrentLocationTool,
  checkPartyStatusTool,
  roleplayNpcTool,
  roleplayNpcPartyTool,
  introduceNameToNpcTool,
  updateSceneTool
};

export const HARNESS_TOOLS = [
  searchWorldNpcTool,
  getNpcMemoriesTool,
  inspectCurrentLocationTool,
  checkPartyStatusTool,
  roleplayNpcTool,
  roleplayNpcPartyTool,
  introduceNameToNpcTool,
  updateSceneTool
];

export const HARNESS_TOOLS_MAP = new Map(HARNESS_TOOLS.map((harnessTool) => [harnessTool.name, harnessTool]));

// Tools bound to the Master on every turn, always in this order.
// The list never changes between turns so the request prefix stays cacheable.
// Roleplay tools are excluded: the pipeline runs roleplay after the narration.
export const MASTER_TOOLS = Object.freeze(
  HARNESS_TOOLS.filter((harnessTool) => harnessTool !== roleplayNpcTool && harnessTool !== roleplayNpcPartyTool)
);
