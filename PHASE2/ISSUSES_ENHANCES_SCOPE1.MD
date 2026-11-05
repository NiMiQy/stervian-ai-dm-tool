# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure
## Scope
Enhance features, Fix issues I've found:
In game.html, Character Sheet (.character-sheet):
  1. Attributes section -> Make a tooltip that telling player know what stat affect to. For example (STR will affect to Phys dmg, HP... . INT will affect to Magical dmg)
  2. Equipment section -> Make clickable on equipped item, when clicked the modal show confirm to unequip or not.
  3. Inventory - Backpack section -> Make clickable to item.
    3.1 - Make or enhance function to use ITEM type CONSUMABLE 
    3.2 - Make or enhance function to confirm to equipp items type = [HELMET|ARMOR|SHOES|GLOVES|LEFT_EARRING|RIGHT_EARRING|LEFT_RING|RIGHT_RING|NECKLACE|BELT|MAIN_HAND|TWO_HAND]. 
In admin.html
  1. Effects tab -> update the list effect type. 
  2. Skills tab -> update to newest schema.
  3. Items tab -> update to newest schema.

Update server/client side . 


## WANT TO ARCHIVE:
- Worked client/server side. 
- Worked Admin page. 
- Worked Client page.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

### 1. Character Sheet & Inventory (`game.html`, `gameContainer.js`, `equipmentTooltips.js`)
- **Stat Tooltips**: Interactive tooltips on attributes (`STR`, `INT`, `DEX`, `CHA`, `CON`, `WIS`) showing authoritative derived stat bonuses.
- **Equipment & Inventory Modals**: Clicking items opens non-destructive action modals (`#itemActionModal`) to equip gear, unequip gear, or use consumables.
- **Consumable Usage**: Consumes stack, heals current HP up to `max_hp`, and purges matching debuffs (`cure_effect_type`).
- **Inventory Fixes**: Resolved `options is not defined` runtime error and restored full 40-slot backpack rendering with live slot count.
- **Equipment Logic & Hand Rules**:
  - **Dual `MAIN_HAND`**: Players can equip `MAIN_HAND` items in both hands (Main Hand and Off Hand).
  - **Hand Occupation Check**: If a target hand (or both hands) is occupied by a weapon, player is instructed to unequip first.
  - **`TWO_HAND` Blocking**: Equipping `TWO_HAND` weapons requires both hands free and strictly blocks the off-hand (`🚫 Blocked (2H)`). Attempting to use the blocked hand notifies the player that a two-handed weapon is equipped.
  - **Shields & Icons**: Shields route to off-hand with `🛡️` icon. Secondary slots auto-fill for rings and earrings.
  - **Robust Unequip**: Supports unequip by slot key or by `itemId` fallback.

### 2. Admin Dashboard (`admin.html` & `admin.js`)
- **Modal Fix**: Fixed Character Create/Edit modal initialization crash (`readValue` reference error).
- **Effects Tab**: Updated `effect_type` dropdown to Prisma `EffectType` enum (`BUFF`, `CURE`, `HEALING`, `RECOVERY`, `STUN`, `DAZE`, `WEAK`, `BLIND`, `POISON`).
- **Skills Tab**: Added `healing_current_hp`, `cure_effect_type`, and `duration` fields.
- **Items Tab**: Aligned `type` with `ItemType` enum (removed `SUB_HAND`), added `weapon_type`, and added `cure_effect_type`.

### 3. Server & Database (`server.js`, `characterContainer.js`, `seed.ts`)
- **Endpoints**: Registered authenticated routes `POST /api/characters/:id/equip`, `POST /api/characters/:id/unequip`, and `POST /api/characters/:id/use-item`.
- **Authoritative Calculations**: Server recalculates HP, armor, power, and resists upon any equipment or stat mutation using `databaseError()`.
- **Database Seeding**: Seeded starter consumables (`Minor Health Potion`, `Bandage`, `Antidote`, `Smelling Salts`) and starter equipment.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
