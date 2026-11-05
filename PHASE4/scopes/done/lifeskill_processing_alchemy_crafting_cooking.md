# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the lifeskills processing/crafting/alchemy/cooking:
1. They are using recipe to make an output item. -> So they are the same way but different require item.
2. Default 30s 
3. Base on Black Desert Online system exists in project. Make a higher level lifeskill = more % to proceed maximum quantity. 
4. 10 EXP for Tier 1 materials, 25 exp for Tier 2 materials , 50 exp for Tier 3 materials. 
5. Make a mass process system : maximum 50. (For example: 4 wheat (Tier 1) -> 1-4 dough, the player could choice mass proceed 50 as once time = require 150 wheat). Unlock this system by reach to Master level. (Total exp = 10x50)
6. Add items, recipes to Database:
- Items:   (all default Tier 1)
+ Materials : dough, Refined Metal, Mineral Water, Leavening Agent, Sugar, Salt, Cooking Oil
+ Consumable : Beer (+5 hunger, +15 Thrist), Prepared Meat (+3 hunger, -5 thrist, -2 current HP), Grilled Meat (+15 hunger, -5 thrist, +2 current HP).

Processing:
- Recipe: 4 Wheat -> 1-4 dough
- Recipe: 4 potato -> 1-6 dough
- Recipe: 3 Metal scrap -> 1 Refined Metal
- Recipe: 1 Raw Meat -> 1 Prepard Meat.

Crafting:
- Recipe: 1 Cloth + 1 Bottled Water -> 1 bandage.

Cooking:
- Recipe: 6 dough -> 1-2 bread.
- Recipe: 3 Wheat + 2 Mineral Water + 4 Leavening Agent + 2 sugar -> 1-4 beer.
- Recipe: 4 prepared meat + 2 Salt + 2 Cooking Oil -> 1-4 Grilled Meat.

Alchemy: 
- Recipe: 2 Herb + 1 bottled of water -> 1 Small HP potion.
- Recipe: 4 Herb + 1 bottled of water -> 1 Medium HP potion.
- Recipe: 1 Silver Herb + 1 bottled of water -> 1 Antidote

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- **Recipes/items** — `src/prisma/updates/addLifeskillRecipes.js` (`npm run migrate:lifeskill-recipes`, idempotent): 10 new items (Dough, Refined Metal, Mineral Water, Leavening Agent, Sugar, Salt, Cooking Oil, Beer, Prepared Meat, Grilled Meat; basic ingredients buyable) and 11 recipes. All Tier 1, required Lv 1, 1 energy, 30s, 10 EXP. Verified in DB.
- **Constants** (`configs/constants.js`): `LIFESKILL_RECIPE_DURATION_SECONDS=30`, `LIFESKILL_RECIPE_ENERGY_COST=1`, `LIFESKILL_TIER_EXP` (10/25/50), `MASS_PROCESS_MAX_QUANTITY=50`, `MASS_PROCESS_UNLOCK_LEVEL=51`, `LIFESKILL_FORMULAS.MAX_YIELD_CHANCE` (10% + 1%/Lv, cap 80%).
- **Tier EXP** — stored per recipe in `exp_reward` (no `items.tier` column); EXP granted per successful cycle.
- **Max-yield roll** (`lifeskillCore.rollRecipeOutputQuantity`) — higher level = higher chance of max output; otherwise random in remaining range.
- **Mass process** (`craftingContainer.craftRecipe(userId, recipeId, quantity)`) — 1–50 cycles in one transaction, Master rank (Lv 51+) only; materials/energy × quantity; each cycle rolls success, max yield, bonus yield, free energy. API: `POST /api/crafting/:id/craft { quantity }`.
- **Life skill rows** — created at Lv 1 on first craft of a Lv 1 recipe.
- **Crafting page** — Lifeskills tabs (Crafting/Cooking/Alchemy/Processing) filter by required skill; 30s progress before the request (leaving the page cancels); output range + max-yield %; mass-process input for Master; Continuous button (repeats cycles until Stop, out of materials/energy, or error); energy meter with crafts-remaining hint.
- **Not tested end-to-end**: no real craft/mass-process/continuous run against the server yet; no test records inserted.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.