import express from 'express';
import { CampfireRuleError, getCampfireData, restAtCampfire } from '../containers/campfireContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/campfire', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await getCampfireData(session.user_id));
  } catch (error) {
    return response.status(error instanceof CampfireRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof CampfireRuleError ? error.message : databaseFailureMessage(error, 'Unable to load campfire data.')
    });
  }
});

router.post('/campfire/rest', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await restAtCampfire(session.user_id, request.body?.mode));
  } catch (error) {
    return response.status(error instanceof CampfireRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof CampfireRuleError ? error.message : databaseFailureMessage(error, 'Unable to rest at the campfire.')
    });
  }
});

export default router;
