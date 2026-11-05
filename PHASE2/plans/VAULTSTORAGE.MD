# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Plans:

### 1. Town Vault Storage Architecture (`character_vault` & `vault_items`)
- **Extraction Stash / Safe Haven**:
  - A permanent personal storage chest tied to the player character.
  - **100% Death Penalty Immunity**: When a player is killed in action, their active backpack and equipment are wiped, but all items, materials, and gold stored inside the Town Vault remain completely safe.
- **Access Rule (Safe Zone Only)**:
  - Accessible **strictly when the player is located in a safe zone / town** (e.g., Honeywood Village, `locations.subgeography` or town flag).
  - Opening the vault while in the wilderness, in dungeons, or during active combat is **forbidden and blocked on the server**.
- **Recommended Database Schema**:
  - **`character_vault`**:
    - `id`: Primary key.
    - `character_id`: Foreign key (unique, 1-to-1 with `characters.id`).
    - `max_slots`: Integer capacity (starts at **60 slots**).
    - `gold`: Stashed gold balance (banked currency safe from death wipe).
    - `created_at`, `updated_at`, `deleted`.
  - **`vault_items`**:
    - `id`: Primary key.
    - `vault_id`: Foreign key to `character_vault.id`.
    - `item_id`: Foreign key to `items.id`.
    - `quantity`: Stack quantity (respects item `max_stack`).
    - `created_at`, `updated_at`, `deleted`.

### 2. Vault Mechanics & Operations
- **Deposit (`Backpack -> Vault`)**:
  - Moves item(s) from `item_inventory` to `vault_items`.
  - Stacks into existing vault stacks up to category `max_stack` (Potions: 20, Materials: 50).
  - Consumes a vault slot for new non-stackable items or overflow stacks.
  - Enforces `vault.max_slots` capacity limit.
- **Withdraw (`Vault -> Backpack`)**:
  - Moves item(s) from `vault_items` to `item_inventory`.
  - Enforces player's active backpack capacity (`character_inventory.max_slots = 30`).
- **Gold Stashing**:
  - Allows depositing carried `players.gold` into `character_vault.gold` and vice-versa.
  - Secures currency before taking high-risk expedition runs.
- **Capacity Upgrades**:
  - Base capacity: **60 slots**.
  - Purchasable storage expansions via town vault master / bank:
    - Tier 1: +20 slots (80 total)
    - Tier 2: +20 slots (100 total)
    - Tier 3: +20 slots (120 max cap)

### 3. Vault Access Rules (Authoritative)
- **Safe Zone Only**: Accessible strictly within verified towns/safe zones; rejected (`403 Forbidden`) in wilderness or dungeons.
- **Out of Combat & Alive**: Blocked during active combat (`battle.status === 'IN_PROGRESS'`) or if character is defeated (`current_hp <= 0`).
- **Owner Verified**: Restricted to the authenticated character owner (`character.user_id === session.userId`).
- **Capacity Enforcement**:
  - Deposit rejected if vault is full and item cannot stack into an existing slot.
  - Withdraw rejected if backpack is full (`slots >= 30`) and item cannot stack.
- **Atomic Transactions**: All deposits, withdrawals, and gold transfers must execute inside `prisma.$transaction` to eliminate duping or desync.
- **Death Immunity**: Vault items and gold are 100% protected against player death, wipes, and penalties.

---

## Scope break down:

### Scope 1: Database Schema & Relations for Vault
- Add `character_vault` and `vault_items` models to `src/prisma/schema.prisma` (and models directory).
- Link `character_vault` 1-to-1 with `characters`.
- Seed or initialize default `character_vault` records (60 slots) for existing player characters.

### Scope 2: Server-Side Access Validation & Rules
- Implement validation middleware/helper `validateVaultAccess(userId)`:
  - Verifies ownership (`character.user_id === userId`).
  - Checks character vitals (`current_hp > 0`).
  - Checks combat state (blocks if active battle session exists).
  - Validates safe-zone flag on current `location_id`.
  - Returns `403 Forbidden` if any condition fails.

### Scope 3: Authoritative Transfer Mutations
- Implement `transferToVault(userId, { itemId, quantity })` wrapped in a Prisma transaction:
  - Atomically decrements/removes from `item_inventory` and inserts/stacks into `vault_items`.
- Implement `transferFromVault(userId, { itemId, quantity })` wrapped in a Prisma transaction:
  - Atomically decrements/removes from `vault_items` and inserts/stacks into `item_inventory` (checking active backpack capacity).
- Implement `transferVaultGold(userId, { amount, direction })` (deposit/withdraw).

### Scope 4: Town Vault REST API Endpoints
- `GET /api/vault`: Returns current vault contents, stashed gold, and slot capacity.
- `POST /api/vault/deposit`: Handles item deposit.
- `POST /api/vault/withdraw`: Handles item withdrawal.
- `POST /api/vault/gold`: Handles gold deposit/withdrawal.
- `POST /api/vault/upgrade`: Upgrades vault capacity with gold.

### Scope 5: Client Town Vault UI
- Create a dual-grid modal in `game.html` (`Backpack [30 slots]` on left, `Town Vault [60 slots]` on right).
- Display vault items with tooltips, quantities, and current slot usage (`used / max`).
- Add one-click "Deposit All Materials" button for fast stash management after an expedition.

---

## IMPORTANT:
- Do not change inrelavent files.
- The currently UX/UI layout for admin.html is working fine and correct, do not current delete layout, just add or adjust. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:


## Implemented

