# Item Upgrading & Affix System Plan

## 1. Goal
Provide a balanced, exploit-proof progression system where players can upgrade equipment levels using gold and materials (sourced from inventory and vault), and roll equipment affixes (prefixes & suffixes) with controlled database tables.

---

## 2. Equipment Upgrading System

### Rules & Mechanics
- **Upgrade Cap**: Each item template defines its maximum upgrade limit via `items.max_upgrade_level` (e.g. Normal = +3, Rare = +5, Legendary = +10).
- **Tracking**: Tracked per inventory item via `item_inventory.current_level_upgraded` (defaults to `0`).

### The Golden Rule: Slot Multiplier Balance
> **CRITICAL BALANCE RULE:**
> Because players have **8 defensive slots** (Chest, Helmet, Gloves, Shoes, 2 Rings, Necklace, Belt) but only **1 primary weapon**, defensive items must give much smaller percentage bonuses per upgrade than weapons. Otherwise, total armor and magic armor will outgrow weapon damage by 8x, creating invincible damage sponges!

### Formula A: Linear Base Percentage Scaling (Authoritative)
Upgrading increases the item's baseline stats by a percentage tied to its equipment slot:

$$\text{Upgraded Stat} = \text{round}\left(\text{Base Stat} \times (1 + \text{Level} \times \text{Slot Rate})\right)$$

| Equipment Slot | Slot Scaling Rate (`Slot Rate`) | Stats Affected | Example at +5 Upgrade |
| :--- | :---: | :--- | :--- |
| **Two-Hand Weapon** | **$+10\%$ per level** | Phys / Magic ATK | Base 30 ATK $\to$ **45 ATK** (+15) |
| **Main-Hand Weapon** | **$+8\%$ per level** | Phys / Magic ATK | Base 20 ATK $\to$ **28 ATK** (+8) |
| **Chest Armor** | **$+3.5\%$ per level** | Armor, Magic Armor, HP | Base 20 Armor $\to$ **24 Armor** (+4) |
| **Helmet / Gloves / Boots** | **$+2.0\%$ per level** | Armor, Magic Armor, HP | Base 10 Armor $\to$ **11 Armor** (+1) |
| **Accessories (Rings, Belt, etc.)** | **$+1.5\%$ per level** | HP, Resistances, Crit | Base 20 HP $\to$ **22 HP** (+2) |

### Target Stat Increase Benchmark per +1 Level
This practical reference guide reflects the expected real in-game gains per $+1$ upgrade:

| Slot Type | Primary Stat Increase per $+1$ | Secondary Stat Increase per $+1$ |
| :--- | :--- | :--- |
| **Two-Hand Weapon** | **$+4$ to $+5$ Attack** (Phys / Magic) | — |
| **One-Hand Weapon** | **$+2$ to $+3$ Attack** (Phys / Magic) | — |
| **Chest Armor** | **$+2$ Armor / Magic Armor** | **$+10$ to $+15$ Max HP** |
| **Helmet / Boots / Gloves** | **$+1$ Armor / Magic Armor** | **$+5$ to $+8$ Max HP** |
| **Accessories (Rings, Belt)** | $0$ Armor | **$+5$ HP** or **$+1\%$ Crit / Resist** |

#### Net Impact of a Full +5 Set:
* **Total Weapon Attack gained:** $\mathbf{+8 \text{ to } +15 \text{ ATK}}$
* **Total Armor gained across all 4 armor slots:** $\mathbf{+7 \text{ Total Armor}}$
* **Total HP gained:** $\mathbf{+25 \text{ to } +35 \text{ HP}}$
* *Result:* Combat stays fast, lethal, and tactical without either side becoming an immovable sponge.

---

### Upgrade Costs & Resource Deduction
- **Gold Requirement**: Calculated using base cost and item rarity:
  $$\text{Gold Cost} = (\text{Base}(500) + \text{Rarity Cost}) \times \text{Target Level}$$
  - `NORMAL`: +100 (Total: 600 at +1)
  - `UNCOMMON`: +200
  - `RARE`: +300
  - `UNIQUE`: +500
  - `MYSTIC`: +800
  - `LEGENDARY`: +1200
  - `ANCIENT`: +2000
- **Materials Requirement (Inventory + Vault)**:
  - Upgrading requires specific crafting materials (e.g., *Weapon Upgrade Stone*, *Armor Plate*).
  - The system checks total quantity across **both** `item_inventory` and `vault_items`.
  - Deduction priority: Consumes from **Inventory first**, then automatically spills over to **Vault Storage**.


## 4. Database Schema Structure

### `items` (`src/prisma/models/items.prisma`)
```prisma
model items {
  // ...
  max_upgrade_level Int? @default(0)
}
```

## 5. Execution Flows

### Upgrade Execution Flow (`upgradeItemLevel`)
1. Verify `current_level_upgraded + 1 <= item.max_upgrade_level`.
2. Compute required Gold and Materials for `target_level`.
3. Check `player.gold >= requiredGold`.
4. Check `total_materials = inventory_count + vault_count >= requiredQuantity`.
5. Inside a single `prisma.$transaction`:
   - Decrement gold from `players.gold`.
   - Deduct materials from `item_inventory` first; if remaining > 0, deduct remainder from `vault_items`.
   - Increment `item_inventory.current_level_upgraded += 1`.
6. Return updated inventory item and recalculated character derived vitals.
