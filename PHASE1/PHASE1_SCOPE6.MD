# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server owns stat calculations and battle-card seed data. The browser requests the server result and renders it without submitting derived values.

## Scope
Currently, in server game, and mcp server :
- Mcp server publish_encounter is only handle 1 enemy spawn:
  1. Make multiple enemies spawn to encounter. (For example: MCP client request a story "Two rabbits suddenly jump out of the bush, player prepare to fight!". Then the server game start logic for multiple enemies encounter). Note :  the client side (UI/UX) is actually already prepared to render multiple enemies!
- Validation publish_encounter maximum enemies spawn is 5.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- MCP Server publish_encounter worked and handled multiple enemies spawn.
- Validation for maximum enemies spawn is 5.

## Implemented

- `publish_encounter` supports encounters with 1–5 enemies.
- Added server validation enforcing the 5-enemy maximum.
- Added multi-enemy battle creation, targeting, and initiative support.
- Preserved backward compatibility for single-enemy encounters.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.