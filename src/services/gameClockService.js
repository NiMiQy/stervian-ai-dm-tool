import { GAME_CLOCK, WEBSOCKET_EVENTS } from '../configs/constants.js';
import { broadcastToAll } from './webSocketService.js';

function localCycleStart(date) {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  return start.getTime();
}

export function getGameTime(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const cycleStartMs = localCycleStart(date);
  const elapsedMs = date.getTime() - cycleStartMs;
  let slotStartOffset = 0;
  for (let index = 0; index < GAME_CLOCK.SLOTS.length; index += 1) {
    const slot = GAME_CLOCK.SLOTS[index];
    const slotEndOffset = slotStartOffset + slot.durationMs;
    if (elapsedMs < slotEndOffset || index === GAME_CLOCK.SLOTS.length - 1) {
      const nextSlot = GAME_CLOCK.SLOTS[(index + 1) % GAME_CLOCK.SLOTS.length];
      return {
        slot: slot.slot,
        label: slot.label,
        startedAt: new Date(cycleStartMs + slotStartOffset).toISOString(),
        endsAt: new Date(cycleStartMs + slotEndOffset).toISOString(),
        remainingMs: Math.max(0, cycleStartMs + slotEndOffset - date.getTime()),
        progress: Math.min(1, Math.max(0, (elapsedMs - slotStartOffset) / slot.durationMs)),
        nextSlot: nextSlot.slot,
        nextLabel: nextSlot.label,
        serverTime: date.toISOString(),
      };
    }
    slotStartOffset = slotEndOffset;
  }
  return null;
}

export function formatGameTimeForPrompt(gameTime = getGameTime()) {
  const guidance = GAME_CLOCK.PROMPT_GUIDANCE[gameTime.slot] || '';
  return [
    `### World Time: ${gameTime.label.toUpperCase()}`,
    `- It is currently ${gameTime.label.toLowerCase()} in Stervian Land. Next: ${gameTime.nextLabel.toLowerCase()}.`,
    `- Atmosphere: ${guidance}`,
    '- Narration, lighting, NPC activity and crowd levels must stay consistent with this time of day. Do not describe a different time of day unless the player explicitly waits or rests.',
  ].join('\n');
}

let clockTimer = null;
let lastBroadcastSlot = null;
const slotChangeListeners = new Set();

export function onGameTimeSlotChange(listener) {
  slotChangeListeners.add(listener);
  return () => slotChangeListeners.delete(listener);
}

export function startGameClock() {
  if (clockTimer) return stopGameClock;
  lastBroadcastSlot = getGameTime().slot;
  const scheduleNext = () => {
    const current = getGameTime();
    clockTimer = setTimeout(() => {
      const gameTime = getGameTime();
      if (gameTime.slot !== lastBroadcastSlot) {
        lastBroadcastSlot = gameTime.slot;
        broadcastToAll(WEBSOCKET_EVENTS.WORLD_TIME_CHANGED, gameTime);
        for (const listener of slotChangeListeners) {
          Promise.resolve().then(() => listener(gameTime)).catch((error) => console.warn('[startGameClock] Slot change listener failed:', error.message));
        }
      }
      scheduleNext();
    }, current.remainingMs + GAME_CLOCK.BROADCAST_GRACE_MS);
    clockTimer.unref?.();
  };
  scheduleNext();
  return stopGameClock;
}

export function stopGameClock() {
  if (clockTimer) clearTimeout(clockTimer);
  clockTimer = null;
}
