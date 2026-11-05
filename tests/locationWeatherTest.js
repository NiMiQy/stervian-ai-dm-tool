import assert from 'node:assert/strict';
import { describeWeather, rollNextWeather, rollWeatherDurationMs } from '../src/services/locationWeatherService.js';
import { LOCATION_WEATHER } from '../src/configs/constants.js';
import prisma from '../src/services/prismaClient.js';

let weather = 'CLEAR';
const seen = new Set();
for (let step = 0; step < 50000; step += 1) {
  const next = rollNextWeather(weather);
  assert.ok(next in LOCATION_WEATHER.TRANSITIONS[weather], `${weather} -> ${next} is not allowed`);
  const duration = rollWeatherDurationMs();
  assert.ok(duration >= LOCATION_WEATHER.MIN_DURATION_MS && duration <= LOCATION_WEATHER.MAX_DURATION_MS);
  seen.add(next);
  weather = next;
}
assert.equal(seen.size, Object.keys(LOCATION_WEATHER.TRANSITIONS).length);
assert.equal(rollNextWeather('FOG'), 'CLEAR');
const record = { location_id: 1, weather: 'SUNNY', started_at: new Date(), expires_at: new Date() };
assert.equal(describeWeather(record, { slot: 'NIGHT' }).label, 'Clear');
assert.equal(describeWeather(record, { slot: 'MORNING' }).label, 'Sunny');
await prisma.$disconnect();
console.log('locationWeatherTest passed.');
