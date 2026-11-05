# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to enhance the system:
1. Time day to night.

Time day to night, in-game simulator clock:
 I make a clock day/night in server but emulator 1h = 1d. 
60% morning (40% morning, 20% afternoon) ,  40% night (18% evening, 22% night)

MORNING: 40% - 24 min	
AFTERNOON: 20% - 12 min	
EVENING: 18% - 10.8 min
NIGHT: 22%- 13.2 min

Following start from the real time 00:00am. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

### 1. Day/night game clock (1 real hour = 1 game day)
- Stateless: derived from server local time, every real hour starts at MORNING.
  - `:00:00–:24:00` MORNING (40%) · `:24:00–:36:00` AFTERNOON (20%) · `:36:00–:46:48` EVENING (18%) · `:46:48–:60:00` NIGHT (22%).
  - No day counter, no DB table.
- `src/configs/constants.js`: `GAME_TIME_SLOT`, `GAME_CLOCK` (slot durations, prompt guidance), `WEBSOCKET_EVENTS.WORLD_TIME_CHANGED = 'world:time_changed'`.
- `src/services/gameClockService.js`: `getGameTime()`, `formatGameTimeForPrompt()`, `startGameClock()` / `stopGameClock()`.
- `src/services/webSocketService.js`: `broadcastToAll(type, data)`.
- `src/server.js`: starts the clock after the WebSocket server. It broadcasts `world:time_changed` to every connected socket at each slot change.
- `GET /api/world/time` (`src/api/world.js`, session required) returns:
  - `slot`, `label`
  - `startedAt`, `endsAt`, `remainingMs`, `progress`
  - `nextSlot`, `nextLabel`
  - `serverTime`
- AI DM: `buildDungeonMasterPromptSegments` adds a `### World Time` section after the location section.
- Client:
  - `#worldTimeClock` span in `.sidebar-bottom` next to gold, with no new styles. It shows e.g. `🌆 Evening · 7:12` (countdown to the next slot).
  - The clock syncs from the API using a server-offset correction and updates on the WebSocket event. It re-fetches when the countdown reaches 0.
- Test: `node tests/gameClockTest.js` (pure clock math, no DB records).
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.