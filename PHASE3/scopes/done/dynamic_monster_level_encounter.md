# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, make dynamic monster level, stats in encounter:
- According to plan phase3/plans/dynamic_monster_level_encounter.md and implement the scope.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented
- **Dynamic Encounter Scaling (`scaleMonsterInstance`)**:
  - Clones monster templates dynamically in-memory without mutating MySQL records.
  - Scales monster level up to player level (max 10), allowing players to encounter higher level variations (such as a Level 10 Rabbit).
  - Preserves clean original monster names without dynamic prefixes (e.g. "Rabbit" remains "Rabbit").
  - Dynamically scales attributes for level increases ($\Delta\text{Level} = \text{currentLevel} - \text{baseLevel}$): `strength` ($+2 \times \Delta\text{Level}$), `constitution` ($+1 \times \Delta\text{Level}$), `dexterity` ($+1 \times \Delta\text{Level}$).
  - Automatically recalculates `max_hp` and `current_hp` ($+4\text{ HP} \times \Delta\text{Level}$) and derived stats (`atkDamage`, `armor`, initiative).
- **Combatant & Battle Engine Integration (`makeBattle`, `createEncounter`)**:
  - Integrates `scaleMonsterInstance` within `makeBattle()` before combatants are registered.
  - Passes `templateBaseLevel` through `combatant` units.
  - Updated encounter log to announce monster names, dynamic levels, and initiative order.
- **Additive Anti-Exploit EXP Formula (`calculateExpReward`)**:
  - Balanced additive progression in `src/services/progressionService.js`:
    $$\text{ExpReward} = \lfloor \text{baseExp} \times (1 + 0.15 \times (\text{currentLevel} - \text{templateBaseLevel})) \times \text{multiplier} \rfloor$$
  - Prevented floating point precision artifacts using precision-safe rounding. Low-tier mobs yield minimal EXP even at high levels (e.g. Level 10 Rabbit yields ~47 EXP), naturally encouraging players to progress to higher-tier foes.
- **Unscaled Base Gold Rewards (`rollLootForBattle`)**:
  - Monster gold rewards are unscaled, remaining tied to the base mob's loot group table. Low-tier monsters do not grant elevated gold regardless of level.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.