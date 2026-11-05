import express from 'express';
import prisma from '../../services/prismaClient.js';
import { databaseError } from '../../database/databaseError.js';
import { endDialogueSession, getLeavingDialogueSessions, getResumableDialogueSessions, resumeDialogueSessions } from '../../containers/dialogueContainer.js';
import { databaseFailureMessage, requireSession } from '../middleware.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../../configs/constants.js';

const router = express.Router();

function ownSession(request, response) {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) {
    response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
    return null;
  }
  const session = requireSession(request, response);
  if (!session) return null;
  if (session.id !== Number(request.params.id)) {
    response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own conversations.' });
    return null;
  }
  return session;
}

async function playerCharacterId(session) {
  try {
    const character = await prisma.characters.findUnique({ where: { user_id: session.user_id }, select: { id: true } });
    return character?.id || null;
  } catch (error) {
    throw databaseError('playerCharacterId', 'load player character', error);
  }
}

router.get('/:id/dialogue/leave-check', async (request, response) => {
  const session = ownSession(request, response);
  if (!session) return;
  try {
    const leaveLocation = request.query?.type === 'travel';
    const rawSublocation = request.query?.sublocationId;
    const newSublocationId = !leaveLocation && rawSublocation && NUMERIC_ID_PATTERN.test(String(rawSublocation)) ? Number(rawSublocation) : null;
    const playerId = await playerCharacterId(session);
    if (!playerId) return response.json({ sessions: [] });
    return response.json({ sessions: await getLeavingDialogueSessions(playerId, { newSublocationId, leaveLocation }) });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to check your conversations.') });
  }
});

router.get('/:id/dialogue/resumable', async (request, response) => {
  const session = ownSession(request, response);
  if (!session) return;
  try {
    const playerId = await playerCharacterId(session);
    if (!playerId) return response.json({ sessions: [] });
    return response.json({ sessions: await getResumableDialogueSessions(playerId) });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to check paused conversations.') });
  }
});

router.post('/:id/dialogue/resume', async (request, response) => {
  const session = ownSession(request, response);
  if (!session) return;
  try {
    const playerId = await playerCharacterId(session);
    if (!playerId) return response.json({ sessions: [] });
    return response.json({ sessions: await resumeDialogueSessions(playerId) });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to resume your conversations.') });
  }
});

router.post('/:id/dialogue/end', async (request, response) => {
  const session = ownSession(request, response);
  if (!session) return;
  const targetNpcId = Number(request.body?.targetNpcId);
  if (!Number.isInteger(targetNpcId) || targetNpcId <= 0) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Select an NPC to end the conversation with.' });
  try {
    const playerId = await playerCharacterId(session);
    const sessions = playerId ? await endDialogueSession(playerId, targetNpcId) : [];
    return response.json({ success: true, sessions, message: sessions.length ? `Conversation with ${sessions[0].npcName} ended.` : 'There is no open conversation with that NPC.' });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to end the conversation.') });
  }
});

export default router;
