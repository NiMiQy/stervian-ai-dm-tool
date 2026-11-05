# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
I have updated schema for crafting system, upgrading system, affixes system:
Make a crafting.html only . UI/UX is following style from game.html : 
- On the right will be a category of crafting. crafting item list:
 1. required materials -> output , output quanity

- Add the Upgraded tab for upgraded system:
 1. Read plans/UPGRADING_AFFIXES.MD and implement the scope. 

- Add the Affixes tab for Affixes (but in developing mode and send a message to tell player in the future).


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Added server-authoritative crafting and equipment upgrades with serializable transactions, guarded resource deductions, conflict responses, and a 2-second upgrade progress state.
- Added `crafting.html` with Craft, Upgrade, and in-development Affixes tabs, recipe/category filters, material and energy requirements, and upgrade costs.
- Matched the crafting topbar to `game.html`, including navigation tabs and working settings/logout controls.
- Updated `shop.html` with the shared Explore, Party, Inventory, World, Crafting, and Shop navigation header.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.