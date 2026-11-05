import test from 'node:test';
import assert from 'node:assert/strict';
import { FATE_CHART, FATE_ODDS, FATE_RESULT, RANDOM_EVENT_FOCUS, RANDOM_EVENT_FOCUS_FOR_STORY_TABLE } from '../src/configs/constants.js';
import { clampChaosFactor, findRandomEventFocus, isRandomEventRoll, normalizeOdds, pickFocusScene, resolveFate, rollD100, rollRandomEvent, toStoredFateCheck } from '../src/containers/core/fateRules.js';

const sequence = (...values) => {
  let index = 0;
  return () => values[index++];
};

test('fate chart has 9 odds rows with 9 chaos columns each', () => {
  assert.equal(Object.keys(FATE_CHART).length, 9);
  Object.values(FATE_CHART).forEach((row) => assert.equal(row.length, 9));
  assert.deepEqual(FATE_CHART.FIFTY_FIFTY[4], { exceptionalYes: 10, yes: 50, exceptionalNo: 91 });
  assert.deepEqual(FATE_CHART.IMPOSSIBLE[0], { exceptionalYes: null, yes: 1, exceptionalNo: 81 });
  assert.deepEqual(FATE_CHART.CERTAIN[8], { exceptionalYes: 20, yes: 99, exceptionalNo: null });
});

test('resolveFate maps rolls to the four results at the thresholds', () => {
  assert.equal(resolveFate(FATE_ODDS.FIFTY_FIFTY, 5, 10).result, FATE_RESULT.EXCEPTIONAL_YES);
  assert.equal(resolveFate(FATE_ODDS.FIFTY_FIFTY, 5, 11).result, FATE_RESULT.YES);
  assert.equal(resolveFate(FATE_ODDS.FIFTY_FIFTY, 5, 50).result, FATE_RESULT.YES);
  assert.equal(resolveFate(FATE_ODDS.FIFTY_FIFTY, 5, 51).result, FATE_RESULT.NO);
  assert.equal(resolveFate(FATE_ODDS.FIFTY_FIFTY, 5, 90).result, FATE_RESULT.NO);
  assert.equal(resolveFate(FATE_ODDS.FIFTY_FIFTY, 5, 91).result, FATE_RESULT.EXCEPTIONAL_NO);
  assert.equal(resolveFate(FATE_ODDS.IMPOSSIBLE, 1, 1).result, FATE_RESULT.YES);
  assert.equal(resolveFate(FATE_ODDS.CERTAIN, 9, 100).result, FATE_RESULT.NO);
  assert.equal(resolveFate(FATE_ODDS.LIKELY, 9, 100).result, FATE_RESULT.EXCEPTIONAL_NO);
});

test('chaos factor is clamped to 1..9', () => {
  assert.equal(clampChaosFactor(0), 1);
  assert.equal(clampChaosFactor(12), 9);
  assert.equal(clampChaosFactor('x'), 5);
});

test('random events trigger on doubles at or under the chaos factor', () => {
  assert.equal(isRandomEventRoll(33, 5), true);
  assert.equal(isRandomEventRoll(55, 5), true);
  assert.equal(isRandomEventRoll(66, 5), false);
  assert.equal(isRandomEventRoll(34, 9), false);
  assert.equal(isRandomEventRoll(100, 9), false);
  assert.equal(isRandomEventRoll(99, 9), true);
});

test('random event focus table covers 1..100 without gaps', () => {
  for (let roll = 1; roll <= 100; roll += 1) {
    assert.equal(RANDOM_EVENT_FOCUS_FOR_STORY_TABLE.filter((entry) => roll >= entry.min && roll <= entry.max).length, 1, `roll ${roll}`);
  }
  assert.equal(findRandomEventFocus(3).focus, RANDOM_EVENT_FOCUS.REMOTE_EVENT);
  assert.equal(findRandomEventFocus(40).focus, RANDOM_EVENT_FOCUS.NPC_ACTION);
  assert.equal(findRandomEventFocus(68).focus, RANDOM_EVENT_FOCUS.CLOSE_A_THREAD);
  assert.equal(findRandomEventFocus(100).focus, RANDOM_EVENT_FOCUS.CURRENT_CONTEXT);
});

test('thread focus picks an on-going scene, or falls back to current context', () => {
  const scenes = [{ id: 4, scene_goal: 'A' }, { id: 9, scene_goal: 'B' }];
  const withScene = rollRandomEvent(scenes, sequence(60, 1));
  assert.equal(withScene.focus, RANDOM_EVENT_FOCUS.MOVE_AWAY_FROM_A_THREAD);
  assert.equal(withScene.threadScene.id, 9);
  const withoutScene = rollRandomEvent([], sequence(52));
  assert.equal(withoutScene.focus, RANDOM_EVENT_FOCUS.CURRENT_CONTEXT);
  assert.equal(withoutScene.threadScene, null);
});

test('rollD100 stays within 1..100', () => {
  for (let index = 0; index < 2000; index += 1) {
    const roll = rollD100();
    assert.ok(roll >= 1 && roll <= 100);
  }
});

test('odds normalisation and focus scene selection', () => {
  assert.equal(normalizeOdds('very likely'), FATE_ODDS.VERY_LIKELY);
  assert.equal(normalizeOdds('50/50'), FATE_ODDS.FIFTY_FIFTY);
  assert.equal(normalizeOdds('nonsense'), null);
  const scenes = [{ id: 1, location_id: 2, sublocation_id: null }, { id: 2, location_id: 1, sublocation_id: 7 }];
  assert.equal(pickFocusScene(scenes, { location_id: 1, sublocation_id: 7 }).id, 2);
  assert.equal(pickFocusScene(scenes, { location_id: 2, sublocation_id: null }).id, 1);
  assert.equal(pickFocusScene([], {}), null);
});

test('stored fate check keeps only the display fields', () => {
  const stored = toStoredFateCheck({ id: 'x', question: 'Q', odds: 'LIKELY', oddsLabel: 'Likely', chaosFactor: 5, sceneId: null, roll: 22, result: FATE_RESULT.YES, resultLabel: 'Yes', randomEvent: { roll: 70, focus: 'CLOSE_A_THREAD', label: 'Close A Thread', guidance: 'g', threadScene: { id: 3 } } });
  assert.equal(stored.id, undefined);
  assert.equal(stored.randomEvent.threadSceneId, 3);
});
