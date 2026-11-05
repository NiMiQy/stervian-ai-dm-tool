# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about PHASE2 BATTLE RESULT and LOOT SYSTEM. 

Find a loot drop plan in PHASE2/plans/PLANS.MD and PHASE2/plans/LOOT_DROP and phase2/plans/battleresult.md for the current stage information.

Schema : PRISMA.MD file - Structure

## Scope
Implementing Features:
1. Battle Results :
    - Show the items drop.
    - Show the gold drop.
    - Show EXP earned.
2. Dead Penalty :
    - If player defeated by monster. Respawn at respawn_location_id. Lose all their equipments and items in inventory.


## WANT TO ARCHIVE:
- Worked battle rewards system
- Dead penalty system.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented
- Battle Results:
    - Included monster loot group definitions and items in `findMonsterByName`.
    - Implemented server-side drop rolling engine `rollLootForBattle` evaluating gold bounds and percentage item drop chances.
    - Implemented `applyLootRewards` to increment player gold and add dropped items into `item_inventory` with stack limits (`max_stack`) and backpack slot capacity (`max_slots`) checks.
    - Attached victory progression, EXP calculation (`calculateExpReward` and `applyLevelRewards`), gold rewards, and item drops to `resolvePlayerVictory` and `finalizeBattle`.
    - Updated client result modal in `game.html` and `battleContainer.js` to render EXP earned, gold drop, level-up milestones, and item drop badges with inventory overflow warnings.
- Death Penalty:
    - Implemented authoritative `resolvePlayerDefeat` transactional mutation:
        - Wipes all player backpack items from `item_inventory` (preserving NPC companion items).
        - Resets all 12 equipment slot foreign keys in `character_equipments` to `null`.
        - Keeps player current stats (`character_stats`) and spell points (`character_spellpoints`) intact.
        - Wipes player carried gold (`players.gold = 0`).
        - Relocates player to saved `respawn_location_id` (fallback to location 1 / Honeywood Village) and clears `sublocation_id`.
    - Added death penalty presentation overlay in `battleContainer.js` detailing lost backpack items, lost equipped gear count, and respawn location with "Respawn in Town →" prompt.
- Verified Prisma schema validation, JavaScript syntax, and end-to-end combat resolution for both victory rewards and death penalty flows.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.