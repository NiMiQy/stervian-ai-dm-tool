# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I have upated skills.prisma.
->  add skill_weapon_types.prisma

- Some skills are only for some WEAPON TYPE. 
(Example: Heavy Strike is only for greatsword, sword, longsword, etc)

Adjust server, client logics. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented
- Skills are restricted through `skill_weapon_types` (`skills.for_weapon_types`). A skill with no rows works with any weapon; otherwise the character must hold at least one listed weapon type in the left or right hand slot. With nothing in either hand the character counts as `NONE` (unarmed).
- Server (`battleSystemCore.js`): each combatant's skills carry `weapon_types` and `weapon_usable`. The player skill action rejects a restricted skill with a message naming the required weapons. Monsters and enemy NPCs are not restricted. `aiDecisionContainer.js` skips unusable skills for allied NPCs. Skill queries in `battleSystemCore.js` and `characterContainer.js` now load `for_weapon_types                    .
- Admin (`adminContainer.js`, `admin.js`): the Skills editor has a Weapon Restriction checklist, the Skills table has a Weapons column, and a Weapon filter lets you pick a type or "Any weapon". Saving validates the weapon types.
- Client (`battleContainer.js`): unusable skills are disabled in the battle menu and show the required weapons.
- `constants.js`: added `UNARMED_WEAPON_TYPE`.
- Not done: no skill has restriction rows yet, so none are restricted until set in the admin dashboard. `LONGSWORD` is not in the `WeaponType` enum, so it cannot be selected.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.