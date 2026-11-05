# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to refactor server.js on server side:
Create an api folder name similar for api call. Then move the code into the file named base on the api action. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- Split API routes into `src/api` modules and kept `src/server.js` focused on app setup and startup.
- Organized AI harness, NPC subagents, lifecycle hooks, and prompts under `src/services/ai`; retained compatibility re-exports.
- Moved shop and vault logic into `src/containers` and updated the inventory API.
- Syntax and relative-import checks passed.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.