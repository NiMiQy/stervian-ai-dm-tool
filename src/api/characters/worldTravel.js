import express from 'express';
import { getWorldTravelMap, travelToLocation } from '../../containers/worldTravelContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from '../middleware.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../../configs/constants.js';

const router = express.Router();

router.get('/:id/world-map', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only access your own character.' });
  try {
    const map = await getWorldTravelMap(session.user_id);
    return map ? response.json(map) : response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load the world map.') });
  }
});

router.post('/:id/travel', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only travel with your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await travelToLocation(session.user_id, request.body?.destinationId, request.body?.dialogueChoice);
    const { statusCode = result.error ? HTTP_STATUS.CONFLICT : HTTP_STATUS.OK, ...body } = result;
    return response.status(statusCode).json(body);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to travel to that location.') });
  }
});

export default router;
