import express from 'express';
import { createEncounter, getOrRestoreBattle, performBattleAction, resetTrainingStats, startTrainingBattle, updateTrainingDummy } from '../containers/core/battleSystemCore.js';
import { getCharacterSheet } from '../containers/characterContainer.js';
import { getAreaCombatTargets, startAreaEncounter } from '../containers/areaCombatContainer.js';
import { databaseFailureMessage, requireSession } from './middleware.js';
import { BATTLE_STATUS, HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/encounter', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    let monsterNames = request.query.monsterNames;
    if (typeof monsterNames === 'string') {
      try { monsterNames = JSON.parse(monsterNames); } catch { monsterNames = [monsterNames]; }
    }
    const requestedNames = monsterNames || request.query.monsterName;
    const battle = await createEncounter(session.user_id, () => getCharacterSheet(session.user_id), requestedNames);
    if (battle?.error) return response.status(HTTP_STATUS.NOT_FOUND).json(battle);
    return response.json(battle);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load the battle encounter.') });
  }
});

router.get('/area-targets', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const targets = await getAreaCombatTargets(session.user_id);
    if (!targets) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
    return response.json(targets);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load the targets in this area.') });
  }
});

router.post('/area-encounter', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await startAreaEncounter(session.user_id, request.body?.targets);
    if (result.error) return response.status(result.statusCode || HTTP_STATUS.BAD_REQUEST).json({ error: result.error });
    return response.json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to start the battle.') });
  }
});

router.get('/active', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const battle = await getOrRestoreBattle(session.user_id);
    return response.json(battle?.status === BATTLE_STATUS.IN_PROGRESS ? { inCombat: true, battle } : { inCombat: false });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to check active battle status.') });
  }
});

router.post('/actions', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const result = await performBattleAction(session.user_id, request.body);
    return response.json(result);
  } catch (error) {
    return response.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, error.message || 'Unable to resolve the battle action.') });
  }
});

router.post('/training/start', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const battle = await startTrainingBattle(session.user_id, () => getCharacterSheet(session.user_id), request.body?.config || {});
    if (battle?.error) return response.status(HTTP_STATUS.CONFLICT).json(battle);
    return response.json({ battle });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to start training.') });
  }
});

router.post('/training/config', (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json({ battle: updateTrainingDummy(session.user_id, request.body?.config || {}) });
  } catch (error) {
    return response.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({ error: error.message || 'Unable to update the training dummy.' });
  }
});

router.post('/training/reset', (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    return response.json({ battle: resetTrainingStats(session.user_id) });
  } catch (error) {
    return response.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({ error: error.message || 'Unable to reset training.' });
  }
});

export default router;
