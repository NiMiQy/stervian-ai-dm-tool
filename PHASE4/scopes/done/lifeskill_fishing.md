# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the fishing lifeskill:
1. Modal UI for Gathering lifeskill accessible from the game client.
2. Auto-fishing system: runs every 20s per fishing and consumes 1 energy per gather.
3. Auto-fishing stops automatically when energy is depleted (< 1) or backpack inventory is full.

4. Add:
- Items - Consumable, Materials : Carp, Catfish, Eel, Grass Carp, Chub
- Recipes :
Processing:
1 x Any fish -> 1x Prepared Fish Meat 

Cooking:
2x Prepared Fish Meat + 2 salt + 2 cooking oil -> 1-4 Grilled Fish Meat (+10 food, -3 water, +5 HP)
2 x Any fish -> 1-4 Drying fish (+10 food, -8 water, +2 HP)

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Generalized the authoritative gathering engine in `src/containers/gatheringContainer.js` into a profile-driven harvester (`getHarvestData` / `executeHarvest`) shared by Gathering and Fishing: serializable transactions, energy consumption, BDO free-energy chance, level-scaled loot group chances, backpack space validation, life skill EXP, and ambush rules. Gathering behaviour is unchanged except that it now ignores fishing loot groups.
- Fishing loot groups are identified by a name ending in `Fishing` (`FISHING_LOOT_GROUP_SUFFIX`); gathering excludes them and fishing only uses them. Fishing is rejected with "There is no fishing spot in this area." when the current location has no linked fishing loot group, so no energy is consumed at dry locations.
- Added `src/containers/fishingContainer.js` (Fishing profile, `FishingRuleError` / `FishingConflictError`) and `GET /api/fishing`, `POST /api/fishing/fish` in `src/api/fishing.js`, guarded by session and out-of-combat checks. Fishing costs 1 energy per cast and awards +20 EXP (+35 on a rare proc), matching gathering.
- Added the Fishing modal to `public/game.html` (reusing the existing gathering modal classes, no style changes) with a Fishing button in the Activities nav, and `public/js/containers/fishingContainer.js` running the 20s auto-fishing loop, which stops automatically when energy drops below 1, the backpack is full, or an ambush starts. The Fishing row in the life skill list also opens the modal.
- Added items: Carp, Catfish, Eel, Grass Carp, Chub (type `FISH`, consumable + material, raw: +4 Food, -4 Water, -3 HP), Prepared Fish Meat (material), Grilled Fish Meat (+10 Food, -3 Water, +5 HP) and Drying Fish (+10 Food, -8 Water, +2 HP).
- Added loot groups linked to Honeywood Village: Honeywood Stream Fishing (COMMON, 100%: Chub 45% 1-2, Carp 40%, Grass Carp 30%) and Honeywood Stream Uncommon Fishing (UNCOMMON, 35% base: Catfish 60%, Eel 40%).
- Added recipes: Processing `Prepared Fish Meat (<fish>)` 1x fish -> 1x Prepared Fish Meat for each fish; Cooking `Grilled Fish Meat` 2x Prepared Fish Meat + 2x Salt + 2x Cooking Oil -> 1-4; Cooking `Drying Fish (<fish>)` 2x fish -> 1-4 for each fish.
- Data seeded in the database and reproducible through `npm run migrate:fishing` (`src/prisma/updates/addFishingSystem.js`).

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.