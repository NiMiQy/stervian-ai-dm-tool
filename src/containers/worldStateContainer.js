import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { getGameTime } from '../services/gameClockService.js';
import { describeWeather, getLocationWeather } from '../services/locationWeatherService.js';
import { ambienceScopeKey, isAmbienceFresh, rollAmbience } from '../services/locationAmbienceService.js';

const WORLD_STATE_ACTIONS = Object.freeze({ AMBIENCE: 'ambience', WEATHER: 'weather' });

function describeAmbienceState(record, templateTitles, gameTime) {
  if (!record) return null;
  return {
    ambienceId: record.ambience_id,
    title: record.ambience_id ? (templateTitles.get(record.ambience_id) || `#${record.ambience_id} (deleted)`) : null,
    timeSlot: record.time_slot,
    weather: record.weather,
    crowdLevel: record.crowd_level,
    description: record.description,
    figures: Array.isArray(record.figures) ? record.figures : [],
    slotStartedAt: new Date(record.slot_started_at).toISOString(),
    stale: !isAmbienceFresh(record, gameTime),
  };
}

export async function getWorldState() {
  const gameTime = getGameTime();
  try {
    const [locations, states, templateCounts] = await Promise.all([
      prisma.locations.findMany({
        where: { deleted: { not: true } },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          location_type: true,
          weather: true,
          sublocations: { where: { deleted: { not: true } }, orderBy: { id: 'asc' }, select: { id: true, name: true, sublocation_type: true, is_sheltered: true } },
        },
      }),
      prisma.location_ambience_states.findMany(),
      prisma.ambiences.groupBy({ by: ['location_id', 'sublocation_id'], where: { deleted: { not: true }, is_active: true }, _count: { _all: true } }),
    ]);
    const ambienceIds = [...new Set(states.map((state) => state.ambience_id).filter(Boolean))];
    const titles = ambienceIds.length ? await prisma.ambiences.findMany({ where: { id: { in: ambienceIds } }, select: { id: true, title: true } }) : [];
    const templateTitles = new Map(titles.map((row) => [row.id, row.title]));
    const statesByScope = new Map(states.map((state) => [state.scope_key, state]));
    const countsByScope = new Map(templateCounts.map((row) => [ambienceScopeKey(row.location_id, row.sublocation_id), row._count._all]));
    const place = (location, sublocation = null) => {
      const key = ambienceScopeKey(location.id, sublocation?.id);
      return {
        scopeKey: key,
        locationId: location.id,
        sublocationId: sublocation?.id || null,
        name: sublocation ? sublocation.name : location.name,
        locationName: location.name,
        type: sublocation ? sublocation.sublocation_type : location.location_type,
        isSheltered: sublocation ? Boolean(sublocation.is_sheltered) : false,
        templateCount: countsByScope.get(key) || 0,
        ambience: describeAmbienceState(statesByScope.get(key), templateTitles, gameTime),
      };
    };
    return {
      gameTime,
      locations: locations.map((location) => ({
        ...place(location),
        weather: location.weather ? { ...describeWeather(location.weather, gameTime), expired: new Date(location.weather.expires_at) <= new Date() } : null,
        sublocations: location.sublocations.map((sublocation) => place(location, sublocation)),
      })),
    };
  } catch (error) {
    throw databaseError('getWorldState', 'load live world state', error);
  }
}

export async function rerollWorldState(input = {}) {
  const action = input.action;
  const locationId = Number(input.location_id);
  const sublocationId = Number(input.sublocation_id) || null;
  if (!Number.isInteger(locationId) || locationId < 1) throw new Error('A location is required.');
  if (!Object.values(WORLD_STATE_ACTIONS).includes(action)) throw new Error('Unknown world state action.');
  try {
    if (action === WORLD_STATE_ACTIONS.WEATHER) {
      await prisma.location_weathers.updateMany({ where: { location_id: locationId }, data: { expires_at: new Date() } });
      const record = await getLocationWeather(locationId);
      return { weather: record ? describeWeather(record) : null };
    }
    await prisma.location_ambience_states.deleteMany({ where: { scope_key: ambienceScopeKey(locationId, sublocationId) } });
    const { state } = await rollAmbience(locationId, sublocationId);
    return { ambienceId: state?.ambience_id || null };
  } catch (error) {
    throw databaseError('rerollWorldState', `reroll ${action}`, error);
  }
}
