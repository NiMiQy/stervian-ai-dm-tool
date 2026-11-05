# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the admin management Quests tab. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Added a **Quests** tab to the admin dashboard (`public/js/admin.js`) listing active quests with giver, objective, target and required quantity, gold and affinity rewards, repeat mode, and active run count. Columns are sortable. The list can be searched by name, ID, giver or target, and filtered by objective type, quest giver and repeat mode.
- Added a quest editor modal (reusing existing admin modal classes, no style changes) for name, quest giver NPC, objective type, description, target item (COLLECT) or target NPC/monster (ELIMINATE/CAPTURE), required quantity, gold reward, affinity reward and repeatable.
- Added server CRUD for `quests` in `src/containers/adminContainer.js`. Quests load with the dashboard. Create and update check that the giver and target NPCs are active NPCs, the target item is active, the objective has the matching target (the other target is cleared), quantity is at least 1, gold is not negative, affinity is clamped to the affinity range, and the name is unique per NPC. Delete soft-deletes the quest and marks its ACTIVE character runs FAILED, so they stop counting toward the five-quest limit.
- Registered `quests` in `ADMIN_MODELS`. Admin access rules are unchanged.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.