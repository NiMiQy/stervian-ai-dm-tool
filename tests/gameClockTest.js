import assert from 'node:assert/strict';
import { getGameTime } from '../src/services/gameClockService.js';
import { GAME_CLOCK } from '../src/configs/constants.js';

const at = (minutes, seconds = 0) => {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() + minutes * 60000 + seconds * 1000);
};

assert.equal(GAME_CLOCK.SLOTS.reduce((sum, slot) => sum + slot.durationMs, 0), GAME_CLOCK.CYCLE_MS);
const cases = [[0, 0, 'MORNING'], [23, 59, 'MORNING'], [24, 0, 'AFTERNOON'], [35, 59, 'AFTERNOON'], [36, 0, 'EVENING'], [46, 47, 'EVENING'], [46, 48, 'NIGHT'], [59, 59, 'NIGHT']];
for (const [minutes, seconds, expected] of cases) assert.equal(getGameTime(at(minutes, seconds)).slot, expected, `${minutes}:${seconds}`);
assert.equal(getGameTime(at(0)).remainingMs, 24 * 60000);
assert.equal(getGameTime(at(46, 48)).nextSlot, 'MORNING');
console.log('gameClockTest passed. Current:', getGameTime());
