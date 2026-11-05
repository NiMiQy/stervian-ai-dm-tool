# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope

Build an aggro system for battle combat.
Read phase3/plans/aggro_system.md

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Added server-authoritative per-enemy threat tables with actual-damage accounting, first-strike bonus, skill aggro multipliers, predator targeting, and defeated-member cleanup.
- Added five-round Taunt locks with dominance-based multi-taunter resolution and persistence through the existing combat snapshot.
- Added NPC aggro targeting and TANK Taunt selection without granting artificial threat from tactics roles.
- Added the `aggro_multiplier` skill field, Taunt/Heavy Strike/Shield Slam seed data, and an idempotent MariaDB update script.
- Added focused aggro regression tests; Prisma validation, client generation, TypeScript checking, and modified JavaScript syntax checks pass.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.