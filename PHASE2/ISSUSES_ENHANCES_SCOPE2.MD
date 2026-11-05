# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure
## Scope
Enhance feature:
- In game.html, Vault tab (safe zone storage) -> When Player want to store items have quantity more than 2, the player could choice number to store.


## WANT TO ARCHIVE:
- When player store items has many quantity, player could choice number to store.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Enhanced safe-zone storage (`gameContainer.js`) in `game.html` to allow choosing transfer quantity when storing (depositing) or withdrawing items with quantity > 1.
- Integrated `#itemActionModal` with a dedicated quantity selector featuring current stack info (`In Backpack` / `In Vault`), direct number input, `−` / `+` step buttons, and an `All` button.
- Single-item stacks (quantity = 1) retain instant one-click transfer for both deposit and withdraw.
- Partial and full transfers atomically update via `/api/vault/deposit` and `/api/vault/withdraw`, refreshing character vitals and vault capacity.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
