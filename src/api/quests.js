import express from 'express';
import { abandonQuest, acceptQuest, completeQuest, getQuestBoard } from '../containers/questContainer.js';
import { databaseFailureMessage, requireSession } from './middleware.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../configs/constants.js';

const router = express.Router();

router.get('/', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json(await getQuestBoard(session.user_id));
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load quests.') });
  }
});

router.post('/:id/accept', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Quest not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await acceptQuest(session.user_id, request.params.id);
    return response.status(result.statusCode || (result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK)).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to accept this quest.') });
  }
});

router.post('/:runId/complete', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.runId)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Active quest not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await completeQuest(session.user_id, request.params.runId);
    return response.status(result.statusCode || (result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK)).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to complete this quest.') });
  }
});

router.post('/:runId/abandon', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.runId)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Active quest not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await abandonQuest(session.user_id, request.params.runId);
    return response.status(result.statusCode || (result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK)).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to abandon this quest.') });
  }
});

export default router;
