# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, I have changed schema db. I have adjusted some logics in admin.html But some logics aren't working (For example: I cannot edit a exists character or add item for the character)
- Check and fix logics for all tab in admin.html

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented
- Fixed missing `character_id` parameter in `characterItemData` and all call sites in `src/containers/adminContainer.js`, resolving failures when editing existing characters and managing backpack/equipment/vault items.
- Updated `updateAdminRecord('locations')` to use nested Prisma `region: { connect: { id: ... } }` syntax, preventing schema update errors when updating locations with or without `region_id`.
- Added deduplication logic for composite key relations (`character_skills`, `character_lifeskills`, `character_effects`, `skill_effects`, `itembonus_effects`) to prevent unique constraint crashes.
- Cleanly mapped `spellpoints` and `memories` in `updateCharacter` to strip internal audit fields and primary keys during replacement.
- Ensured unique `user_id` validation for player characters before creation and update.
- Restricted character vault synchronization strictly to player characters (`type === 'PLAYER'`).
- Added soft-delete filters (`where: { deleted: false }`) in `getAdminDashboard` for items, regions, and locations.
- Cascaded soft delete to `npcs_in_locations_or_sublocations` and `npcmonsters_lootgroups` when characters/monsters are deleted.
- Fixed `public/js/admin.js`:
  - Gated vault gathering to `PLAYER` only in `formDataEnhanced`.
  - Preserved existing `gold` and `current_point_spend` values when editing without overwriting with starter player defaults.
  - Safely accessed optional properties in `readValue`.
  - Bound `updateInvBadge`, `updateVaultBadge`, and `updateSkillCountBadge` to `window` for reliable inline event handling.
- Verified all 13 admin tabs (Users, Characters, Items, Skills, Effects, Lifeskills, Regions, Locations, Sublocations, Loot Groups, Prefixes, Suffixes, Stories) via end-to-end CRUD test script.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.