import express from 'express';
import { getNearbyNpcs, getAllKnownNpcs, getMetNpcs } from '../containers/npcContainer.js';
import { databaseFailureMessage, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json({ npcs: await getAllKnownNpcs() });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load NPCs.') });
  }
});

router.get('/nearby', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json({ npcs: await getNearbyNpcs(session.user_id) });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load nearby NPCs.') });
  }
});

router.get('/met', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json({ npcs: await getMetNpcs(session.user_id) });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load the NPCs you have met.') });
  }
});

export default router;
