# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, enhance UI/UX.
  


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Restyled `combat.html` to match the battle reference, with responsive party, arena, action, and battle-log panels.
- Added a dedicated Magic Attack action for `MAGIC_ATTACK` skills; enemy quotes now show the selected enemy’s name.
- Removed stage/wave labels, the dock toggle, System tab, and topbar character profiles.
- Updated the `game.html` and `combat.html` brand to Stervian — Chapter I: “A fallen son.”

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.