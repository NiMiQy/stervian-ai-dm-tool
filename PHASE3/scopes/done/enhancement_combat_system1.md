# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, the game doesn't have logic to use item in battle:
- Implement logics to use item in combat:
    1. Character uses 1 item in combat by using this turn. 
- Implement logics for persistence and complete prevent players from dodging or resetting combat by closing the modal or refreshing the browser. Following phase3/plans/persistence_combat.md document.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Added server-authoritative consumable use during combat; each item consumes one player turn.
- Added persistent combat sessions with reload/server-restart recovery and encounter overwrite protection.
- Added combat locks for movement, inventory, equipment, shops, vault, stats, and resting.
- Added server-side flee resolution with success/failure handling.
- Added active battle rehydration and modal dismissal protection on the client.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.