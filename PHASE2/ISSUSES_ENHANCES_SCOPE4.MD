# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
In admin.html, add tab SubLocations:
    1. If SubLocation is INN or SHOP -> can add items. 

In game.html, "Open Map" button (.map-button) :
    1. Change the name to "Move"

When open "Move" -> show a list sublocation in locations.   
Player can choice a sublocation to enter. 
If player is in INN or SHOP -> The sidebar will show tab "INN" or "SHOP" where will open a modal shop.

## WANT TO ARCHIVE:
- CRUD SubLocations
- SubLocations can add items if type is INN or SHOP.
- INN and SHOP in sidetab will open modal shop. 
## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well.

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- **Admin SubLocations CRUD (`public/admin.html`, `public/js/admin.js`, `src/containers/adminContainer.js`)**:
  - Added `SubLocations` tab with search, location dropdown filter, and type filter.
  - Implemented dynamic modal: displays item management (`sublocations_items`) when `sublocation_type` is `INN` or `SHOP`.
  - Added transactional backend CRUD with upsert item synchronization.
- **Move System (`public/game.html`, `public/style/game-ui-overrides.css`, `public/js/containers/gameContainer.js`)**:
  - Renamed map button from "Open Map" to "Move" (`#moveButton`).
  - Clicking "Move" opens `#moveModal` listing sublocations in the character's current location.
  - Player can enter a sublocation or exit to the open area via `POST /api/characters/:id/sublocation`.
- **Dynamic Shop / Inn Modal (`public/game.html`, `public/js/containers/gameContainer.js`, `src/containers/characterContainer.js`, `src/server.js`)**:
  - Sidebar dynamically displays an "Inn" or "Shop" tab when inside an `INN` or `SHOP` sublocation.
  - Clicking the tab opens `#shopModal` to view wares and current player gold.
  - Players can buy items via `POST /api/characters/:id/buy-item`, with server-side validation of gold, inventory space, and stack limits.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
