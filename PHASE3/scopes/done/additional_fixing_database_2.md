# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, I have changed schema db.
Fix and adjust logics on game side (client.html).
Fix and adjust client.html UX/UI.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Migrated game logic to the unified `character_items` schema.
- Updated character creation, inventory, equipment, consumables, shops, vaults, loot, and defeat handling.
- Updated the game client to render canonical character items without changing the existing layout or styles.
- Added server-side equipment validation, stacking rules, slot limits, and derived-stat recalculation.
- Validated Prisma schema, regenerated the client, and smoke-tested the main game flows.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.