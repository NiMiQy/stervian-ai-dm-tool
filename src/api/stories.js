import express from 'express';
import { updateStoryTurn, deleteStoryTurn } from '../services/storyService.js';
import { databaseFailureMessage, requireSession } from './middleware.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../configs/constants.js';

const router = express.Router();

router.put('/:id', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Story not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await updateStoryTurn(request.params.id, session.user_id, request.body || {});
    if (result.error) return response.status(result.statusCode || HTTP_STATUS.BAD_REQUEST).json(result);
    return response.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to update story.') });
  }
});

router.delete('/:id', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Story not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await deleteStoryTurn(request.params.id, session.user_id);
    if (result.error) return response.status(result.statusCode || HTTP_STATUS.BAD_REQUEST).json(result);
    return response.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to delete story.') });
  }
});

export default router;
