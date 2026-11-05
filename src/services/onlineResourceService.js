import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { syncHungerEffects, syncThirstEffects } from './effectServices.js';
import { RESOURCE_DEPLETION_MS, RESOURCE_PERSIST_MS } from '../configs/constants.js';

export { RESOURCE_DEPLETION_MS, RESOURCE_PERSIST_MS };

const trackers = new Map();

export function depletionAmount(maxValue, elapsedMs) {
  const max = Math.max(0, Number(maxValue) || 0);
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  return max * elapsed / RESOURCE_DEPLETION_MS;
}

export function getOnlineTracker(userId) {
  return trackers.get(userId) || null;
}

export function markPlayerOnline(userId) {
  if (!userId) return () => {};
  let tracker = trackers.get(userId);
  if (!tracker) {
    tracker = { connections: 0, lastAt: Date.now(), elapsedCarry: 0, flushing: false, timer: null };
    tracker.timer = setInterval(() => {
      flushPlayerResources(userId).catch((error) => {
        console.error('Error persisting online player resources:', error);
      });
    }, RESOURCE_PERSIST_MS);
    tracker.timer.unref?.();
    trackers.set(userId, tracker);
  }
  tracker.connections += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    tracker.connections = Math.max(0, tracker.connections - 1);
    if (tracker.connections > 0) return;
    clearInterval(tracker.timer);
    flushPlayerResources(userId).catch((error) => {
      console.error('Error flushing player resources on disconnect:', error);
    }).finally(() => {
      if (tracker.connections === 0) {
        trackers.delete(userId);
      }
    });
  };
}

export function onlineTrackerCount() {
  return trackers.size;
}

export async function lazyDepletePlayerResources(userId, tx = null) {
  if (!userId) return null;
  const tracker = trackers.get(userId);
  const now = Date.now();

  if (tracker) {
    const elapsed = Math.max(0, now - tracker.lastAt);
    tracker.lastAt = now;
    tracker.elapsedCarry += elapsed;
  }

  const execute = async (client) => {
    const character = await client.characters.findUnique({
      where: { user_id: userId },
      include: { character_stat: true }
    });
    const stats = character?.character_stat;
    if (!character || character.deleted || !stats || stats.deleted) return null;

    let foodDepletion = 0;
    let waterDepletion = 0;
    let consumedMs = 0;

    if (tracker && tracker.elapsedCarry > 0) {
      const foodUnits = Math.min(Math.max(0, Math.floor(depletionAmount(stats.max_food, tracker.elapsedCarry))), Math.max(0, stats.current_food ?? 0));
      const waterUnits = Math.min(Math.max(0, Math.floor(depletionAmount(stats.max_water, tracker.elapsedCarry))), Math.max(0, stats.current_water ?? 0));

      if (foodUnits > 0 || waterUnits > 0) {
        foodDepletion = foodUnits;
        waterDepletion = waterUnits;

        if (foodUnits > 0 && stats.max_food > 0) {
          consumedMs = Math.max(consumedMs, Math.floor(foodUnits * RESOURCE_DEPLETION_MS / stats.max_food));
        }
        if (waterUnits > 0 && stats.max_water > 0) {
          consumedMs = Math.max(consumedMs, Math.floor(waterUnits * RESOURCE_DEPLETION_MS / stats.max_water));
        }
        tracker.elapsedCarry = Math.max(0, tracker.elapsedCarry - consumedMs);
      } else if ((stats.current_food ?? 0) <= 0 && (stats.current_water ?? 0) <= 0) {
        tracker.elapsedCarry = 0;
      }
    }

    let updatedStats = stats;
    if (foodDepletion > 0 || waterDepletion > 0) {
      updatedStats = await client.character_stats.update({
        where: { id: stats.id },
        data: {
          ...(foodDepletion ? { current_food: { decrement: foodDepletion } } : {}),
          ...(waterDepletion ? { current_water: { decrement: waterDepletion } } : {})
        }
      });
    }

    await syncHungerEffects(client, character.id, updatedStats);
    await syncThirstEffects(client, character.id, updatedStats);

    return updatedStats;
  };

  try {
    if (tx) {
      return await execute(tx);
    }
    return await prisma.$transaction(async (innerTx) => {
      return await execute(innerTx);
    });
  } catch (error) {
    throw databaseError('lazyDepletePlayerResources', 'deplete online food and water', error);
  }
}

export async function flushPlayerResources(userId) {
  const tracker = trackers.get(userId);
  if (!tracker || tracker.flushing) return false;
  tracker.flushing = true;
  try {
    await lazyDepletePlayerResources(userId);
    return true;
  } finally {
    tracker.flushing = false;
  }
}
