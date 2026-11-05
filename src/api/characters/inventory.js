import express from 'express';
import {
  buyShopItem,
  enterSublocation,
  equipCharacterItem,
  fulfillInnFoodAndWater,
  sellShopItem,
  takeInnLongRest,
  unequipCharacterItem,
  useCharacterConsumable
} from '../../containers/characterContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from '../middleware.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../../configs/constants.js';

const router = express.Router();

router.post('/:id/equip', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await equipCharacterItem(session.user_id, request.body);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to equip item.') });
  }
});

router.post('/:id/unequip', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await unequipCharacterItem(session.user_id, request.body);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to unequip item.') });
  }
});

router.post('/:id/use-item', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await useCharacterConsumable(session.user_id, request.body);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to use item.') });
  }
});

router.post('/:id/sublocation', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await enterSublocation(session.user_id, request.body?.sublocationId, request.body?.dialogueChoice);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to enter sublocation.') });
  }
});

router.post('/:id/buy-item', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await buyShopItem(session.user_id, request.body);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to purchase item.') });
  }
});

router.post('/:id/sell-item', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await sellShopItem(session.user_id, request.body);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to sell item.') });
  }
});

router.post('/:id/long-rest', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await takeInnLongRest(session.user_id);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to take a long rest.') });
  }
});

router.post('/:id/food-water', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await fulfillInnFoodAndWater(session.user_id);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to restore food and water.') });
  }
});

export default router;
