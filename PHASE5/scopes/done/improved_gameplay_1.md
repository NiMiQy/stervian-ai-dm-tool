# Improved Gameplay 1

## Setup required
Run these once, in order, then `npm start`:
1. `npm run migrate:evade-chance`: adds `item_bonus.evade_chance_bonus` and creates the **Dodge** skill.
2. `npm run migrate:accuracy`: adds `character_stats.accuracy` (default 1) and `item_bonus.accuracy_bonus`.

## Combat

### Evade
- **Evade** = 10% + 1% per DEX above 5 + gear `evade_chance_bonus` + level gap + Dodge (+15%), **capped at 85%**.
- **Level gap**: the higher-level side gets `(gap − 2) × 10%` when gap ≥ 3. Lv 4 vs Lv 1 = +10%; Lv 8 vs Lv 1 = +50%. Monsters use their scaled level.
- **After the cap**: Daze −25 points; Stun = 0% evade; then attacker accuracy is subtracted. The final value is floored at 0.
- **Evadable**: every attack, skill or spell that deals damage (both sides). An evaded hit = 0 damage and no status effects. Log: "X evaded Y's Skill!"
- **Not evadable**: heals, Defend, Taunt and Dodge. Damage over time (e.g. poison) is not rolled once applied.
- **Dodge**: a DEFEND skill (2 energy). +15% evade until the user's next turn, with no damage reduction. Identified by name, like Bash and Taunt. Give it to characters in the admin panel.
- **Monster AI**: monsters factor evade into their expected-damage choices.

### Accuracy
- **Accuracy** = base `character_stats.accuracy` (default 1, editable per monster) + main-hand weapon + earrings, rings and necklace.
- **Ignored**: armor, belt and the sub-hand weapon.
- **Hit math**: hit chance = 100 − (target evade − attacker accuracy).
- **Blind**: −75 accuracy (floor 0). The old 30% Blind miss roll is kept.
- **Tuning**: all values live in `EVADE_RULES` in `src/configs/constants.js`.

### Main hand / sub hand
- **Slots**: left hand = main, right hand = sub. A lone weapon in either hand counts as main.
- **Equip prompt** for one-handed weapons: "Equip to Main Hand" / "Equip to Sub Hand".
- **Rule**: sub hand is blocked until the main hand holds a weapon (UI and server).

### Combat page (`combat.html`)
- **Removed**: the enemy quote panel.
- **Bug fixed**: the main command grid never hid, so submenus were unreadable.
- **Layout**: larger skill buttons and text; the battle log shrank from 216px to 132px to give room to the action dock.

## Quests
- **Abandon**: active quests can be abandoned (`POST /api/quests/:runId/abandon`; the run becomes `FAILED`).
- **Groups**: offers are split into Group Quests (one-time) and Group Repeated Quests.
- **Limit**: max 5 active quests, enforced on the server and shown in the UI ("Quest Log Full").
- **Modal layout**: available quests on the left, active quests on the right; stacks below 860px.
- **Readability**: card text reads "Quest giver: X (One-time quest)" / "Rewards: 400 Gold, 150 EXP, +5 Affinity".

## NSFW access
- **Rule**: access = `players.verified AND players.is_nsfw` (`src/services/nsfwAccessService.js`).
- **When off**, NSFW items, quests, memories and NPC relationships are hidden server-side:
  - shop, drops, crafting, inventory and vault;
  - the quest board;
  - the AI DM / NPC context;
  - MCP lookups.
- **AI DM prompt**: when off, the explicit persona text is stripped and a General content-rating rule is added.
- **Admin**: NSFW checkboxes on items, quests, memories and NPC relationships.

## World map
- **Pin tooltip**: clicking a pin shows monsters in the area, monsters per sublocation, and the average monster level.

## UI / QoL
- **Inventory**:
  - search (name, type, rarity, description);
  - type filters with counts: Weapons, Armor, Accessories, Consumables, Materials, Quest, Misc;
  - sort: Default, Newest, Name, Rarity, Type, Quantity.
  - The state persists across actions.
- **Shop**: `.merchant-gold` renamed to `.player-gold` and moved under the purchase list.
- **Game sidebar**: Save Game button removed.

## Known follow-ups
- **Character sheet**: evade and accuracy are not displayed yet.
- **Equipment panel**: still labels the hands "left/right".
- **Unequipping the main hand** can leave a lone sub-hand weapon. It still counts as main; there is no auto-move.
- **Shop affinity bug**: the shop route passes `session.id` (user id) where a character id is expected (pre-existing).
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.