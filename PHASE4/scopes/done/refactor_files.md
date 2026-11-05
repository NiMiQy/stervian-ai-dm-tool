# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to refactor the structure of project and code, the ./src/services and code inside is not clear.
1. services folder. -> The folder is placed correctly. 
2. components/logics folder. -> This is containt a logics for gameplay, interacting
3. components/services folder. -> I think should merge into services folder on the main ./src path
4. Move any helper code, function -> components/helpers

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- Moved database and AI DM services into `src/services`; updated gameplay imports.
- Moved MCP formatting helpers into `src/components/helpers` and updated imports.
- Verified JavaScript syntax and Prisma schema; `npm test` has no configured test suite.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.