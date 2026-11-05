# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Base on my currently system, schema, and phase3/plans/status_effect_combat_development.md plans and impletement the scope

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Added authoritative STUN, DAZE, WEAK, BLIND, and POISON combat rules.
- Integrated status resistance rolls, turn-start processing, damage modifiers, misses, stacking, refreshing, and initiative changes.
- Added `character_effects.applied_value` persistence and MariaDB update support.
- Loaded skill-effect relations for player and NPC combatants.
- Added combat status-effect tests; schema validation and focused regression tests pass.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.