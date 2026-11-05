# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, I have changed schema db. Adjust some logics in admin.html.
- Check and fix logics for all tab in admin.html
- Additional adding relationship for npc (only npc, no monster), player, and npc knownledge 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Updated all admin dashboard tab logic for the current Prisma schema.
- Added player–NPC relationships, NPC–NPC relationships, NPC knowledge, and NPC presence management.
- Excluded monsters from NPC relationship selections while preserving the existing layout and style.
- Added server-side validation, synchronization, and soft-delete handling for these relations.
- Verified JavaScript syntax, Prisma schema validation, and dashboard data loading.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.