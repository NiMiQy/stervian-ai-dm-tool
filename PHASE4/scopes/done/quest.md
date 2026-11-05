# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the quest system:
1. A quest has one objective saved directly on the quest record.
2. Characters can obtain quests from a Guild Office or an individual NPC such as Guaz or Zanla, the inn keeper.
3. Players can accept up to five quests.
4. Show the sidebar "Quests" button only when a player is in a location or sublocation with NPCs who have quests.
5. Quests do not have quest chains.
6. Quest objective types are [COLLECT/ELIMINATE/CAPTURE].
7. Completing some NPC quests increases affinity with that NPC.
8. Some quests can only be completed once and others can be repeated.
9. Add sublocation name : "Guild Office" in Honeywood. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Quests support one `COLLECT`, `ELIMINATE`, or `CAPTURE` objective, repeatability, rewards, and NPC affinity.
- Server logic handles local offers, acceptance (up to five active quests), objective progress, and turn-ins.
- Quest definitions and character progress use separate Prisma model files; `npm run migrate:quests` applies the schema.
- The Quests sidebar is location-aware. Honeywood has a Guild Office and Registrar; quests are not seeded.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.