# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about SHOP functionals, and CHARACTER functionals. 

Schema : PRISMA.MD file - Structure

## Scope
- Currently, INN and SHOP is a shop. Enchance the shop system:
1. Items in shop is selling at 100% price.
2. Player could choice item quantity number to buy
3. Player could choice item quantity number to sell
4. Player's items are only selling for 70% price.

- Make a INN button will appear in game.html on client side at the sidebar when player in sublocation is INN -> when open INN modal, a button that "Take a long rest" to restore full HP and energy. And a button "SHOP" for buying/selling stuff. 

- In Character stats table:
  1. Add columns: max_food, current_food, max_water, current_water.

- In effects table:
  1. Add records : "Hungry", "Starving" , "Starvation"
  2. Add records : "Thirsty", "Dehydrated" , "Severe_dehydration"

- Make a character will get debuff effect when :
  1. If character's current_food <= 75% ->  Character get "Hungry" effects will loss their 15% damage (even phys, magical)
  2. If character's current_food <= 50% -> Character get "Starving" effects will loss their 30% damage (even phys, magical)
  3. If character's current_food <= 25% -> Character get "Starvation" effects will loss their 60% of damage deal (even phys, magical)

- Make a character will get debuff effect when :
  1. If character's current_water <= 75% -> Character get "Thirsty" effects will increase their skills Energy Cost using by 10% 
  2. If character's current_water <= 50% -> Character get "Dehydrated" effects will increase their skills Energy Cost using by 20% 
  3. If character's current_water <= 25% -> Character get "Severe_dehydration" effects will increase their skills Energy Cost using by 40% 

- In game.html, display water, food information in .vitals section and character sheet section. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Shop purchases use 100% price; players select buy quantity with a total-price preview.
- Players sell selected inventory quantities for 70% of base price, rounded down per item. Equipped items cannot be sold.
- Inn sidebar/modal supports free long rest for full HP and energy, plus access to the shop. Rest is blocked during battle.
- Character stats include food/water current and maximum values, defaulting to 100. Fields appear in the game UI and admin character/NPC editor.
- Hungry, Starving, and Starvation apply the strongest 15%/30%/60% damage penalty at 75%/50%/25% food.
- Thirsty, Dehydrated, and Severe_dehydration apply the strongest 10%/20%/40% energy-cost increase at 75%/50%/25% water, rounded up.
- Food and water deplete only while connected at 100 points per 75 minutes. The server persists depletion every 4 minutes, and the client refreshes values every 75 seconds.
- Server-side validation, transactional persistence, schema updates, and 47 automated tests pass. Authenticated browser verification remains pending.

## Previously recorded implementation (NPC combat)

- Shared Aggressive/Cautious/Desperate template with the planned action weights, strict HP thresholds, two-turn caution refresh, and no consecutive defense.
- NPC skills consume no energy or spell slots. Desperate selection estimates damage after mitigation, including expected critical damage.
- Basic Strike fallback and a default Defend that doubles physical/magic armor when no effective defense skill exists. Defense expires at the defender's next turn.
- Existing single-target selection retained. Group-target and healing skills are excluded until their effects are supported by the NPC resolver.
- State changes and actions appear in battle logs; no client layout or schema changes.
- Verification: `node --test tests/npcCombat.test.js` (7 passing checks; 20 consecutive runs passed), JavaScript syntax checks, and Prisma validation passed. Tests isolate the real battle functions from database access.
- Corrected test-only random injection so NPC decisions and damage use the controlled test source. Production randomness is unchanged.
- Distribution checks cover 40,000 decisions across the three states and the post-defense restriction; the agreed weights are unchanged.
- Live authenticated browser verification passed using MCP `publish_encounter` with Wolf after restarting the local server to load the implementation.
- Observed: 15/65 HP loss triggered Cautious; Defend reduced the next Strike from 15 to 13 damage; the following NPC turn attacked; at 7/65 HP the Wolf entered Desperate and used Bite.
- Completed the battle through the UI. Victory displayed and saved 180 EXP, 241 gold, and one Wolf Skin; player finished at 7/53 HP. Automated checks cover the other state and probability cases.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
