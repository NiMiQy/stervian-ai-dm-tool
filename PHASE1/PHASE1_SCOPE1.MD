# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Scope

- Make a battle scene for game.html .
- Battle scene style : front-view battle system.
- Menu : Attack - Defend - Spells - Inventory - Escape.
- Make a mockup Player , Enemy (following prisma.schema file)

## WANT TO ARCHIVE:

- A battle scene: front-view battle system.
- Mockup image enemy (With HP below of it)
- Player (HP, spellpoint, Spell_point bar: present example : Lv1. 2 blue squares, status)
- A selectable attack, defend , spells, inventory.
- When select attack, pop up menu which 3 choice mock up (Strike, Double Strike, Bash)
- When select defend, pop up menu which 3 choice mock up (Defend, Dodge)
- When select spells, pop up menu which 2 choice mock up (Fireball, Heal) -> pop up spell point menu to select spell point for casting
- When select inventory, pop up menu which 24 slots, but only have 2 items (HP potions)
- Only 1 ESCAPE button to flee the fight.
- Display multiple enemies.
- Display player's party.
- Enemies is clickable to choice to attack. 

## ENHANCEMENT 1: 
- Make a simulator turn for player's party and enemy.
- Make mockup Initiative  Roll for player and enemies . Fomulas : IR = round(10 + DEX + (Level/5))
- Make up the battle-party-card : make it 2 section, on the left will be avatar of player, right will display (HP, ENERGY, SPELL POINT, Status list:  - Normal, - Poison,...)
- Make up when selecting command-dock, the selected command border button will bold and slight glow.  

## ENHANCEMENT 2: 
- Make the one with Highest IR number will take first turn. Then to other following desc IR.
- Make the enemy enemy-card has a list of status too (mockup only for dynamic data later)

## STRUCTURE OF SCOPE - WORKFLOW: 

1. **Front-View Battle Scene Presentation & Initiative Track (`public/game.html` & `public/style/battle.css`)**:
   - **Encounter Header**: Displays encounter name ("Warden's Crossing Ambush"), battle system mode, and active round counter (`Turn 1`, `Turn 2`, ...).
   - **Initiative Timeline Track**: Displays all combatants strictly ordered in descending Initiative Roll (IR), highlighting the active combatant (`is-active-turn`) and striking through defeated targets.
   - **Upper Field (Enemies Stage & Status Lists)**:
     - Front-view stage presenting multiple enemies (`Dire Wolf Alpha`, `Dire Wolf Scout`) with avatar sprites, levels, and individual IR badges (`IR 23`, `IR 21`).
     - **Enemy Status List**: Each enemy card displays a status list (`STATUS:` `- Normal`, `- Enraged`, `- Bleed`, `- Staggered`, `- Poison`), supporting dynamic status effects.
     - **Individual HP Meters**: HP numbers (`HP 45 / 45`) and color-fill health bars placed directly underneath each enemy sprite.
     - **Targeting Interaction**: Living enemies are interactive/clickable to set the active combat target (`[🎯 TARGET]`).
   - **Mid Field (2-Section Party Status Cards)**:
     - **Left Section**: Large character avatar portrait, character name, job class, level, IR badge (`IR 25`), and turn status indicator (`▶ ACTING` / `STANDBY`).
     - **Right Section**: HP bar with numerical values (`28 / 34`), Energy bar (`68 / 80`), Spell Points bar (Lv.1 two blue squares `[■][■]`, Lv.2 squares `[■][ ]`), and Status list badges (`- Normal`, `- Poison`, `- Defending (+50% Armor)`, etc.).
   - **Combat Narration Bar**: Real-time battle narration banner providing action feedback, damage numbers, spell effects, and status changes.

2. **Command Dock & Nested Submenu Navigation (`public/js/containers/battleContainer.js` & `public/style/battle.css`)**:
   - **Primary Action Menu**: 5 main action buttons (`Attack`, `Defend`, `Spells`, `Inventory`, `Escape`). Selected/active command buttons feature a bold border and slight colored glow.
   - **Attack Submenu**: 3 choices (`Strike` [0 EP], `Double Strike` [15 EP], `Bash` [20 EP]) with bold glow hover styling.
   - **Defend Submenu**: 2 choices (`Defend` [+50% Armor guard stance], `Dodge` [+40% Evasion agile stance]).
   - **Spells Submenu & Spell Point Selector**: 2 spell choices (`Fireball`, `Heal`) transitioning to the **Spell Point Slot Selector** (`Lv. 1 Slot [■][■]`, `Lv. 2 Slot [■][ ]`), consuming a point square upon casting.
   - **Inventory Submenu (24 Slots Grid)**: Renders a 24-slot backpack grid with 2 populated usable items (`Lesser HP Potion ×2`, `Restorative Draught ×1`) and 22 empty dashed slots.
   - **Escape Action**: Single 1-click escape button to disengage and safely exit the battle encounter.

3. **Initiative Engine & Descending Turn Queue Resolution (`public/js/containers/battleContainer.js`)**:
   - **Initiative Roll Formula**: Computed for all combatants at battle start using:
     $$\text{IR} = \text{round}\left(10 + \text{DEX} + \frac{\text{Level}}{5}\right)$$
     - Player (*Quinn*): Level 3, DEX 14 $\rightarrow$ $\text{IR} = 25$
     - Companion (*Kaelen*): Level 2, DEX 10 $\rightarrow$ $\text{IR} = 20$
     - Dire Wolf Alpha: Level 3, DEX 12 $\rightarrow$ $\text{IR} = 23$
     - Dire Wolf Scout: Level 2, DEX 11 $\rightarrow$ $\text{IR} = 21$
   - **Strict Descending IR Turn Cycle**:
     1. **Turn Queue Order**: The combatant with the highest IR number always takes the first turn. Turns then proceed sequentially down the queue in descending order of IR (`[Quinn (25)] -> [Dire Wolf Alpha (23)] -> [Dire Wolf Scout (21)] -> [Kaelen (20)]`).
     2. **Dynamic Turn Execution**:
        - If an **Enemy** has the highest IR, the enemy automatically takes the first turn before the player (attacking a party member), advancing the queue until reaching the player.
        - When the queue reaches the **Player**, the command dock unlocks for player input.
        - Once the player acts (Attack, Defend, Spell, Inventory), the queue resumes executing remaining lower-IR combatants.
        - When a **Companion** takes their turn, they automatically cast support or offensive spells (e.g. Arcane Dart).
     3. **Round Progression**: When all living combatants in the queue finish their turn, the round counter increments (`Turn 2`, `Turn 3`), temporary 1-round defenses expire, the living combatants are re-queued by IR descending, and the highest-IR combatant leads the new round.

4. **Prisma Schema Data Alignment**:
   - **Characters & Stats**: Models `characters`, `character_stats` (DEX for IR, current_hp, max_hp, current_energy, max_energy, armor), and `character_spellpoints` (level, current, max_current squares).
   - **NPC Enemies & Statuses**: Models `characters` (character_type = NPC), `npcs` (is_attackable = true), `npc_monsters` (experience_reward), with status effect arrays (`statuses`).
   - **Inventory**: Models `character_inventory` (max_slots = 24) and `item_inventory` / `items` / `item_effect`.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.