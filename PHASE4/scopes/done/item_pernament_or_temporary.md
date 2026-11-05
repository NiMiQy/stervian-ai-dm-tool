# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I have updated schema item_bonus and character_item_bonus_times.prisma
Some item only has temporary time to get the bonus
Some item only used one to get pernament bonus (after used one , the bonus pernament not gain again, only healing, food, water, energy recovery)
Some item will instant use like food, potion, etc to healing instant HP or instant Food, water 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Every consumable keeps its **instant** effects (healing, food, water, energy, cure) on every use. `item_bonus.consume_bonus_mode` now decides what happens to its stat bonuses (max HP, attributes, attack, armor, resistances, crit):
  - `NONE` (default): stat fields are ignored when used.
  - `TEMPORARY`: stats apply for `buff_duration_minutes` real-time minutes. Using the same item again refreshes the timer (no stacking); different items stack.
  - `PERMANENT_ONCE`: stats apply forever the first time a character uses the item. Later uses only give the instant effects; if the item has no instant effect it cannot be used again (it is not wasted).
- Added `src/services/itemBonusTimeService.js`, shared by the inventory and combat use paths. Active bonuses are recorded in `character_item_bonus_time` (one row per character + item) and added to stat calculation as extra bonus sources in `calculateDerivedStats`: character sheet, combat units, stat upgrades, equipment changes, crafting upgrades and the AI DM character lookup. If an admin later sets an item back to `NONE`, its recorded bonus stops applying.
- Stored `max_hp` is re-synced (and current HP clamped) when a bonus is gained or expires. Expired temporary bonuses are cleared lazily when the character sheet loads or an item is used; no background job is needed.
- Using a stat item in combat applies its instant effects immediately; its stat bonus is recorded and takes effect from the next battle.
- On death, temporary bonuses are removed and max HP is re-synced (this also drops max HP from equipment lost on death); permanent bonuses remain.
- Game client: the character sheet shows an **Active Bonuses** list (permanent or time left, with the stat summary) using the existing life skill list styling, and the use-item prompt states the temporary or permanent bonus, or that a permanent bonus was already absorbed.
- Admin item editor: added a **Stat Bonus When Used** section with the bonus mode and buff duration.
- Schema: added the missing opposite relation fields (`character_item_bonus_times`) on `characters` and `items`, required by Prisma for `character_item_bonus_time`. Database changes are applied with `npm run migrate:item-bonus-times` (`src/prisma/updates/addItemBonusTimes.js`).

