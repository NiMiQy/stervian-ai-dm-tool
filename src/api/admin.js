import express from 'express';
import { createAdminRecord, deleteAdminRecord, getAdminDashboard, updateAdminRecord } from '../containers/adminContainer.js';
import { getWorldState, rerollWorldState } from '../containers/worldStateContainer.js';
import { summarizeScenesToNpcMemories } from '../containers/sceneContainer.js';
import { adminMutation, databaseFailureMessage, requireAdmin } from './middleware.js';
import { requireAiApiKey } from '../services/ai/aiRequestContext.js';
import { ADMIN_DASHBOARD_QUERY_KEYS, ERROR_NAMES, HTTP_STATUS, MEMORY_ADD_FROM } from '../configs/constants.js';

const router = express.Router();

router.use(async (request, response, next) => {
  if (await requireAdmin(request, response)) return next();
});

router.get('/', async (request, response) => {
  try {
    return response.json(await getAdminDashboard(Object.fromEntries(ADMIN_DASHBOARD_QUERY_KEYS.map((key) => [key, request.query[key]]))));
  } catch (error) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, 'Unable to complete the admin operation.') });
  }
});

router.get('/world-state', async (_request, response) => {
  try {
    return response.json(await getWorldState());
  } catch (error) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, 'Unable to load the world state.') });
  }
});

router.post('/world-state/reroll', async (request, response) => {
  try {
    return response.json({ message: 'World state rerolled.', result: await rerollWorldState(request.body || {}) });
  } catch (error) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, error.message || 'Unable to reroll the world state.') });
  }
});

router.post('/character_scenes/summarize', requireAiApiKey, async (request, response) => {
  try {
    const results = await summarizeScenesToNpcMemories({
      sceneIds: request.body?.scene_ids,
      memoryType: request.body?.memory_type,
      addFrom: MEMORY_ADD_FROM.ADMIN_SUMMARIZE_SCENES
    });
    const count = results.filter((result) => result.memory).length;
    return response.json({ message: `Saved ${count} NPC memor${count === 1 ? 'y' : 'ies'} from the selected scenes.`, results });
  } catch (error) {
    if (error?.name === ERROR_NAMES.SCENE_RULE) return response.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({ error: error.message });
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, 'Unable to summarize the scenes into memory.') });
  }
});

router.post('/:model', (request, response) => adminMutation(request, response, createAdminRecord, HTTP_STATUS.CREATED));
router.route('/:model/:id')
  .patch((request, response) => adminMutation(request, response, updateAdminRecord, HTTP_STATUS.OK))
  .put((request, response) => adminMutation(request, response, updateAdminRecord, HTTP_STATUS.OK))
  .delete((request, response) => adminMutation(request, response, deleteAdminRecord, HTTP_STATUS.OK));

export default router;
