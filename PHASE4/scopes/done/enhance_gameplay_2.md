# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, there is a hardlock if player go outside SAFEZONE without bringing enough food and water -> They cannot go back to SafeZone (not have enough food/energy/water to go back). I want to improve the gameplay to prevent this : 

Make a Campfire button on the left sidebar (This Campfire button is only showing in location or sublocation is not in SAFEZONE: 
  - Open a modal when clicked on Campfire, there is 2 options : 
    + Rest : Only restore full energy. No restore full HP.
    + Rest with tent : Restore full energy/full HP. (Require item Camping Tent)

Make a Gathering insde DANGER_ZONE gain % chance to meet monster in the area and auto enter combat. (which is Ambush Chance)
Ambush Chance=min(55%,10%+(energySpent−1)×1.125%)
Reset the Ambush Chance to 10% after an ambush combat or returned to the SafeZone. Otherwises, keep the Ambush Chance.


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- **Campfire** — `#campfireButton` (🔥) in sidebar, shown only when the location is not a safe zone. Modal: **Rest** (full energy) / **Rest with tent** (full energy + full HP, needs `Camping Tent` in backpack; tent not consumed). Server: `src/containers/campfireContainer.js`, `src/api/campfire.js` → `GET /api/campfire`, `POST /api/campfire/rest { mode: 'rest' | 'tent' }`; rejects safe zones, combat, missing tent.
- **Camping Tent** item added to DB (id 88, MISCS, buyable 120g).
- **Ambush** (`gatheringContainer.executeGather`) — outside safe zones each gather rolls `min(55%, 10% + (energySpent − 1) × 1.125%)`; on hit a random monster of the location/sublocation starts combat via `createEncounter`, client logs it and redirects to combat. Next-gather chance shown in the gathering log.
- **Ambush tracking** — server-side `character_stats.ambush_energy_spent` (free-gather procs add 0); reset to 0 on ambush and on travelling to a safe zone (`worldTravelContainer`). Constants: `AMBUSH_CHANCE`, `CAMPING_TENT_ITEM_NAME`, `CAMPFIRE_REST_MODES`.
- **Fix** — gathering timer bar fill hidden by `ux-enhancements.css` (`position: relative` on inline `<i>`); restored in `gathering.css`.
- **Not tested end-to-end**: no live campfire rest or ambush run yet; no test records inserted.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.