import { databaseError } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { syncHungerEffects, syncThirstEffects } from '../services/effectServices.js';
import { getCharacterSheet } from './characterContainer.js';
import { resetAmbushChance } from './gatheringContainer.js';
import { CHARACTER_TYPE, HTTP_STATUS, TRANSACTION_ISOLATION } from '../configs/constants.js';
import { closeLocationDialogueSessions } from './dialogueContainer.js';
import { getPartyFollowerBlock, movePartyWithLeader, notifyPartyMoved } from '../services/partyMovementService.js';

function comparePaths(left, right) {
  for (const key of ['energy_cost', 'food_cost', 'water_cost']) {
    if (left.costs[key] !== right.costs[key]) return left.costs[key] - right.costs[key];
  }
  const length = Math.min(left.locationIds.length, right.locationIds.length);
  for (let index = 0; index < length; index += 1) {
    if (left.locationIds[index] !== right.locationIds[index]) return left.locationIds[index] - right.locationIds[index];
  }
  return left.locationIds.length - right.locationIds.length;
}

function findTravelPaths(startId, destinationId, locations, routes) {
  const locationIds = new Set(locations.map((location) => location.id));
  if (!locationIds.has(startId) || (destinationId !== null && (!locationIds.has(destinationId) || startId === destinationId))) return null;
  const edges = new Map();
  for (const route of routes) {
    if (!locationIds.has(route.location_a_id) || !locationIds.has(route.location_b_id)) continue;
    const values = [route.location_a_id, route.location_b_id];
    for (const [from, to] of [[values[0], values[1]], [values[1], values[0]]]) {
      const outgoing = edges.get(from) || [];
      outgoing.push({ route, to });
      edges.set(from, outgoing);
    }
  }
  const best = new Map([[startId, { locationIds: [startId], routeIds: [], costs: { energy_cost: 0, food_cost: 0, water_cost: 0 } }]]);
  const pending = new Set([startId]);
  const visited = new Set();
  while (pending.size) {
    let currentId = null;
    for (const id of pending) {
      if (currentId === null || comparePaths(best.get(id), best.get(currentId)) < 0) currentId = id;
    }
    pending.delete(currentId);
    if (currentId === destinationId) return best.get(currentId);
    visited.add(currentId);
    for (const { route, to } of edges.get(currentId) || []) {
      if (visited.has(to)) continue;
      const current = best.get(currentId);
      const candidate = {
        locationIds: [...current.locationIds, to],
        routeIds: [...current.routeIds, route.id],
        costs: {
          energy_cost: current.costs.energy_cost + route.energy_cost,
          food_cost: current.costs.food_cost + route.food_cost,
          water_cost: current.costs.water_cost + route.water_cost
        }
      };
      const existing = best.get(to);
      if (!existing || comparePaths(candidate, existing) < 0) {
        best.set(to, candidate);
        pending.add(to);
      }
    }
  }
  return destinationId === null ? best : null;
}

async function loadMapGraph(client) {
  const [locations, allRoutes] = await Promise.all([
    client.locations.findMany({ where: { deleted: false }, select: { id: true, name: true, map_x: true, map_y: true } }),
    client.location_routes.findMany({ where: { deleted: false }, orderBy: { id: 'asc' } })
  ]);
  const pinned = locations.filter((location) => Number.isFinite(location.map_x) && Number.isFinite(location.map_y));
  const pinnedIds = new Set(pinned.map((location) => location.id));
  return { locations: pinned, routes: allRoutes.filter((route) => pinnedIds.has(route.location_a_id) && pinnedIds.has(route.location_b_id)) };
}

async function loadAreaMonsterInfo(client, locationIds) {
  const info = new Map(locationIds.map((id) => [id, { monsters: new Map(), areaMonsters: new Map(), sublocations: new Map() }]));
  if (!locationIds.length) return new Map();
  const appearances = await client.npcs_in_locations_or_sublocations.findMany({
    where: {
      deleted: false,
      OR: [
        { location_id: { in: locationIds } },
        { sublocation: { is: { location_id: { in: locationIds }, deleted: false } } }
      ],
      npc: { is: { deleted: false, is_attackable: true, npc_monsters: { is: { deleted: false } }, character: { is: { deleted: false } } } }
    },
    select: {
      location_id: true,
      sublocation: { select: { id: true, name: true, location_id: true } },
      npc: { select: { character: { select: { id: true, name: true, level: true } } } }
    },
    orderBy: { id: 'asc' }
  });
  for (const appearance of appearances) {
    const monster = appearance.npc?.character;
    const locationId = appearance.sublocation?.location_id ?? appearance.location_id;
    const area = info.get(locationId);
    if (!monster || !area) continue;
    const entry = { id: monster.id, name: monster.name || 'Unknown monster', level: Math.max(1, Number(monster.level) || 1) };
    area.monsters.set(monster.id, entry);
    if (appearance.sublocation) {
      const sublocation = area.sublocations.get(appearance.sublocation.id) || { id: appearance.sublocation.id, name: appearance.sublocation.name, monsters: new Map() };
      sublocation.monsters.set(monster.id, entry);
      area.sublocations.set(sublocation.id, sublocation);
    } else {
      area.areaMonsters.set(monster.id, entry);
    }
  }
  const result = new Map();
  for (const [locationId, area] of info) {
    const monsters = [...area.monsters.values()];
    result.set(locationId, {
      monster_count: monsters.length,
      average_level: monsters.length ? Math.round(monsters.reduce((total, monster) => total + monster.level, 0) / monsters.length) : null,
      monsters: [...area.areaMonsters.values()],
      sublocations: [...area.sublocations.values()].map((sublocation) => ({ id: sublocation.id, name: sublocation.name, monsters: [...sublocation.monsters.values()] }))
    });
  }
  return result;
}

export async function getWorldTravelMap(userId) {
  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true, character_type: true, deleted: true, location_id: true, sublocation_id: true, character_stat: true }
    });
    if (!character || character.deleted || character.character_type !== CHARACTER_TYPE.PLAYER) return null;
    const graph = await loadMapGraph(prisma);
    const areaInfo = await loadAreaMonsterInfo(prisma, graph.locations.map((location) => location.id));
    const locationsById = new Map(graph.locations.map((location) => [location.id, location]));
    const currentLocation = locationsById.get(character.location_id) || null;
    const paths = currentLocation ? findTravelPaths(currentLocation.id, null, graph.locations, graph.routes) : null;
    const destinations = currentLocation ? graph.locations
      .filter((location) => location.id !== currentLocation.id)
      .map((location) => {
        const path = paths?.get(location.id);
        return path ? {
          location_id: location.id,
          location_name: location.name,
          path: path.locationIds.map((id) => locationsById.get(id)?.name || `Location #${id}`),
          location_ids: path.locationIds,
          costs: path.costs
        } : null;
      })
      .filter(Boolean) : [];
    return {
      current_location_id: character.location_id,
      current_sublocation_id: character.sublocation_id,
      current_location_name: currentLocation?.name || null,
      resources: character.character_stat ? {
        energy: character.character_stat.current_energy,
        food: character.character_stat.current_food,
        water: character.character_stat.current_water
      } : null,
      locations: graph.locations.map((location) => ({ ...location, area: areaInfo.get(location.id) || { monster_count: 0, average_level: null, monsters: [], sublocations: [] } })),
      routes: graph.routes,
      destinations
    };
  } catch (error) {
    throw databaseError('getWorldTravelMap', 'read world travel map', error);
  }
}

export async function travelToLocation(userId, destinationInput, dialogueChoice = null) {
  const destinationId = Number(destinationInput);
  if (!Number.isInteger(destinationId) || destinationId <= 0) return { error: 'Select a valid destination.', statusCode: HTTP_STATUS.BAD_REQUEST };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.characters.findUnique({ where: { user_id: userId }, select: { id: true, deleted: true, character_type: true } });
      if (!existing || existing.deleted || existing.character_type !== CHARACTER_TYPE.PLAYER) return { error: 'Character not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      await tx.$queryRaw`SELECT id FROM characters WHERE id = ${existing.id} FOR UPDATE`;
      const character = await tx.characters.findFirst({
        where: { id: existing.id, deleted: false },
        select: { id: true, location_id: true, character_stat: true }
      });
      if (!character?.character_stat) return { error: 'Character stats not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      const followerBlock = await getPartyFollowerBlock(tx, character.id);
      if (followerBlock) return { error: followerBlock, statusCode: HTTP_STATUS.FORBIDDEN };
      const graph = await loadMapGraph(tx);
      const destination = graph.locations.find((location) => location.id === destinationId);
      if (!destination) return { error: 'That destination is not available on the world map.', statusCode: HTTP_STATUS.NOT_FOUND };
      const path = findTravelPaths(character.location_id, destinationId, graph.locations, graph.routes);
      if (!path) return { error: 'There is no connected route to that destination.', statusCode: HTTP_STATUS.CONFLICT };
      const stats = character.character_stat;
      if (Number(stats.current_energy ?? 0) < path.costs.energy_cost) return { error: 'Not enough energy to travel. Refill your energy and try again.', statusCode: HTTP_STATUS.CONFLICT };
      if (Number(stats.current_food ?? 0) < path.costs.food_cost) return { error: 'Not enough food to travel. Refill your food and try again.', statusCode: HTTP_STATUS.CONFLICT };
      if (Number(stats.current_water ?? 0) < path.costs.water_cost) return { error: 'Not enough water to travel. Refill your water and try again.', statusCode: HTTP_STATUS.CONFLICT };
      const charged = await tx.character_stats.updateMany({
        where: {
          id: stats.id,
          current_energy: { gte: path.costs.energy_cost },
          current_food: { gte: path.costs.food_cost },
          current_water: { gte: path.costs.water_cost }
        },
        data: {
          current_energy: { decrement: path.costs.energy_cost },
          current_food: { decrement: path.costs.food_cost },
          current_water: { decrement: path.costs.water_cost }
        }
      });
      if (!charged.count) {
        const latestStats = await tx.character_stats.findUnique({ where: { id: stats.id } });
        if (Number(latestStats?.current_energy ?? 0) < path.costs.energy_cost) return { error: 'Not enough energy to travel. Refill your energy and try again.', statusCode: HTTP_STATUS.CONFLICT };
        if (Number(latestStats?.current_food ?? 0) < path.costs.food_cost) return { error: 'Not enough food to travel. Refill your food and try again.', statusCode: HTTP_STATUS.CONFLICT };
        if (Number(latestStats?.current_water ?? 0) < path.costs.water_cost) return { error: 'Not enough water to travel. Refill your water and try again.', statusCode: HTTP_STATUS.CONFLICT };
        return { error: 'Your resources changed before travel could be completed. Try again.', statusCode: HTTP_STATUS.CONFLICT };
      }
      const updatedStats = await tx.character_stats.findUnique({ where: { id: stats.id } });
      await tx.characters.update({ where: { id: character.id }, data: { location_id: destinationId, sublocation_id: null } });
      const dialogue = await closeLocationDialogueSessions(character.id, null, tx, { choice: dialogueChoice, leaveLocation: true });
      const partyMove = await movePartyWithLeader(tx, character.id, { locationId: destinationId, sublocationId: null, leaveLocation: true });
      const destinationZone = await tx.locations.findUnique({ where: { id: destinationId }, select: { is_safe_zone: true } });
      if (destinationZone?.is_safe_zone) resetAmbushChance(character.id);
      await syncHungerEffects(tx, character.id, updatedStats);
      await syncThirstEffects(tx, character.id, updatedStats);
      return {
        success: true,
        message: `Traveled to ${destination.name}.`,
        dialogue,
        partyMove,
        travel: {
          location_ids: path.locationIds,
          path: path.locationIds.map((id) => graph.locations.find((location) => location.id === id)?.name || `Location #${id}`),
          costs: path.costs
        }
      };
    }, { isolationLevel: TRANSACTION_ISOLATION.READ_COMMITTED });
    if (result.error) return result;
    const { partyMove, ...body } = result;
    notifyPartyMoved(partyMove, { locationId: destinationId, sublocationId: null, message: `Your party leader led you to ${body.message.replace(/^Traveled to /, '').replace(/\.$/, '')}.` });
    return { ...body, character: await getCharacterSheet(userId) };
  } catch (error) {
    throw databaseError('travelToLocation', 'travel between locations', error);
  }
}
