import express from 'express';
import { craftRecipe, CraftingRuleError, getCraftingData, upgradeItemLevel } from '../containers/craftingContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/crafting', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try { return response.json(await getCraftingData(session.user_id)); } catch (error) {
    return response.status(error instanceof CraftingRuleError ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error instanceof CraftingRuleError ? error.message : databaseFailureMessage(error, 'Unable to load crafting data.') });
  }
});

router.post('/crafting/:recipeId/craft', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try { return response.json(await craftRecipe(session.user_id, request.params.recipeId, request.body?.quantity)); } catch (error) {
    return response.status(error instanceof CraftingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error instanceof CraftingRuleError ? error.message : databaseFailureMessage(error, 'Unable to craft that recipe.') });
  }
});

router.post('/crafting/upgrade', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try { return response.json(await upgradeItemLevel(session.user_id, request.body?.itemEntryId)); } catch (error) {
    return response.status(error instanceof CraftingRuleError ? (error.statusCode || HTTP_STATUS.BAD_REQUEST) : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error instanceof CraftingRuleError ? error.message : databaseFailureMessage(error, 'Unable to upgrade that item.') });
  }
});

export default router;
