# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Current stage:
- **Server-Authoritative Battle Core (`src/containers/core/battleSystemCore.js`)**:
  - Dynamic initiative turn queue (`10 + DEX + Level / 5`).
  - Authoritative derived stats, equipment bonuses, and damage mitigation formulas (armor, magic armor, elemental resistance, spell amp).
  - Turn resolution for `ATTACK`, `MAGIC_ATTACK`, `SPELL` (spell-slot consumption), and `DEFEND` actions with energy checks.
  - Support for 1–5 enemies loaded dynamically from attackable NPC records in the database.
  - Server-side NPC AI turns (`chooseNpcAction` via `aiDecisionContainer.js`) running sequentially until player turn or defeat.
- **APIs & MCP Integration**:
  - REST endpoints: `GET /api/battles/encounter` and `POST /api/battles/actions`.
  - MCP tool `publish_encounter` validates `userId`, spawns 1–5 enemies, and broadcasts via WebSocket to open combat modal.
- **Client Battle UI (`battleContainer.js` / `game.html`)**:
  - Modal with dynamic turn initiative pills, multi-enemy targeting cards with animated HP bars, and combat log.
  - Action docks with submenus for Attack, M.Attack, Defend, Spells (with spell slot selection), and consumable item list.
- **Current Gaps / Not Yet Implemented**:
  - **In-Memory Session**: Battles live only in a server-side `Map`; no DB persistence or reconnect recovery.
  - **No State/Vitality Sync**: Player/enemy HP changes are not persisted back to the character database upon completion.
  - **No Rewards / Progression**: No XP rewards, loot drops, leveling triggers, or quest progress on victory.
  - **In-Combat Items Not Functional**: Consumable items are displayed from player inventory, but action handler does not consume/apply them yet.
  - **Escape Incomplete**: Flee button closes client modal without server resolution or check.
  - **Minimal AI**: Enemies only target the player using a single skill (e.g., Bite).

## Plans:

### 1. What You Miss (Current Gaps & Blindspots)
- **Battle Outcome Lifecycle**: No Victory, Defeat, or Flee resolution logic; combat currently has no clean end state.
- **State Persistence**: Changes to HP, Energy, and Spell Slots during battle are not saved to the database (`character_stats`, `character_spellpoints`).
- **Combat Inventory Consumption**: Consumable items are visible in the dock, but using them does not heal or decrement item quantities in `item_inventory`.
- **Progression & Rewards Engine**: No XP calculation, no loot drop tables, and no level-up triggers upon defeating enemies.
- **Death & Defeat Recovery**: When the player hits 0 HP, there is no game-over flow, revival penalty, or safe-location respawn.
- **Session Survival**: Active combat lives solely in volatile server memory; page reload or disconnect drops the encounter without consequence.

### 2. Have-To-Have (Critical Foundation to Complete Combat)
- **Battle Completion & Vitality Sync**:
  - Detect all enemies defeated -> Trigger Victory state.
  - Detect player defeated -> Trigger Defeat state.
  - Persist player's ending HP, Energy, and remaining Spell Slots directly back to `character_stats` and `character_spellpoints`.
- **Combat Consumable Execution**:
  - Server-authoritative `USE_ITEM` action to restore HP/Energy and decrement stack count from `item_inventory`.
- **Reward & Loot Distribution**:
  - Award monster XP -> update player `exp`, triggering level-up checks and stat/spell progression.
  - Roll and grant monster drop items into player's `item_inventory` within capacity constraints.
- **Authoritative Escape (Flee) Logic**:
  - Server calculation based on player initiative/DEX vs highest enemy initiative.
  - Success ends combat cleanly; failure forfeits player turn and advances enemy turn queue.
- **Defeat / Respawn Handler**:
  - Clear combat session, respawn player in designated safe town/location with partial HP.

### 3. What the Game Needs (Core Gameplay Loop & Integrity)
- **Combat End UI / Results Screen**:
  - Victory summary modal displaying earned XP, dropped loot, and level-ups.
  - Defeat screen with respawn prompt.
- **Status Effects & Turn Ticks**:
  - Round-based lifecycle for buffs, debuffs, and DoTs (Bleed, Poison, Burn, Stun) ticking each turn.
- **Improved Monster AI Variety**:
  - Expand beyond "Bite": allow monsters to cast elemental skills, apply debuffs, or heal when low on HP.
- **AI-DM Story Synchronisation**:
  - Automatically append combat conclusion (Victory / Defeat / Flee) into story feed and AI-DM memory so narrative reacts accurately.
- **Battle Reconnect / Anti-Combat-Log**:
  - Store active combat ID on player session or character record so reloading `game.html` resumes active battle rather than wiping it.

### 4. Nice-To-Have (Polish & Enhanced Immersion)
- **Combat Animations & Floating Text**: Damage numbers, critical hit popups, healing green numbers, and screen shake on heavy blows.
- **Party / Companion Combatants**: AI companions joining player party and executing tactical support actions.
- **Elemental Affinity Indicators**: Visual icons on targeted enemies showing resistances, immunities, or vulnerabilities.
- **Sound Effects & Audio Cues**: Weapon swings, spell impacts, victory fanfare, low-HP warnings.
- **Auto-Battle & Combat Speed**: 1.5x / 2x speed toggle and auto-basic-attack option for trivial grind encounters.
- **Detailed Combat Log Filters**: Tabbed filters for damage taken, damage dealt, and status changes.


