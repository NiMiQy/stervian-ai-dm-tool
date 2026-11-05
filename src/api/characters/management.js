import express from 'express';
import { createStarterCharacter } from '../../containers/characterCreationContainer.js';
import { getCharacterSheet, upgradeCharacterStat, updateCharacterAvatar } from '../../containers/characterContainer.js';
import { databaseFailureMessage, getOwnedRecord, requireOutOfCombat, requireSession } from '../middleware.js';
import { ERROR_NAMES, HTTP_STATUS, NUMERIC_ID_PATTERN } from '../../configs/constants.js';

const router = express.Router();

router.post('/', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await createStarterCharacter(session.user_id, request.body);
    return response.status(result.error ? (result.error.includes('already has') ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    console.error('Character creation failed:', error);
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to create your character.') });
  }
});

router.get('/:id', (request, response) => getOwnedRecord(request, response, getCharacterSheet, 'character'));

router.post('/:id/avatar', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only update your own character.' });
  try {
    const result = await updateCharacterAvatar(session.user_id, request.body?.imageData);
    if (!result) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
    return response.json(result);
  } catch (error) {
    return response.status(error.name === ERROR_NAMES.DATABASE_OPERATION ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to update your avatar.') });
  }
});

router.post('/:id/stats', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only upgrade your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await upgradeCharacterStat(session.user_id, request.body?.stat);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to upgrade that attribute.') });
  }
});

export default router;
