import { randomInt } from 'node:crypto';
import {
  CHAOS_FACTOR_MAX,
  CHAOS_FACTOR_MIN,
  DEFAULT_CHAOS_FACTOR,
  FATE_CHART,
  FATE_CHECK,
  FATE_ODDS,
  FATE_RESULT,
  RANDOM_EVENT_FOCUS,
  RANDOM_EVENT_FOCUS_FOR_STORY_TABLE,
  THREAD_EVENT_FOCUSES,
  VALID_FATE_ODDS
} from '../../configs/constants.js';

export const FATE_RESULT_LABELS = Object.freeze({
  [FATE_RESULT.EXCEPTIONAL_YES]: 'Exceptional Yes',
  [FATE_RESULT.YES]: 'Yes',
  [FATE_RESULT.NO]: 'No',
  [FATE_RESULT.EXCEPTIONAL_NO]: 'Exceptional No'
});

export function clampChaosFactor(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return DEFAULT_CHAOS_FACTOR;
  return Math.min(CHAOS_FACTOR_MAX, Math.max(CHAOS_FACTOR_MIN, number));
}

export function pickFocusScene(scenes = [], character = {}) {
  if (!scenes.length) return null;
  const locationId = character?.location_id ?? null;
  const sublocationId = character?.sublocation_id ?? null;
  return scenes.find((scene) => sublocationId && scene.sublocation_id === sublocationId)
    || scenes.find((scene) => locationId && scene.location_id === locationId && !scene.sublocation_id)
    || scenes.find((scene) => locationId && scene.location_id === locationId)
    || scenes[0];
}

export function rollD100(random = randomInt) {
  return random(1, FATE_CHECK.DIE_SIDES + 1);
}

export function resolveFate(odds, chaosFactor, roll) {
  const row = FATE_CHART[odds] || FATE_CHART[FATE_ODDS.FIFTY_FIFTY];
  const cell = row[clampChaosFactor(chaosFactor) - 1];
  if (cell.exceptionalYes !== null && roll <= cell.exceptionalYes) return { result: FATE_RESULT.EXCEPTIONAL_YES, cell };
  if (roll <= cell.yes) return { result: FATE_RESULT.YES, cell };
  if (cell.exceptionalNo !== null && roll >= cell.exceptionalNo) return { result: FATE_RESULT.EXCEPTIONAL_NO, cell };
  return { result: FATE_RESULT.NO, cell };
}

export function isRandomEventRoll(roll, chaosFactor) {
  if (roll < 11 || roll > 99 || roll % 11 !== 0) return false;
  return Math.floor(roll / 10) <= clampChaosFactor(chaosFactor);
}

export function findRandomEventFocus(roll) {
  return RANDOM_EVENT_FOCUS_FOR_STORY_TABLE.find((entry) => roll >= entry.min && roll <= entry.max) || RANDOM_EVENT_FOCUS_FOR_STORY_TABLE[RANDOM_EVENT_FOCUS_FOR_STORY_TABLE.length - 1];
}

export function rollRandomEvent(scenes = [], random = randomInt) {
  const focusRoll = rollD100(random);
  let entry = findRandomEventFocus(focusRoll);
  let threadScene = null;
  if (THREAD_EVENT_FOCUSES.includes(entry.focus)) {
    if (scenes.length) {
      threadScene = scenes[random(0, scenes.length)];
    } else {
      entry = RANDOM_EVENT_FOCUS_FOR_STORY_TABLE.find((candidate) => candidate.focus === RANDOM_EVENT_FOCUS.CURRENT_CONTEXT);
    }
  }
  return {
    roll: focusRoll,
    focus: entry.focus,
    label: entry.label,
    guidance: entry.guidance,
    threadScene: threadScene ? { id: threadScene.id, scene_goal: threadScene.scene_goal } : null
  };
}

export function normalizeOdds(value) {
  const key = String(value || '').trim().toUpperCase().replace(/[\s/-]+/g, '_');
  if (VALID_FATE_ODDS.includes(key)) return key;
  if (key === '50_50' || key === 'FIFTY' || key === 'EVEN') return FATE_ODDS.FIFTY_FIFTY;
  return null;
}

export function toStoredFateCheck(fateCheck) {
  if (!fateCheck) return null;
  return {
    question: fateCheck.question,
    odds: fateCheck.odds,
    oddsLabel: fateCheck.oddsLabel,
    chaosFactor: fateCheck.chaosFactor,
    sceneId: fateCheck.sceneId,
    roll: fateCheck.roll,
    result: fateCheck.result,
    resultLabel: fateCheck.resultLabel,
    randomEvent: fateCheck.randomEvent
      ? { roll: fateCheck.randomEvent.roll, focus: fateCheck.randomEvent.focus, label: fateCheck.randomEvent.label, threadSceneId: fateCheck.randomEvent.threadScene?.id ?? null }
      : null
  };
}

export function formatFateCheckForPrompt(fateCheck) {
  if (!fateCheck) return '';
  const lines = [
    '### Fate Check This Turn (system-rolled, binding; see Fate Check Rules)',
    `Question: "${fateCheck.question}"`,
    `Odds: ${fateCheck.oddsLabel} | Chaos Factor: ${fateCheck.chaosFactor} | d100 roll: ${fateCheck.roll} | Result: ${fateCheck.resultLabel.toUpperCase()}`
  ];
  if (fateCheck.randomEvent) {
    const event = fateCheck.randomEvent;
    lines.push(`Random Event (rolled a double at or under the Chaos Factor). Focus roll ${event.roll}: ${event.label}. ${event.guidance}`);
    if (event.threadScene) lines.push(`The event concerns scene #${event.threadScene.id}: "${event.threadScene.scene_goal}".`);
  }
  return lines.join('\n');
}
