# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Scope
I have updated PRISMA schema on my local database. Check it in my local database.
What I updated:
- Added item_bonus.prisma for replacing item_effect.prisma (due to I make a incorrect and misunderstand schema name):
  1. Migrate the records from item_effect.prisma to item_bonus.prisma.
  2. Migrate the server logics using item_bonus.prisma instead of item_effect.prisma
- Added : itembonus_effects.prisma for future implementing feature item bonus effect to player when equip.
- Added: skill_effects.prisma for management additional metadata.
- Edited skills.prisma 

Implement and edit logic on server side.
Implement and edit logic on client side. 

Edit seed file : Migrate item_effect.prisma to item_bonus.prisma


## WANT TO ARCHIVE:
- Worked logics on server side and client side.
- Migrated item_effect to item_bonus
- Server side and client side corrected use new schema. 

## IMPORTANT:
- Do not change inrelavent files.

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Migrated existing `item_effect` records and application logic to `item_bonus`.
- Updated server, seed, admin, inventory, equipment, battle, and client UI code to use the new schema.
- Added admin editors and persistence for `itembonus_effects` and `skill_effects`, including skill-effect duration.
- Added admin support for item bonus triggers, healing bonuses, skill target rules, and energy costs.
- Regenerated Prisma Client and verified schema validation, seeding, queries, relationship updates, and server startup.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.