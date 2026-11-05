# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to enhance the world map, and quality of life:
The players could distracted from another thing and forget where are the monster in location or sublocation.

I would like to implement a quality of life on world map :
1. When clicked to the red pin, will appear a small tooltip modal 
2. Tooltip modal show name of Monster in the area, and sublocation with monster in area. 
3. Tooltip modal show avg level of area. 


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- Server (`worldTravelContainer.js`): the world-map response now includes `area` on each pinned location, with `average_level` (rounded mean of the monsters' base levels), `monster_count`, `monsters` (placed directly in the location) and `sublocations[]` (each with its monsters). Monsters are attackable `npc_monsters` placed through `npcs_in_locations_or_sublocations`, the same rule gathering ambushes use.
- Client (`gameContainer.js`): clicking any pin opens a small tooltip above it showing the location name, average monster level, the monsters in the area and the monsters in each sublocation. Reachable pins still select the destination too. Close it with ×. Unreachable and current pins are now clickable for the tooltip: they use the `is-unreachable` class and `aria-disabled` instead of `disabled`.
- CSS: only new rules were added in `world-travel.css` (tooltip, plus `.is-unreachable` keeps the old dimmed look). Existing styles are unchanged.
- Data checked via SQL: Honeywood Forest shows avg level 2 with Wolf in Wolf Nest; Bandit Hideout shows avg level 9. No test records were added.
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.