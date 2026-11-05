# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, the drop chance of loot group base on rarity is hard core. 

I would like to move the % chance of loot group on location to database schema. 

Design Choice (Level Scaling): I want the player's Gathering level to boost the drop rate, chance_pct as the base chance and add level bonuses:
const effectiveChance = Math.min(100, activationChance + (currentLevel - 1) * 0.5);

Remove the hard code In executeGather.js

- In admin.html , add the way to manage loot group chance on location. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- **Gather rolls (`src/containers/gatheringContainer.js`)**: hard-coded rarity chances removed. Only groups linked in `locations_lootgroups` (`deleted = false`) can drop; the name-based matching ("Gathering - Common", "<Location> Gathering…") is gone.
  - Each group rolls `effectiveChance = min(100, chance_pct + (level - 1) * 0.5)` via `calculateEffectiveGroupChance()`.
  - Rarity only sets `is_rare` and the rare bonus EXP (RARE/LEGENDARY), not the drop chance.
- **Constant**: `GATHERING_LEVEL_DROP_BONUS_PCT = 0.5` (`src/configs/constants.js`).
- **API**: removed `uncommon_chance_pct`, `rare_chance_pct`, `legendary_chance_pct`; added `lifeskill.drop_bonus_pct`. Each group's `activation_chance_pct` is now its effective chance.
- **Gathering panel**: the "Rare Chance" stat is now "Drop Bonus" (`game.html`, `public/js/containers/gatheringContainer.js`).
- **Admin**: Loot Group modal → "Assigned Locations" has a "Drop chance (%)" box per location (`public/js/admin.js`). It sends `location_links: [{ location_id, chance_pct }]`, which `adminContainer.js` saves, limited to 0–100 (default 100). The input styling is in `public/style/admin.css`.
- **Data**: no schema or data changes, and no test records.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.