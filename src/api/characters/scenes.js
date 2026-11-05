import express from 'express';
import prisma from '../../services/prismaClient.js';
import { getUserActiveParty } from '../../containers/partyContainer.js';
import { abandonCharacterScene, createCharacterScene, listCharacterScenes, solveCharacterScene, updateCharacterScene } from '../../containers/sceneContainer.js';
import { requestFateCheck } from '../../services/fateCheckService.js';
import { requestSkillCheck } from '../../services/skillCheckService.js';
import { normalizeOdds } from '../../containers/core/fateRules.js';
import { findStorySkill, normalizeRollMode, parseDc } from '../../containers/core/skillCheckRules.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from '../middleware.js';
import { CHAOS_FACTOR_MAX, CHAOS_FACTOR_MIN, ERROR_NAMES, FATE_CHECK, HTTP_STATUS, NUMERIC_ID_PATTERN, SKILL_CHECK } from '../../configs/constants.js';

const router = express.Router();

function ownCharacterSession(request, response, message) {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) {
    response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
    return null;
  }
  const session = requireSession(request, response);
  if (!session) return null;
  if (session.id !== Number(request.params.id)) {
    response.status(HTTP_STATUS.FORBIDDEN).json({ error: message });
    return null;
  }
  return session;
}

function sendSceneError(response, error, fallback) {
  if (error?.name === ERROR_NAMES.SCENE_RULE) return response.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({ error: error.message });
  return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, fallback) });
}

router.get('/:id/scenes', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only view your own scenes.');
  if (!session) return;
  try {
    const scenes = await listCharacterScenes(session.id);
    return response.status(HTTP_STATUS.OK).json({ success: true, ...scenes });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to load scenes.');
  }
});

router.post('/:id/scenes', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only add scenes to your own character.');
  if (!session) return;
  try {
    const body = request.body || {};
    const scene = await createCharacterScene({
      userId: session.user_id,
      characterId: session.id,
      sceneGoal: body.scene_goal,
      sceneNotes: body.scene_notes ?? '',
      npcCharacterId: body.npc_character_id ?? null,
      affinityReward: body.affinity_reward ?? 0
    });
    return response.status(HTTP_STATUS.CREATED).json({ success: true, scene });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to create the scene.');
  }
});

router.put('/:id/scenes/:sceneId', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only edit your own scenes.');
  if (!session) return;
  try {
    const body = request.body || {};
    const scene = await updateCharacterScene({
      characterId: session.id,
      sceneId: request.params.sceneId,
      sceneGoal: body.scene_goal,
      sceneNotes: body.scene_notes,
      npcCharacterId: body.npc_character_id,
      affinityReward: body.affinity_reward
    });
    return response.status(HTTP_STATUS.OK).json({ success: true, scene });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to update the scene.');
  }
});

router.post('/:id/scenes/:sceneId/solve', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only solve your own scenes.');
  if (!session) return;
  try {
    const resolution = typeof request.body?.resolution === 'string' ? request.body.resolution.trim().slice(0, 500) : '';
    const scene = await solveCharacterScene({ characterId: session.id, sceneId: request.params.sceneId, resolution });
    return response.status(HTTP_STATUS.OK).json({ success: true, scene });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to solve the scene.');
  }
});

router.delete('/:id/scenes/:sceneId', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only delete your own scenes.');
  if (!session) return;
  try {
    const scene = await abandonCharacterScene({ characterId: session.id, sceneId: request.params.sceneId });
    return response.status(HTTP_STATUS.OK).json({ success: true, scene });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to delete the scene.');
  }
});

router.post('/:id/fate-check', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only request fate checks for your own character.');
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
  if (!question) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Write a yes/no question for the fate check.' });
  if (question.length > FATE_CHECK.QUESTION_MAX_LENGTH) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: `Fate check questions must be ${FATE_CHECK.QUESTION_MAX_LENGTH} characters or fewer.` });
  const odds = normalizeOdds(request.body?.odds);
  if (!odds) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Choose the odds for your fate check question.' });
  const rawChaos = request.body?.chaosFactor;
  const chaosFactor = rawChaos === undefined || rawChaos === null || rawChaos === '' ? null : Number(rawChaos);
  if (chaosFactor !== null && (!Number.isInteger(chaosFactor) || chaosFactor < CHAOS_FACTOR_MIN || chaosFactor > CHAOS_FACTOR_MAX)) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: `Chaos factor must be a whole number from ${CHAOS_FACTOR_MIN} to ${CHAOS_FACTOR_MAX}.` });
  }
  try {
    const partyInfo = await getUserActiveParty(session.user_id);
    const party = partyInfo?.party || null;
    if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
      return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Only the party leader can request a fate check.' });
    }
    const character = await prisma.characters.findFirst({
      where: { id: session.id, deleted: false },
      select: { id: true, name: true, race: true, job: true, location_id: true, sublocation_id: true, location: { select: { name: true } }, sublocation: { select: { name: true } } }
    });
    if (!character) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
    const fateCheck = await requestFateCheck({ character, question, odds, chaosFactor });
    return response.status(HTTP_STATUS.OK).json({ success: true, fateCheck });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to roll the fate check.');
  }
});

router.post('/:id/skill-check', async (request, response) => {
  const session = ownCharacterSession(request, response, 'You can only request skill checks for your own character.');
  if (!session) return;
  if (!await requireOutOfCombat(session, response)) return;
  const skill = findStorySkill(request.body?.skill);
  if (!skill) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Choose a skill for the check.' });
  const dc = parseDc(request.body?.dc);
  if (dc === null) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: `DC must be a whole number from ${SKILL_CHECK.DC_MIN} to ${SKILL_CHECK.DC_MAX}.` });
  const rollMode = normalizeRollMode(request.body?.rollMode);
  try {
    const partyInfo = await getUserActiveParty(session.user_id);
    const party = partyInfo?.party || null;
    if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
      return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Only the party leader can request a skill check.' });
    }
    const skillCheck = await requestSkillCheck({ characterId: session.id, skillKey: skill.key, dc, rollMode });
    return response.status(HTTP_STATUS.OK).json({ success: true, skillCheck });
  } catch (error) {
    return sendSceneError(response, error, 'Unable to roll the skill check.');
  }
});

export default router;
