# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server owns stat calculations and battle-card seed data. The browser requests the server result and renders it without submitting derived values.

## Scope

- Base on #####Derived stats, ##### Initiative Roll and SUGGEST_PHASE1_SCOPE2.MD file, implement battle system core logic on server side (dmg, armor, etc ... calculation , and turn handle on server side).
- Move all encounter/battle mockup data into using the battle system core logics.
- After implement battle system core, implement a log for a battle (tracking logs) : BEST IS USING console.log() for console monitor, easy way, no need complicated function.

#### Solution

##### Primary stats and proficiency

- Base character creation values are `5` for `CON`, `STR`, `DEX`, `INT`, `WIS`, and `CHAR`.
- Base proficiency is `2`; each level-up adds one proficiency point (for example, level 1 = 2 and level 2 = 3).
- Equipment bonuses are added on the server before derived values are calculated.
- The server never trusts browser-provided `left_point_spend`, derived stats, or calculated resource totals.

##### Spent-point cost

- Character creation starts with a 45-point budget.
- The next point cost is `1 + floor((currentStat - 5) / 5)`.
- Spending is atomic and authoritative:

  `remainingPoints = initialBudget + earnedPoints - totalSpentCost`

##### Derived stats

- `physicalPower = STR + 0.5 × DEX + 0.5 × proficiency`
- `magicPower = INT + 0.5 × WIS + 0.5 × CHAR + 0.5 × proficiency`
- `spellAmp = min(50%, 0.5% × max(0, INT - 5))`
- `maxHP = floor(10 + proficiency + 2 × CON + STR + 0.5 × DEX)`
- `armor = floor(5 + (DEX - 5) + equipmentArmorBonus)`
- `magicArmor = floor(5 + equipmentMagicArmorBonus)`
- Each elemental resistance is `floor(5 + (WIS - 5) + equipmentResistanceBonus)`.
- `statusResist = floor(5 + 0.5 × (STR - 5) + (CON - 5) + equipmentStatusResistanceBonus)`
- `convinceChance = clamp(5%, 95%, 15% + 1.5% × (CHAR - targetResolve))`

##### Initiative Roll: (first turn decision)

- The server calculates initiative at encounter creation using `IR = round(10 + DEX + (Level / 5))`.
- The client only displays the returned initiative values and queue; it does not calculate the initial battle-card data.

## IMPORTANT:
- Do not change inrelavent files. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- Worked battle system core logics. 
- Mockup data now to dynamic data.
- Log tracking (show on console)

## Implemented

- Server-authoritative battle core moved to `src/containers/core/battleSystemCore.js`.
- Derived stats, initiative, damage, armor, resistances, resources, turns, and DEFEND effects are calculated on the server.
- Encounter monsters and usable skills are loaded from the database; Rabbit is supported dynamically.
- MCP now publishes database-validated encounters through `publish_encounter`.
- The game client renders server battle results and submits only action identifiers.
- Battle actions are logged with `console.log()`.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
