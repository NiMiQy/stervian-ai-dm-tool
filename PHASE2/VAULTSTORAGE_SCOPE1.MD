# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about VAULT STORAGE. 

Find a plan in PHASE2/PLANS.MD and PHASE2/VAULTSTORAGE.MD for the current stage information.

Schema : PRISMA.MD file - Structure

## Scope
Currently , I have updated database schema:
  1. locations table -> adde is_safe_zone column (define if location is a safe zone)

Following current plans, implement the feature :
- Players can only open their vault in safe zone.
- When open vault tab on client side, there will be a sceen that split (left: player's inventory, right: player's vault)
- Players can store or receive items, gold from inventory to vault or vault to inventory.


## WANT TO ARCHIVE:
- Worked logics
- Players could open vaults and use vaults.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Safe-zone-only vault access; blocked while defeated or in combat.
- Atomic item and gold transfers with slot, stack, and ownership validation.
- Equipped equipment cannot be deposited; fully transferred inventory rows are hard-deleted.
- Vault UI shows backpack, vault contents, capacity, and stored gold.
- Gold transfers refresh the game UI automatically.
- Vault tab is hidden outside safe zones.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.