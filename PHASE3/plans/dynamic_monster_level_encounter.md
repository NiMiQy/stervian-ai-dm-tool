# Dynamic Monster Level & Encounter Scaling System

## 1. Objective
Introduce dynamic level and stat variations for monster encounters (e.g., Level 1 Rabbit spawning as Level 1 or Level 2 with enhanced attack and health) while preventing low-level exploit farming by replacing the aggressive multiplicative EXP formula with a balanced additive model (+10%–15% per level).

---

## 2. Core Design Principles

1. **In-Memory Instantiation (DB Immutability)**:
   - Base templates in MySQL (`characters`, `character_stats`) remain strictly read-only and immutable.
   - Dynamic variations are generated in memory at encounter initialization inside `makeBattle()`.

2. **Controlled Monster Ceilings (Hard Level Caps)**:
   - Mobs have strict level caps so early-game critters never scale indefinitely:
     - **Rabbit**: Levels 1–2
     - **Boar**: Levels 3–4
     - **Wolf**: Levels 4–5
     - **Bandit**: Levels 7–8
     - **Kakku**: Level 10

3. **Additive EXP Progression (Anti-Exploit)**:
   - **Problem**: Current `Math.floor(level * baseExp)` causes a +100% (2x) EXP jump between Lv 1 and Lv 2, encouraging players to farm Rabbits instead of higher-tier enemies.
   - **Solution**: Switch to an additive growth curve: $+15\%$ EXP per level above base template.

---

## 3. Formulas & Mechanics

### A. Additive EXP Formula
In `src/services/progressionService.js`:

$$\text{ExpReward} = \lfloor \text{baseExp} \times \big(1 + 0.15 \times (\text{currentLevel} - \text{baseLevel})\big) \times \text{multiplier} \rfloor$$

* **Level 1 Rabbit** ($\text{baseExp} = 20$):
  $$20 \times (1 + 0) = \mathbf{20\text{ EXP}}$$
* **Level 2 Rabbit** ($\text{baseExp} = 20$):
  $$20 \times (1 + 0.15 \times 1) = \mathbf{23\text{ EXP}}$$ *(Balanced +3 EXP instead of +20 EXP)*

### B. Dynamic Stat Growth
When a monster rolls a level increase ($\Delta\text{Level} = \text{currentLevel} - \text{baseLevel}$):
* **Strength**: $+\,2 \times \Delta\text{Level}$ $\rightarrow$ directly increases `atkDamage` and `physicalPower`.
* **Constitution**: $+\,1 \times \Delta\text{Level}$ $\rightarrow$ directly increases `maxHP`.
* **Dexterity**: $+\,1 \times \Delta\text{Level}$ $\rightarrow$ improves initiative and turn order.
* **Derived Stats**: Pass through existing `calculateDerivedStats(stats, equipment)` to automatically compute `maxHP`, `physicalPower`, and `armor`.


---

## 4. Implementation Scope

### Component 1: Progression Service (`src/services/progressionService.js`)
* Update `calculateExpReward(defeatedEnemies)`:
  - Accept `templateBaseLevel` (defaults to `1` or `enemy.templateBaseLevel`).
  - Calculate bonus via `baseExp * (1 + 0.15 * Math.max(0, level - templateBaseLevel))`.
  - Maintain compatibility with `multiplier`.

### Component 2: Battle Core Engine (`src/containers/core/battleSystemCore.js`)
* **Helper: `scaleMonsterInstance(monster, playerLevel)`**:
  - Clones monster template and rolls dynamic level within configured monster cap.
  - Applies stat deltas to `strength`, `constitution`, and `dexterity`.
  - Recalculates `max_hp` and `current_hp` via `calculateDerivedStats()`.
* **Hook in `makeBattle()`**:
  - Run `scaleMonsterInstance()` over each monster before creating `combatant()` units.
* **Rewards Integration in `resolvePlayerVictory()`**:
  - Pass `templateBaseLevel` to `calculateExpReward()`.
  - Apply the scaled multiplier to rolled loot gold.

 ---

## 5. Verification Plan

1. **DB Integrity**: Verify that MySQL `characters` and `character_stats` for template monsters remain unchanged after encounters.
2. **Combat Stat Verification**:
   - Verify Level 1 Rabbit displays base stats and HP.
   - Verify Level 2 Rabbit displays elevated HP (+4), Attack (+2), and appropriate turn initiative.
3. **EXP Formula Verification**:
   - Level 1 Rabbit kill yields 20 EXP.
   - Level 2 Rabbit kill yields 23 EXP (not 40 EXP).
4. **Combat UI Check**:
   - Battle modal enemy card renders dynamic level (`Lv. 2`) and name correctly.
