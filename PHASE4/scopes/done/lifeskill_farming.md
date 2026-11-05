# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
I'm currently want to implement FARMING lifskill : 
- Similar to Gathering.
- It's auto Farming, but timing depend on seeds. 

For example : Wheat will need 1minutes per seed that will gain (5-15 wheat)
Potato will need 2 minutes per seed that will gain (5-8 potato)
... and more

- The player have to buy seed and choice seed for farming on the modal farming screen. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Extended `crafting_recipes` with `duration_seconds` and `max_output_quantity` to support crop growth timers and yield ranges.
- Registered `Farming` life skill and seeded seed items (`Wheat Seed`, `Potato Seed`, `Carrot Seed`), crops (`Wheat`, `Potato`, `Carrot`), and crop cultivation recipes (`Wheat`: 60s / 5–15 yield, `Potato`: 120s / 5–8 yield, `Carrot`: 90s / 6–12 yield) in database and `src/prisma/seed.ts`.
- Implemented authoritative server farming container (`src/containers/farmingContainer.js`) with serializable transactions, inventory space checks, seed consumption, energy deductions, BDO free energy / bonus yield calculations, and Farming EXP progression.
- Created `GET /api/farming`, `POST /api/farming/farm`, and `POST /api/farming/buy-seeds` endpoints in `src/api/farming.js` mounted at `/api` and guarded by session and out-of-combat checks.
- Implemented Farming modal in `public/game.html` and `public/style/farming.css` with rank/EXP tracker, crop recipe selector showing owned seed counts, quick-buy buttons, dynamic growth timer bar, and activity log.
- Connected client controller (`public/js/containers/farmingContainer.js`) with HUD vitals, automated farming loop with dynamic seed intervals, and automatic halt on zero seeds, full backpack, or exhausted energy.
- Verified with integration tests in `tests/farming.test.js` validating purchasing, seed consumption, yield ranges, EXP progression, and clean database rollback.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.