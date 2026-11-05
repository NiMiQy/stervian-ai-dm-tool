import express from 'express';
import { executeFish, FishingRuleError, getFishingData } from '../containers/fishingContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/fishing', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await getFishingData(session.user_id));
  } catch (error) {
    return response.status(error instanceof FishingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof FishingRuleError ? error.message : databaseFailureMessage(error, 'Unable to load fishing data.')
    });
  }
});

router.post('/fishing/fish', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await executeFish(session.user_id));
  } catch (error) {
    return response.status(error instanceof FishingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof FishingRuleError ? error.message : databaseFailureMessage(error, 'Unable to perform fishing action.')
    });
  }
});

export default router;
