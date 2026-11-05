# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, implement the worl map traveling on admin.html:
1. Make a menu world map for admin add/edit/remove a pin mark on map.
2. Show a world map image in public/resources/world_map/stervian_world_map.png
3. Make a coordinates X Y for a map
4. Admin could click on the map to add red pin mark for only a location.
5. Admin could click on a exists red pin mark on the map to edit/remove.

Modify location schema for :
- Moving location from location have a energy cost, food, water. (base 5 energy, 5 food, 5 water)
- The energy cost formular is :
  For example: A move to B(cost 10 energy), B move to C (cost 20 energy), then A move to C (cost total 30 energy) , and C move to A (total cost 30 energy too).
If the player doesn't have enough energy to move, send a message to remind them to refill their energy.
This is only work for location, not sublocation. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- Admins can place, move, and remove location pins, connect routes, and edit each leg’s energy, food, and water costs.
- The World tab opens a zoomable, pannable travel map; Move only enters or exits local sublocations.
- Players travel along connected routes and pay the summed resource costs for each leg; travel clears the current sublocation.
- Persisted map coordinates and route data; run `npm run migrate:world-map` for an existing database.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.