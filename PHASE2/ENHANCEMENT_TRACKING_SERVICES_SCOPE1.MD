# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about server handle services.

Schema : PRISMA.MD file - Structure

## Scope
- Currently , my game has system food and water, that will refresh and check status of player for each  75 seconds

I would like to use  Lazy / Timestamp-Based Calculation (Game Industry Standard) solution to enhance the system of tracking food and water.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented
- **Eliminated Active Server Background Timers**: Removed per-user `setInterval` timers from `src/services/onlineResourceService.js`, reducing background server timer count to zero.
- **Lazy / Timestamp-Based Calculation**: Implemented `lazyDepletePlayerResources(userId)` in `onlineResourceService.js` that tracks online player session timestamps (`lastAt`, `elapsedCarry`) on-demand without periodic event-loop polling.
- **Accurate Resource Carry-over**: Computes depletion using linear proportion over `RESOURCE_DEPLETION_MS` (120 minutes total depletion). Consumed time is deducted while leftover milliseconds carry over to guarantee exact depletion over time without drift.
- **Clean Disconnect Handling**: Implemented `flushPlayerResources(userId)` to persist any remaining accumulated elapsed time when the player closes all active WebSocket connections before removing the tracker.
- **In-Memory Effect Definitions Cache**: Cached static definitions from the `effects` table in `hungerService.js` and `thirstService.js` (`getHungerEffectDefinitions`, `getThirstEffectDefinitions`) to eliminate redundant `effects.findMany` queries.
- **No-Op DB Mutation Guards**: `syncHungerEffects` and `syncThirstEffects` compare active effects against `character_effects` and skip database mutations when status tiers haven't changed.
- **Removed Serializable Lock Contention**: Standardized transaction isolation in `onlineResourceService.js` and `hungerService.js`, eliminating serialization deadlocks and connection pool bottlenecks under 200–300+ players.
- **Seamless Integration with Existing Client**: Authoritative server depletion integrates with the client's existing 75-second refresh interval (`resourceRefreshTimer` in `public/js/containers/gameContainer.js`) and combat turn checks without requiring any client UI or layout changes.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.