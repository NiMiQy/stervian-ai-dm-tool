# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure
## Scope

Currently, when the user register a new account -> logged in -> character creation modal.

- After they fillde the character creation information:
 1. Make the player to choice only 1 weapon to start:  Wooden [SWORD|BOW|STAFF|QUARTERSTAFF|AXE|SPEAR|GREATSWORD|SHORTSWORD|CLUB|KNIFE]
 2. Make the player to force spawn at location Honeywood Village.
 3. Make [Bandage x 5, Small HP potions x 5, Bread x 5, Bottle of water x5] as a starter items for every new account only. 


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

1. **Starting Weapon Selection**:
   - Added a `Starting Weapon` dropdown (`#characterStartingWeapon`) to the character creation card in `public/game.html` reusing existing layout classes (`creation-field full`, `label`, `select`) without modifying client stylesheet.
   - Enforced single starter weapon selection across the 10 wooden weapon options: Wooden `[SWORD, BOW, STAFF, QUARTERSTAFF, AXE, SPEAR, GREATSWORD, SHORTSWORD, CLUB, KNIFE]`.
   - On character creation in `src/containers/characterCreationContainer.js`:
     - Validates that a valid wooden starting weapon was selected.
     - Automatically equips the selected weapon in the character's primary equipment slot (`left_hand_id`).
     - Adds the weapon to the player's inventory (`item_inventory`) with `is_equipped: true`.
     - Binds the weapon's associated combat skills from `skills_in_items` along with `Strike` and `Defend` into `character_skills`.

2. **Forced Spawn Location**:
   - All newly created characters are forced to spawn at `Honeywood Village`.
   - Both `location_id` and `respawn_location_id` are explicitly set to the `Honeywood Village` location.
   - `sublocation_id` defaults to `null` (the main village area).

3. **Starter Consumables Bundle**:
   - Every newly created character receives the starter consumable bundle in their backpack (`item_inventory`):
     - `Bandage` x 5
     - `Small HP Potion` x 5
     - `Bread` x 5
     - `Bottle of water` x 5
    - In `src/containers/characterContainer.js`, consumable usage is schema-driven via `bonus.current_food_bonus` and `bonus.current_water_bonus`:
      - `Bread`: restores 10 Food (up to `max_food`), consumes 3 Water (floored at 0) based on `current_food_bonus: 10, current_water_bonus: -3`, and synchronizes hunger/thirst effects.
      - `Bottle of water`: restores 15 Water (up to `max_water`) based on `current_water_bonus: 15`, and synchronizes thirst effects.
      - `Small HP Potion` and `Bandage`: restore HP up to maximum derived HP.
    - In `src/prisma/seed.ts`, configured `zeroEffect` and item seeds with `current_food_bonus` and `current_water_bonus`.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.