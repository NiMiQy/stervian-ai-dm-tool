import express from 'express';
import {
  createParty,
  dismissCompanion,
  getUserActiveParty,
  invitePlayer,
  leaveParty,
  recruitNpcCompanion,
  respondToInvite,
  updateCompanionTactics
} from '../containers/partyContainer.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json(await getUserActiveParty(session.user_id));
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load party.') });
  }
});

router.post('/create', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await createParty(session.user_id, request.body?.name);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to create party.') });
  }
});

router.post('/invite', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await invitePlayer(session.user_id, request.body?.target);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to send party invite.') });
  }
});

router.post('/invites/:id/respond', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await respondToInvite(session.user_id, request.params.id, Boolean(request.body?.accept));
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to respond to invite.') });
  }
});

router.post('/recruit-npc', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await recruitNpcCompanion(session.user_id, request.body?.npcId);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to recruit companion.') });
  }
});

router.post('/dismiss-npc', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await dismissCompanion(session.user_id, request.body?.companionId);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to dismiss companion.') });
  }
});

router.post('/leave', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const result = await leaveParty(session.user_id);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to leave party.') });
  }
});

router.patch('/members/:id/tactics', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await updateCompanionTactics(session.user_id, request.params.id, request.body?.tacticsRole);
    return response.status(result.error ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.OK).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to update companion tactics.') });
  }
});

export default router;
