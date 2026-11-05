import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { broadcastToUsers } from './webSocketService.js';
import { getGameTime } from './gameClockService.js';
import { CHARACTER_TYPE, GAME_TIME_SLOT, LOCATION_WEATHER, WEBSOCKET_EVENTS } from '../configs/constants.js';

const NIGHT_SLOTS = new Set([GAME_TIME_SLOT.EVENING, GAME_TIME_SLOT.NIGHT]);

export function pickWeighted(weights, random = Math.random) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function rollNextWeather(currentWeather, random = Math.random) {
  const transitions = LOCATION_WEATHER.TRANSITIONS[currentWeather];
  return transitions ? pickWeighted(transitions, random) : pickWeighted(LOCATION_WEATHER.INITIAL_WEIGHTS, random);
}

export function rollInitialWeather(random = Math.random) {
  return pickWeighted(LOCATION_WEATHER.INITIAL_WEIGHTS, random);
}

export function rollWeatherDurationMs(random = Math.random) {
  const { MIN_DURATION_MS, MAX_DURATION_MS } = LOCATION_WEATHER;
  return MIN_DURATION_MS + Math.floor(random() * (MAX_DURATION_MS - MIN_DURATION_MS + 1));
}

export function describeWeather(record, gameTime = getGameTime()) {
  if (!record) return null;
  const isNight = NIGHT_SLOTS.has(gameTime.slot);
  const label = (isNight && LOCATION_WEATHER.NIGHT_LABELS[record.weather]) || LOCATION_WEATHER.LABELS[record.weather] || record.weather;
  return {
    locationId: record.location_id,
    weather: record.weather,
    label,
    startedAt: new Date(record.started_at).toISOString(),
    endsAt: new Date(record.expires_at).toISOString(),
  };
}

function nextWeatherData(currentWeather, now = new Date()) {
  const weather = currentWeather ? rollNextWeather(currentWeather) : rollInitialWeather();
  return { weather, started_at: now, expires_at: new Date(now.getTime() + rollWeatherDurationMs()) };
}

export async function ensureAllLocationWeathers(client = prisma) {
  try {
    const missing = await client.locations.findMany({ where: { deleted: { not: true }, weather: null }, select: { id: true } });
    if (!missing.length) return 0;
    const now = new Date();
    const result = await client.location_weathers.createMany({
      data: missing.map(({ id }) => ({ location_id: id, ...nextWeatherData(null, now) })),
      skipDuplicates: true,
    });
    return result.count;
  } catch (error) {
    throw databaseError('ensureAllLocationWeathers', 'initialize location weather', error);
  }
}

export async function getLocationWeather(locationId, client = prisma) {
  const id = Number(locationId);
  if (!Number.isInteger(id) || id < 1) return null;
  try {
    let record = await client.location_weathers.findUnique({ where: { location_id: id } });
    const now = new Date();
    if (!record) {
      const location = await client.locations.findUnique({ where: { id }, select: { id: true } });
      if (!location) return null;
      record = await client.location_weathers.upsert({ where: { location_id: id }, create: { location_id: id, ...nextWeatherData(null, now) }, update: {} });
    } else if (record.expires_at <= now) {
      record = await advanceWeather(record, now, client);
    }
    return record;
  } catch (error) {
    throw databaseError('getLocationWeather', 'load location weather', error);
  }
}

async function advanceWeather(record, now, client) {
  const data = nextWeatherData(record.weather, now);
  const result = await client.location_weathers.updateMany({ where: { id: record.id, expires_at: record.expires_at }, data });
  if (!result.count) return client.location_weathers.findUnique({ where: { id: record.id } });
  return { ...record, ...data, changed: data.weather !== record.weather };
}

async function notifyPlayersInLocation(record, client) {
  const players = await client.characters.findMany({
    where: { location_id: record.location_id, character_type: CHARACTER_TYPE.PLAYER, user_id: { not: null } },
    select: { user_id: true },
  });
  if (!players.length) return 0;
  return broadcastToUsers(players.map((player) => player.user_id), WEBSOCKET_EVENTS.LOCATION_WEATHER_CHANGED, describeWeather(record));
}

export async function advanceExpiredWeathers(client = prisma) {
  try {
    await ensureAllLocationWeathers(client);
    const now = new Date();
    const expired = await client.location_weathers.findMany({ where: { expires_at: { lte: now } } });
    let changed = 0;
    for (const record of expired) {
      const updated = await advanceWeather(record, now, client);
      if (updated?.changed) {
        changed += 1;
        await notifyPlayersInLocation(updated, client);
      }
    }
    return { advanced: expired.length, changed };
  } catch (error) {
    throw databaseError('advanceExpiredWeathers', 'advance location weather', error);
  }
}

export function formatWeatherForPrompt(record, { sublocation = null, gameTime = getGameTime() } = {}) {
  const described = describeWeather(record, gameTime);
  if (!described) return '';
  const isNight = NIGHT_SLOTS.has(gameTime.slot);
  const guidance = (isNight && LOCATION_WEATHER.NIGHT_PROMPT_GUIDANCE[record.weather]) || LOCATION_WEATHER.PROMPT_GUIDANCE[record.weather] || '';
  const lines = [`### Local Weather: ${described.label.toUpperCase()}`, `- Outdoors: ${guidance}`];
  if (sublocation?.is_sheltered) {
    lines.push(`- The player is sheltered inside "${sublocation.name}". They know and can hear or see the weather outside, but it does not affect them while they stay inside.`);
  } else if (sublocation) {
    lines.push(`- "${sublocation.name}" is not sheltered; the player is exposed to the weather.`);
  } else {
    lines.push('- The player is outdoors and exposed to the weather.');
  }
  lines.push('- Keep narration consistent with this weather. Weather is atmosphere only and has no mechanical effect.');
  return lines.join('\n');
}

let weatherTimer = null;

export function startLocationWeatherSweep() {
  if (weatherTimer) return stopLocationWeatherSweep;
  const sweep = () => advanceExpiredWeathers().catch((error) => console.warn('[startLocationWeatherSweep] Weather sweep failed:', error.message));
  sweep();
  weatherTimer = setInterval(sweep, LOCATION_WEATHER.SWEEP_INTERVAL_MS);
  weatherTimer.unref?.();
  return stopLocationWeatherSweep;
}

export function stopLocationWeatherSweep() {
  if (weatherTimer) clearInterval(weatherTimer);
  weatherTimer = null;
}
