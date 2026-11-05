# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Plans:

### 1. Database Architecture: `loot_drop_groups` & `loot_drop_group_items`
- **Why Loot Drop Groups?**:
  - Reusable drop tables shared across monster archetypes (e.g., all wolves share one group; all bandits share another).
  - Centralized drop rate and gold tuning without editing dozens of individual monster entries.
- **Database Schema**:
  - **`loot_drop_groups`**:
    - `id`: Primary key.
    - `name`: Human-readable identifier (e.g., `Forest Wolf`, `Common Bandit`, `Lord Eadric Boss`).
    - `description`: Context notes.
    - `min_gold`, `max_gold`: Range of gold awarded upon defeat.
    - `created_at`, `updated_at`, `deleted`.
  - **`loot_drop_group_items`**:
    - `id`: Primary key.
    - `loot_drop_group_id`: Foreign key to `loot_drop_groups.id`.
    - `item_id`: Foreign key to `items.id`.
    - `chance_pct`: Float (`0.01%` to `100.0%`).
    - `min_quantity`, `max_quantity`: Drop stack bounds (default 1).
    - `created_at`, `updated_at`, `deleted`.
  - **`npc_monsters` Table Relation**:
    - `loot_drop_group_id`: Nullable foreign key linking monster to `loot_drop_groups.id`.

### 2. Drop Rolling Engine & Mechanics
- **Independent Item Rolls**:
  - Every item in the monster's loot group rolls independently:
    $$\text{Dropped if: } \text{random}(0, 100) < \text{chance\_pct}$$
  - A monster can drop multiple items or none depending on roll results.
- **Gold Payout**:
  - $\text{Gold Awarded} = \text{randomInt}(\text{min\_gold}, \text{max\_gold})$.
- **Encounter Multi-Enemy Pooling**:
  - Each defeated enemy in a battle pack rolls its drop table independently.
  - All items and gold pool together into the final combat victory payload.

### 3. Inventory Constraints, Backpack Upgrades & Town Vault
- **Two-Tier Storage Architecture**:
  1. **Active Backpack (`character_inventory.max_slots`)**:
     - Starting Capacity: **30 slots** (perfect for the 3-column desktop / 2-column mobile UI grid, leaving ~12–15 slots free for expedition loot).
     - Upgradable via Town Merchants / Lifeskill Crafting:
       - Starter Satchel: 30 slots (base — 10 rows of 3)
       - Leather Backpack: 36 slots (+6 — 12 rows of 3)
       - Adventurer’s Rucksack: 42 slots (+6 — 14 rows of 3)
       - Master Travel Pack: 48 slots (+6 — 16 rows of 3)
  2. **Town Vault Chest (Safe Zone Storage)**:
     - Accessible **only inside safe zones / towns** (e.g., Honeywood Village); locked when in the wilderness or active combat.
     - Single unified town vault per character with high capacity (60–100 slots).
     - Solves the material hoarding problem so players don't need to sell valuable crafting parts or backup equipment during expeditions.

- **Stacking Rules & Defining Max Stack**:
  - `items.is_stackable = true` items stack together in a single slot up to their **`max_stack`** cap.
  - Standard Stack Caps by Item Category:
    - **Combat Consumables / Potions / Food**: $\text{Max Stack} = \mathbf{20}$ (preserves combat preparation and resource management).
    - **Crafting Materials / Monster Parts / Ores / Herbs**: $\text{Max Stack} = \mathbf{50}$ (supports harvesting and farming without choking slots).
    - **Ammunition / Projectiles**: $\text{Max Stack} = \mathbf{50}$.
    - **Equipment & Weapons (`is_stackable = false`)**: Cannot stack; occupies slots equal to `items.size` (default 1).
  - **Stack Overflow Behavior**:
    - When picking up an item that exceeds the current stack limit (e.g., player has 20 Potions and loots 3 more), the excess 3 items will start a new stack in an empty slot if available.
    - If inventory has zero empty slots, the overflow cannot be collected (loot warning in combat log).

---

## Scope break down:

### Scope 1: Database Schema & Migration for Loot Tables
- Add `loot_drop_groups` and `loot_drop_group_items` models to `src/prisma/schema.prisma` (and models directory).
- Add `loot_drop_group_id` relation to `npc_monsters`.
- Seed initial starter loot groups for Lv 1–10 monsters (e.g. Small Beast, Bandit, Wolf).

### Scope 2: Server-Side Drop Rolling Engine
- Implement authoritative helper `rollMonsterLoot(monster)` in server logic:
  - Fetch monster's loot group and items.
  - Roll percentage chances and determine quantities.
  - Roll gold range.
- Implement encounter aggregator `rollEncounterLoot(defeatedEnemies)` to pool loot across all defeated enemies.

### Scope 3: Inventory Stacking, Stash & Backpack Upgrades
- Implement stack cap resolver based on item category (Potions: 20, Materials: 50, Gear: 1).
- Implement server mutation `applyLootRewards(characterId, rolledLoot)` wrapped in a Prisma transaction:
  - Grant gold to `players.gold`.
  - Check existing stacks for room up to `max_stack`; place overflow into empty slots.
  - Enforce `max_slots` capacity bounds.
- Provide database / logic foundation for Town Vault chest (safe-zone only access) and backpack slot expansion upgrades.

### Scope 4: Battle System & Victory Resolution Hook
- Hook loot rolling into `battleSystemCore.js` when all enemies are defeated.
- Combine rolled loot and gold with EXP rewards in the victory response.
- Add descriptive drop events into the combat log (e.g. *"Defeated Bandit dropped 1x Wooden Bow and 15 Gold"*).

### Scope 5: Client Victory Screen Presentation
- Render dropped items (with icons, names, quantities) and gold in the Victory Modal.
- Update client inventory backpack and gold count dynamically.

---

## IMPORTANT:
- Do not change inrelavent files.
- The currently UX/UI layout for admin.html is working fine and correct, do not current delete layout, just add or adjust. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:


## Implemented

