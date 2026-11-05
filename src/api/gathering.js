import express from 'express';
import { executeGather, GatheringRuleError, getGatheringData } from '../containers/gatheringContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/gathering', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await getGatheringData(session.user_id));
  } catch (error) {
    return response.status(error instanceof GatheringRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof GatheringRuleError ? error.message : databaseFailureMessage(error, 'Unable to load gathering data.')
    });
  }
});

router.post('/gathering/gather', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    return response.json(await executeGather(session.user_id));
  } catch (error) {
    return response.status(error instanceof GatheringRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof GatheringRuleError ? error.message : databaseFailureMessage(error, 'Unable to perform gathering action.')
    });
  }
});

export default router;
