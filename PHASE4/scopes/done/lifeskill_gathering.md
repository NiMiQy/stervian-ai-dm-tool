# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the gathering lifeskill:
1. Modal UI for Gathering lifeskill accessible from the game client.
2. Auto-gathering system: runs every 20s per gather and consumes 1 energy per gather.
3. Gathering loot groups & drop tables:
   - Universal Common Group: Branch Tree (min 2 - max 4, 100%), Stone (min 1 - max 2, 100%), Herb (min 1 - max 2, 80%), Silver Herb (min 1 - max 2, 70%), 5-10 Gold.
   - Honeywood Village Common Group (only in Honeywood Village): Honey (1-2), Potato (1-5), Wheat (1-5), Egg (1-4).
   - Honeywood Village Rare Group (only in Honeywood Village): Cloth (1-2), Metal Scrap (1-2).
4. Black Desert Online (BDO) life skill formula:
   - Level-scaled rare group drop chance: P_rare(level) = min(45%, 5% + (level - 1) * 1.0%).
   - BDO free-gather chance (chance to not consume energy): P_free(level) = min(35%, floor(level / 5) * 3.5%).
   - Gathering EXP progression: target EXP = level * 200, awards +20 EXP per common gather (+35 bonus EXP on rare proc).
5. Gathering modal displays current Gathering rank/level/EXP, Energy status, loot groups with potential drops and chances, 20s auto progress timer, Start/Stop controls, and real-time gather log.
6. Auto-gather stops automatically when energy is depleted (< 1) or backpack inventory is full.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Implemented authoritative server gathering container (`src/containers/gatheringContainer.js`) with serializable transactions, backpack space validation, energy consumption, and conflict handling.
- Implemented Black Desert Online (BDO) life skill formulas:
  - Rare drop chance scaling: P_rare(level) = min(45%, 5% + (level - 1) * 1.0%).
  - Energy-free gather chance: P_free(level) = min(35%, floor(level / 5) * 3.5%).
  - Level progression brackets: Beginner, Apprentice, Skilled, Professional, Artisan, Master with target_exp = level * 200.
- Seeded gathering materials (Branch Tree, Stone, Herb, Silver Herb, Honey, Potato, Wheat, Egg, Cloth, Metal Scrap) and configured loot groups (Gathering - Common, Honeywood Village Gathering - Common, Honeywood Village Gathering - Rare) with min/max quantities, drop rates, and gold rewards in database and `src/prisma/seed.ts`.
- Created `GET /api/gathering` and `POST /api/gathering/gather` endpoints in `src/api/gathering.js` mounted at `/api` and guarded by session and out-of-combat checks.
- Implemented gathering modal UI in `public/game.html`, styled in `public/style/gathering.css`, displaying current Gathering rank/level/EXP, Energy status, drop tables preview, 20-second animated auto-gathering countdown, Start/Stop buttons, and real-time activity log.
- Connected client gathering controller (`public/js/containers/gatheringContainer.js`) with main HUD vitals, automated 20s gathering loop, and automatic halt on depleted energy or full backpack.
- Added unit and integration tests in `tests/gathering.test.js` validating BDO formulas, transactional execution, and complete database rollback.
- Generalized BDO Life Skill formulas across all life skills (Gathering, Cooking, Alchemy, Fishing, Foraging, Tracking) in `src/containers/core/lifeskillCore.js`, applying BDO rank titles, mastery points, free energy procs, bonus crafting yields, and level-up EXP progression to crafting recipes (`craftingContainer.js`, `crafting.js`) and character sheets (`characterContainer.js`, `gameContainer.js`). Verified with `tests/lifeskills.test.js`.
- Integrated `loot_group_rarity` enum (`COMMON`, `UNCOMMON`, `RARE`, `LEGENDARY`, `BOSS`) into loot groups drop logic, gathering container, admin CRUD dashboard, and character progression. Loot group activation probabilities scale by life skill level following BDO formulas: COMMON (100%), UNCOMMON (min(75%, 35% + (level - 1) * 0.5%)), RARE (min(45%, 5% + (level - 1) * 1.0%)), LEGENDARY (min(15%, 1% + (level - 1) * 0.2%)), and BOSS (100%).
- Implemented `locations_lootgroups` junction model in Prisma schema and database, allowing any location to be associated with specific drop pools. Updated gathering container to dynamically query place-specific loot groups, and updated admin dashboard to support associating locations with loot groups.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.