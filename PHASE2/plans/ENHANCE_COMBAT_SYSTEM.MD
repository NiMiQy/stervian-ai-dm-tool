# Enhanced Combat & Hybrid Skill System

## Goal

Build an expressive, player-centric combat and itemization system: **"Build around your character, around your imagination."** 
Characters define identity and scaling; equipped weapons act as catalysts granting contextual combat actions (e.g., holding a Wizard Staff immediately enables `Fire Bolt` and `Ice Bolt`), while retaining a universal adventurer baseline (`Strike`).

---

## 1. Problem Statement

1. **Items are Pure Stat-Sticks**: Weapons lack direct base attack values and cannot grant combat actions.
2. **Missing Character Starter Skills**: New characters start with zero combat skills, resulting in empty battle menus.
3. **Class-Locked Thinking**: Players should not be forced into rigid archetypes; any character should be able to equip a staff to channel magic or swing a blade to cut.

---

## 2. Core Architecture

```
┌───────────────────────────────────────┐     ┌─────────────────────────────────────────┐
│     Character (Innate Identity)       │     │     Equipped Tools (Hands & Gear)       │
│  • Attributes (STR, INT, DEX, etc.)   │     │  • Wizard Staff: grants Fire/Ice Bolt   │
│  • Universal Baseline: Strike         │     │  • Greatsword: grants Basic Strike      │
│  • Permanently learned abilities      │     │  • Flat Physical / Magic Attack bonuses │
└───────────────────┬───────────────────┘     └────────────────────┬────────────────────┘
                    │                                              │
                    └──────────────────────┬───────────────────────┘
                                           ▼
                    ┌─────────────────────────────────────────────┐
                    │       Active Combat Action Pool             │
                    │   Character Skills ∪ Equipped Item Skills   │
                    └─────────────────────────────────────────────┘
```

### A. Power & Scaling Formulas
Equipped weapon bonuses add directly to character attribute scaling:

$$\text{physicalPower} = (\text{STR} + 0.5 \times \text{DEX} + 0.5 \times \text{Proficiency}) + \sum \text{physical\_attack\_bonus}$$

$$\text{magicPower} = (\text{INT} + 0.5 \times \text{WIS} + 0.5 \times \text{CHA} + 0.5 \times \text{Proficiency}) + \sum \text{magical\_attack\_bonus}$$

### B. Hybrid Skill Model
* **Universal Baseline (Character Layer)**: Every adventurer has `Basic Strike` (and `Defend`) so no combatant is ever helpless or actionless.
* **Weapon Catalysts (Item Layer)**: Equipping a weapon dynamically unlocks that weapon's combat repertoire:
  * **Wizard Staff / Wand**: Grants `Fire Bolt`, `Ice Bolt`.
  * **Swords / Blades**: Grants `Slash`, `Thrust`.
  * **Bow / Ranged**: Grants `Aimed Shot`, `Quick Shot`.
* **Dynamic Action Merging**:
  $$\text{Battle Skills} = \text{Character Innate Skills} \cup \bigcup_{\text{item} \in \text{Equipped Items}} \text{Item Skills}$$

### C. Split-Damage & Reduction Formula
Physical and magical damage channels are evaluated independently against their respective defenses:

$$\text{Damage}_{\text{physical}} = \text{round}\left( \text{rawPhysical} \times \frac{100}{100 + \text{target.armor}} \right)$$

$$\text{Damage}_{\text{magic}} = \text{round}\left( \text{rawMagic} \times \frac{100}{100 + \text{target.magicArmor}} \right)$$

$$\text{Total Damage} = \text{Damage}_{\text{physical}} + \text{Damage}_{\text{magic}} + \sum \text{Damage}_{\text{elemental}}$$

---

## 3. Scope Breakdown

### Scope 1: Database Schema
* **Item Power**: Add `physical_attack_bonus` and `magical_attack_bonus` to `src/prisma/models/item_bonus.prisma`.
* **Item-to-Skill Link**: Create `src/prisma/models/item_skills.prisma`:
  ```prisma
  model item_skills {
    item_id   Int
    skill_id  Int

    created_at DateTime? @default(now()) @db.DateTime(0)
    updated_at DateTime? @updatedAt @db.DateTime(0)
    deleted    Boolean?  @default(false)

    item  items  @relation(fields: [item_id], references: [id])
    skill skills @relation(fields: [skill_id], references: [id])

    @@id([item_id, skill_id])
  }
  ```
* Add relations to `items.prisma` and `skills.prisma`.

### Scope 2: Starter Baseline & Seed Data
* **Character Creation (`characterCreationContainer.js`)**: Automatically bind `Basic Strike` and `Defend` to `character_skills` for newly created characters.
* **Seed Data (`seed.ts`)**:
  * Link starter weapons to skills via `item_skills` (e.g., `Wooden Staff` $\rightarrow$ `Fire Bolt`, `Ice Bolt`).
  * Add base attack bonuses to starter weapons.

### Scope 3: Battle Engine (`battleSystemCore.js`)
* **Aggregate Skills**: In `makeBattle()`, collect skills from both `character.skills` and all equipped gear (`character_equipment`).
* **Fallback Safety**: Default to `Basic Strike` if active skills are somehow empty.
* **Derived Stats & Multi-Channel Damage**: Aggregate weapon attack bonuses and evaluate physical + magical channels simultaneously.

### Scope 4: UI & Tooltip Presentation
* Display weapon-granted skills and direct attack bonuses (`Physical ATK`, `Magic ATK`) in item tooltips.
* Populate the battle action menus dynamically with both character and weapon skills.
