import express from 'express';
import { createStoryTurn, getCharacterStoryHistory, clearCharacterStoryHistory } from '../../services/storyService.js';
import { databaseFailureMessage, requireSession } from '../middleware.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../../configs/constants.js';

const router = express.Router();

router.get('/:id/history', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only view your own story history.' });
  try {
    const stories = await getCharacterStoryHistory(session.id);
    return response.status(HTTP_STATUS.OK).json({ success: true, stories });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load story history.') });
  }
});

router.post('/:id/stories', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only add stories to your own character.' });
  try {
    const { action_from_player, story, conversation_session_id } = request.body || {};
    const created = await createStoryTurn({
      userId: session.user_id,
      characterId: session.id,
      actionFromPlayer: action_from_player,
      story,
      conversationSessionId: conversation_session_id
    });
    return response.status(HTTP_STATUS.CREATED).json({ success: true, story: created });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to create story turn.') });
  }
});

router.delete('/:id/history', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only clear your own story history.' });
  try {
    const result = await clearCharacterStoryHistory(session.id, session.user_id);
    return response.status(HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to clear story history.') });
  }
});

export default router;
