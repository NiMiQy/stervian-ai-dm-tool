# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about PHASE2 LOOT DROP. 

Find a loot drop plan in PHASE2_PLANS.MD and PHASE2_PLAN_LOOT_DROP for the current stage information.

Schema : PRISMA.MD file - Structure

## Scope
I have updated a db schema. Following the updated. I want to enhancement admin.html component:
- Add a tab for CRUD functional for loot groups. 
- Created loot group could select items add to the group. 
- Created loot group could select enemies add to the group.


## WANT TO ARCHIVE:
- Worked CRUD function for loot groups.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Added a protected **Loot Groups** admin tab with create, read, update, and soft-delete operations.
- Added transactional item assignments with drop chance and minimum/maximum quantity settings.
- Added monster assignments using active monster records.
- Added searchable item selection with type and rarity filters.
- Added searchable monster selection by name, ID, or level.
- Added relation cleanup when a loot group is deleted.
- Verified JavaScript syntax, Prisma schema validity, and the admin loot payload.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.