# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, I have changed schema db.
Fix and adjust logics on server side (admin.html) by on new shema db.
Fix and adjust admin.html UX/UI.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Updated admin server logic for the unified `character_items` schema.
- Added `BACKPACK`, `EQUIPPED`, and `VAULT` item handling.
- Updated admin editor mapping and removed obsolete inventory/equipment fields.
- Fixed character and lifeskill deletion handling.
- Validated Prisma schema and modified JavaScript syntax.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.