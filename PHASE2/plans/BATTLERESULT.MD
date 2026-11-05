# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Plans:

### 1. Hardcore Death Penalty (Extraction / Tarkov Style)
- **Killed in Action (Defeat Flow)**:
  - When the player's `current_hp` drops to `0` in battle, the character is defeated.
  - **Full Gear & Inventory Wipe**:
    - All items in the active backpack (`item_inventory`) are deleted/cleared.
    - All equipped items across all slots in `character_equipments` (helmet, armor, gloves, shoes, weapons, rings, earrings, necklace, belt) are stripped and deleted.
    - Carried gold (`players.gold`) is wiped to `0` (or dropped).
  - **The Safe Haven (Town Vault Immunity)**:
    - Items and materials safely stored in the **Town Vault Chest** remain **100% safe and intact**.
    - This reinforces the extraction gameplay loop: players must strategically decide what to risk bringing into the wilderness and regularly return to town to stash valuable loot.
  - **Respawn & Saved Safe-Zone Home Point**:
    - Players can bind/save any visited safe-zone town or inn as their **Home Respawn Point** (`respawn_location_id`).
    - Default starting home location: **Honeywood Village** (`location_id = 1`).
    - When killed in action, the active battle terminates cleanly, and the player respawns at their **saved safe-zone home location**.
    - Vitals reset to baseline recovery (`current_hp = 10` or base derived max, `current_energy = 100`, spell slots refreshed).
    - Player awakens naked in town, ready to pull backup gear from their local Town Vault Chest or purchase starter items.
  - **NPC Allies & Party Companions (No Penalty Rule)**:
    - When an NPC ally or party companion falls in battle (`current_hp <= 0`), they are merely marked as `Knocked Out` for the remainder of the fight.
    - **100% Item & Gear Preservation**: NPC companions **never lose their inventory, equipment, or belongings**. The hardcore wipe penalty applies **strictly to the player character** (`character_type == 'PLAYER'`).
    - If the player wins, fallen NPC companions revive with partial HP.
    - If the entire party wipes and the player dies, companions safely return to their home/safe zone location with all their gear and items intact.

### 2. Victory Resolution (Successful Extraction / Survival)
- **Defeat of All Enemies**:
  - Combat terminates with a `VICTORY` state.
  - **EXP & Progression**:
    - Pools monster EXP: $\sum (\text{enemy.level} \times \text{enemy.base\_exp} \times \text{enemy.multiplier})$.
    - Updates `characters.current_exp` and triggers level-up (+5 stat points, spell slot expansion, full heal) if threshold is met.
  - **Loot & Gold Acquisition**:
    - Rolls each enemy's `loot_drop_group` independently.
    - Adds rolled items to `item_inventory` respecting stack limits and backpack slot capacity.
    - Increments `players.gold`.
  - **Vitality State Persistence**:
    - Persists player's ending `current_hp`, `current_energy`, and remaining `character_spellpoints` to the database so battle attrition carries over into subsequent gameplay.

### 3. Flee / Tactical Escape Mechanics
- **Authoritative Escape Action (`FLEE`)**:
  - Escape chance formula calculated on server:
    $$\text{Escape Chance} = \text{clamp}\left(35\% + (\text{Player Initiative} - \text{Highest Enemy Initiative}) \times 3\%, 10\%, 90\%\right)$$
  - **Escape Success**:
    - Ends combat session cleanly.
    - Player retains all gear, inventory, and vitals, retreating to safety.
  - **Escape Failure**:
    - Forfeits player turn; action fails.
    - Remaining enemies immediately take their attack turns, increasing the risk of death.

---

## Scope break down:

### Scope 1: Server Authoritative Battle State Evaluation
- In `battleSystemCore.js`, evaluate battle outcome after every unit turn:
  - `VICTORY`: All enemies have `isDefeated = true`.
  - `DEFEAT`: Player has `current_hp <= 0` or `isDefeated = true`.
  - `IN_PROGRESS`: Both player and at least one enemy are alive.
- Block any player action requests once combat enters a terminal state (`VICTORY` or `DEFEAT`).

### Scope 2: Hardcore Defeat & Wipe Mutation
- Implement server mutation `resolvePlayerDefeat(userId)` wrapped in a single database transaction:
  - Isolate the player record (`character_type == 'PLAYER'`).
  - Delete all records in `item_inventory` associated with the player's active inventory (preserving all NPC companion items).
  - Reset all equipment foreign keys in the player's `character_equipments` to `null` (preserving all NPC companion equipment).
  - Reset `players.gold` to `0`.
  - Reset `characters.location_id` to player's saved `respawn_location_id` (fallback to Honeywood Village `location_id = 1`).
  - Restore player partial base HP (`current_hp = 10`) and full energy (`current_energy = 100`).
  - Clear the in-memory battle session.

### Scope 3: Victory Mutation & State Persistence
- Implement server mutation `resolvePlayerVictory(userId, battle)` in a database transaction:
  - Persist ending `current_hp`, `current_energy`, and `character_spellpoints`.
  - Apply pooled EXP and level-up rewards (`characters.level`, `characters.current_exp`, `players.current_point_spend`).
  - Apply rolled loot items to `item_inventory` and grant gold to `players.gold`.
  - Clear the active battle session.

### Scope 4: Authoritative Escape (`FLEE`) Implementation
- Add server action handler for `type: 'ESCAPE'` in `POST /api/battles/actions`:
  - Calculate escape roll against enemy initiative.
  - If successful: close encounter, persist vitals, log successful retreat.
  - If failed: log escape failure, advance turn queue, trigger enemy attacks.

### Scope 5: Client Result Modals & Death Presentation
- Create **Victory Modal**:
  - Displays gained EXP, level-up notifications, dropped items, and earned gold with a "Continue Adventure" button.
- Create **Defeat Modal ("KILLED IN ACTION")**:
  - Dramatic dark overlay showing cause of death, lost inventory items, and lost equipment list.
  - "Respawn in Town" button that reloads character sheet at Honeywood Village.

---

## IMPORTANT:
- Do not change inrelavent files.
- The currently UX/UI layout for admin.html is working fine and correct, do not current delete layout, just add or adjust. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:


## Implemented

