import express from 'express';
import { executeFarm, buyFarmingSeeds, getFarmingData, FarmingRuleError } from '../containers/farmingContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/farming', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await getFarmingData(session.user_id));
  } catch (error) {
    return response.status(error instanceof FarmingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof FarmingRuleError ? error.message : databaseFailureMessage(error, 'Unable to load farming data.')
    });
  }
});

router.post('/farming/farm', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await executeFarm(session.user_id, request.body));
  } catch (error) {
    return response.status(error instanceof FarmingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof FarmingRuleError ? error.message : databaseFailureMessage(error, 'Unable to perform farming action.')
    });
  }
});

router.post('/farming/buy-seeds', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await buyFarmingSeeds(session.user_id, request.body));
  } catch (error) {
    return response.status(error instanceof FarmingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof FarmingRuleError ? error.message : databaseFailureMessage(error, 'Unable to buy seeds.')
    });
  }
});

export default router;
