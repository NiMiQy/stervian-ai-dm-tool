import { randomInt, randomUUID } from 'node:crypto';
import prisma from './prismaClient.js';
import { adjustSceneChaosFactor, listOngoingScenes } from '../containers/sceneContainer.js';
import { FATE_RESULT_LABELS, clampChaosFactor, isRandomEventRoll, normalizeOdds, pickFocusScene, resolveFate, rollD100, rollRandomEvent } from '../containers/core/fateRules.js';
import {
  DEFAULT_CHAOS_FACTOR,
  FATE_CHECK,
  FATE_ODDS,
  FATE_ODDS_LABELS,
  FATE_RESULT
} from '../configs/constants.js';

const pendingFateChecks = new Map();

function sweepPending(now = Date.now()) {
  for (const [key, entry] of pendingFateChecks) {
    if (entry.expiresAt <= now) pendingFateChecks.delete(key);
  }
}

export async function requestFateCheck({ character, question, odds, chaosFactor: chosenChaos = null, db = prisma, random = randomInt }) {
  const chosenOdds = normalizeOdds(odds) || FATE_ODDS.FIFTY_FIFTY;
  const scenes = await listOngoingScenes(character.id, db);
  const scene = pickFocusScene(scenes, character);
  const chaosFactor = clampChaosFactor(chosenChaos ?? scene?.chaos_factor ?? DEFAULT_CHAOS_FACTOR);
  const roll = rollD100(random);
  const { result, cell } = resolveFate(chosenOdds, chaosFactor, roll);
  const randomEvent = isRandomEventRoll(roll, chaosFactor) ? rollRandomEvent(scenes, random) : null;
  const fateCheck = {
    id: randomUUID(),
    question,
    odds: chosenOdds,
    oddsLabel: FATE_ODDS_LABELS[chosenOdds],
    chaosFactor,
    sceneId: scene?.id ?? null,
    sceneGoal: scene?.scene_goal ?? null,
    roll,
    thresholds: { exceptionalYes: cell.exceptionalYes, yes: cell.yes, exceptionalNo: cell.exceptionalNo },
    result,
    resultLabel: FATE_RESULT_LABELS[result],
    randomEvent,
    createdAt: Date.now()
  };
  sweepPending();
  pendingFateChecks.set(Number(character.id), { ...fateCheck, expiresAt: Date.now() + FATE_CHECK.PENDING_TTL_MS });
  return fateCheck;
}

export function consumePendingFateCheck(characterId, fateCheckId) {
  sweepPending();
  const key = Number(characterId);
  const entry = pendingFateChecks.get(key);
  if (!entry || entry.id !== fateCheckId) return null;
  pendingFateChecks.delete(key);
  const { expiresAt, ...fateCheck } = entry;
  return fateCheck;
}

export async function applyFateCheckChaos(characterId, fateCheck, db = prisma) {
  if (!fateCheck?.sceneId) return null;
  const delta = fateCheck.result === FATE_RESULT.EXCEPTIONAL_YES
    ? FATE_CHECK.EXCEPTIONAL_YES_CHAOS_DELTA
    : fateCheck.result === FATE_RESULT.EXCEPTIONAL_NO ? FATE_CHECK.EXCEPTIONAL_NO_CHAOS_DELTA : 0;
  if (!delta) return null;
  try {
    return await adjustSceneChaosFactor({ characterId, sceneId: fateCheck.sceneId, delta }, db);
  } catch (error) {
    console.warn('Unable to adjust scene chaos factor:', error.message);
    return null;
  }
}

export { formatFateCheckForPrompt, toStoredFateCheck } from '../containers/core/fateRules.js';
