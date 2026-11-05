import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPrismaClient } from '../shared.js';
import { appendSceneNotes, listOngoingScenes } from '../../../../containers/sceneContainer.js';
import { ERROR_NAMES } from '../../../../configs/constants.js';

function sceneOwnerId(config) {
  return Number(config?.configurable?.characterId || config?.configurable?.character?.id);
}

function toolError(error) {
  if (error?.name === ERROR_NAMES.SCENE_RULE) return JSON.stringify({ success: false, reason: error.message });
  return JSON.stringify({ success: false, error: error?.message || 'Scene operation failed.' });
}

export const updateSceneTool = tool(
  async ({ scene_id, note }, config) => {
    try {
      const characterId = sceneOwnerId(config);
      const db = getPrismaClient(config);
      const turnContext = config?.configurable?.turnContext || {};
      if (!Array.isArray(turnContext.sceneChanges)) turnContext.sceneChanges = [];
      const scene = await appendSceneNotes({ characterId, sceneId: scene_id, note }, db);
      turnContext.sceneChanges.push({ type: 'noted', scene });
      return JSON.stringify({ success: true, scene: { id: scene.id, scene_stage: scene.scene_stage } });
    } catch (error) {
      return toolError(error);
    }
  },
  {
    name: 'update_scene',
    description: 'Add a short progress note to one of the player\'s on-going scenes listed in the Active Scenes section. Use it only for important progress, in one short sentence. You cannot solve, close or abandon scenes: only the player decides that.',
    schema: z.object({
      scene_id: z.number().int().positive().describe('The scene id from the Active Scenes section.'),
      note: z.string().min(1).max(500).describe('One short sentence describing the progress made this turn.')
    })
  }
);

export async function loadActiveScenesForPrompt(characterId, db) {
  try {
    return await listOngoingScenes(characterId, db);
  } catch (error) {
    console.warn('Unable to load active scenes for prompt:', error.message);
    return [];
  }
}
