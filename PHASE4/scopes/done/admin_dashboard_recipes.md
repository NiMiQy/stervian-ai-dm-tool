# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the admin management Recipes tab. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Added a **Recipes** tab to the admin dashboard (`public/js/admin.js`) listing every active crafting/farming recipe with life skill, output (min–max quantity), ingredients, required level, energy cost, duration and EXP. Columns are sortable; the list can be searched by name, ID, output or ingredient and filtered by life skill.
- Added a recipe editor modal (reusing the existing admin modal and Loot Group row classes, no style changes) for name, description, life skill, output item, min/max output quantity, required level, EXP reward, energy cost, duration, success rate and auto-unlock, plus an ingredient list with add/remove rows (item + quantity).
- Added server CRUD for `crafting_recipes` in `src/containers/adminContainer.js`: recipes load with the dashboard; create and update validate input (name and output item required, max output >= min output, success rate clamped to 0–1, non-negative costs) and replace the recipe's ingredients in the same transaction (duplicate ingredient rows are merged); delete soft-deletes the recipe so crafting and farming stop offering it.
- Registered `crafting_recipes` in `ADMIN_MODELS` so the admin API accepts it. Admin access rules are unchanged.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.