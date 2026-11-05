# Dynamic Aggro & Threat System Plan

## 1. Overview & Goal

Establish an authoritative, server-driven **Aggro & Threat Management System** for encounters involving parties and companions in `battleSystemCore.js` and `aiDecisionContainer.js`. 

The system replaces rigid or semi-random targeting with an organic threat hierarchy driven by:
1. **Real Damage & Opening Engagement**
2. **Virtual Threat Multipliers (Flat Aggro on Skills)**
3. **Hard Taunt Overrides (with Turn Durations & Multi-Taunter Tie-Breakers)**
4. **Predator Instinct (Opportunistic targeting of low Max HP / squishy targets)**

> **Design Principle**: Items and passive buffs provide baseline stats and attack power, but do not track artificial item-aggro meters. Aggro is purely governed by active combat performance, skill properties, and core attributes.

---

## 2. Target Selection Hierarchy

When an NPC enemy selects a hostile target in `chooseNpcAction()`, it evaluates living opponents in strict hierarchical order:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Target Selection Order                          │
│                                                                        │
│  1. Active Taunt Lock?  ──────────────► Yes: Focus Taunter             │
│            │                                  (Tie-break if multiple)  │
│            ▼ No                                                        │
│  2. Damage / Virtual Threat (ETS) ───► Highest Threat gets marked      │
│            │                                                           │
│            ▼ Threat Tied / Unestablished                               │
│  3. Predator Instinct ───────────────► Focus Lowest Max HP (Squishy)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Metrics & Formulas

Each enemy tracks an **Effective Threat Score (ETS)** per living party member:

```javascript
enemy.threatTable = {
  "player": 100,
  "companion_1": 240
};
enemy.tauntLock = null; // Or { targetId, turnsRemaining, dominanceScore }
```

### A. Real Damage & Instant Marking
Every point of resolved damage dealt to an enemy increases the attacker's ETS on that enemy:

$$\Delta\text{ETS} = \text{Actual Damage Dealt}$$

* **Example (Ranger vs. Warrior)**:
  * Warrior hits for **100 dmg** $\rightarrow$ Warrior ETS = **100**. Enemy focuses Warrior.
  * Ranger shoots an arrow for **101 dmg** $\rightarrow$ Ranger ETS = **101**.
  * Since $101 > 100$, the enemy marks the **Ranger** as the highest threat and switches target next turn.

### B. Opening Engagement: First Strike Bonus
The first combatant who lands a damaging strike on an enemy receives a one-time **$+20\%$ First Strike Threat Bonus**:

$$\text{Initial ETS} = \lfloor \text{Damage} \times 1.20 \rfloor$$

This anchors opening focus onto the party's initiator and prevents mobs from wandering before other allies act.

---

## 4. Virtual Threat: Flat Aggro Multipliers

Pure damage dealers (e.g., Sorceress) naturally generate large damage spikes. Tanks hold aggro without requiring inflated real damage by using skills with an **Aggro Multiplier** (`aggro_multiplier`):

$$\Delta\text{ETS} = \lfloor \text{Actual Damage Dealt} \times \text{aggro\_multiplier} \rfloor$$

* **Real Enemy HP Loss**: Remains strictly equal to `Actual Damage Dealt`.
* **Enemy Threat Perception**: Scales by `aggro_multiplier`.

### Example (Sorceress vs. Tank Warrior):
* **Sorceress**: Casts high-tier magic dealing **150 real damage** (Multiplier = $1.0\times$):
  * Enemy HP lost: $150$
  * Threat added: $+150$ ETS
* **Warrior**: Uses a threat-generating strike dealing **80 real damage** with an **Aggro Multiplier of $3.0\times$**:
  * Enemy HP lost: $80$
  * Virtual Threat added: $80 \times 3.0 = \mathbf{+240\text{ ETS}}$
* **Outcome**: $240\text{ (Warrior)} > 150\text{ (Sorceress)}$. The enemy switches focus to the Warrior, protecting the Sorceress.

---

## 5. Taunt Skills: Duration & Multi-Warrior Conflict

A **Taunt** skill forces the enemy to mark the taunter as their exclusive target for a set duration (e.g., **5 turns**).

### A. Taunt Lock State
```javascript
enemy.tauntLock = {
  targetId: 'player',
  turnsRemaining: 5,
  dominanceScore: 145
};
```
* As long as `turnsRemaining > 0`, the enemy ignores ETS and standard target selection, focusing solely on `targetId`.
* `turnsRemaining` decrements by 1 at the end of each round/turn cycle.
* When `turnsRemaining === 0`, the lock expires and targeting reverts to the highest ETS.

### B. Multi-Warrior Taunt Tie-Breaker
If two or more warriors taunt the same enemy, the enemy resolves the conflict using a strict **Dominance Priority Hierarchy**:

$$\text{Dominance Score} = (\text{Level} \times 10) + (\text{CON} \times 2.0) + (\text{STR} \times 1.5) + (\text{CHA} \times 1.0)$$

1. **Higher Cumulative Threat (ETS)** on this enemy.
2. **Character Level** (if ETS is tied).
3. **Dominance Score** based on `CON`, `STR`, and `CHA` (if Level is tied):
   * **CON (Constitution)**: Weight $2.0$ — Physical mass and defensive presence.
   * **STR (Strength)**: Weight $1.5$ — Direct physical intimidation.
   * **CHA (Charisma)**: Weight $1.0$ — Commanding roar and battlefield voice.
4. **Current Remaining HP** (final fallback).

The warrior with superior standing overwrites or maintains the `tauntLock`.

---

## 6. Predator Instinct: Squishy / Healer Vulnerability

Healers who invest heavily into `INT`, `WIS`, and `CHA` sacrifice `CON` and `STR`, resulting in the **lowest Max HP** in the party.

Enemies naturally possess predatory survival instincts:
* **When Active**: Triggers when no active `tauntLock` exists and no party member has established a dominant threat gap ($\text{ETS} \le \text{Threshold}$).
* **Behavior**: The enemy identifies the living combatant with the lowest `max_hp` and targets them as an easy kill.

$$\text{Predator Target} = \arg\min_{u \in \text{livingParty}} (u.\text{max\_hp})$$

* **Protection Mechanism**: The moment a Warrior taunts or lands a high-multiplier attack ($240 > 150$), the enemy's attention is pulled away from the Healer.

---

## 7. Decoupling NPC Companion Tactics Roles from Aggro

In `partyContainer.js`, party members support tactics:
`['BALANCED', 'TANK', 'HEALER', 'AGGRESSIVE', 'SUPPORT']`.

* **Role Purpose**: Tactics roles dictate **skill selection** (e.g., an NPC with `TANK` prioritizes Defend and Taunt skills; `HEALER` prioritizes healing spells).
* **Zero Artificial Aggro**: Assigning `TANK` to a low-CON, low-HP Healer **does not** give them threat resistance or monster focus. They will attempt tank behaviors, but will still be treated according to their actual stats and damage output, and may die rapidly due to their low Max HP.

---

## 8. Technical Implementation Architecture

### Component 1: Battle Core Engine (`src/containers/core/battleSystemCore.js`)
1. **Combatant Initialization (`makeBattle`)**:
   - Initialize `threatTable: {}` and `tauntLock: null` on each enemy combatant instance.
2. **Threat Updates (`applyDamage`)**:
   - Extract `aggro_multiplier` from `skill` (default `1.0`).
   - Calculate threat: `threat = Math.round(damage * multiplier)`.
   - Apply First Strike bonus ($+20\%$) if enemy has not yet taken damage in the battle.
   - Increment `enemy.threatTable[attacker.id]`.
3. **Taunt Resolution**:
   - Handle Taunt skills by computing `dominanceScore` and establishing or refreshing `enemy.tauntLock`.
4. **Turn Progression & Cleanup (`nextTurn` / `finishUnit`)**:
   - Decrement `enemy.tauntLock.turnsRemaining` at round end.
   - Zero out an actor's threat across all enemies upon reaching $0$ HP (`isDefeated = true`).
5. **Persistence**:
   - Automatically serialized in `combat_sessions.battle_state` JSON without requiring database migrations.

### Component 2: AI Decision Container (`src/containers/aiDecisionContainer.js`)
1. **Target Selection (`chooseNpcAction`)**:
   - Check `actor.tauntLock` first.
   - If no valid lock, locate `highestThreatTarget` in `actor.threatTable`.
   - If threat is unestablished (e.g., round 1 before attacks), fallback to lowest `max_hp` living party member.

### Component 3: Database & Skills Data (`src/prisma/models/skills.prisma` & `seed.ts`)
1. **Schema Field**:
   - `aggro_multiplier Float? @default(1.0)` in `skills.prisma`.
2. **Seed Skills**:
   - `Taunt`: `type: 'DEFEND'`, `duration: 5`, `skill_target_rule: 'ON_SELECTED_ENEMY'`.
   - `Heavy Strike` / `Shield Slam`: `aggro_multiplier: 2.5` to `3.0`.

---

## 9. Acceptance Criteria

1. **Damage Aggro Switch**: Ranger dealing 101 damage overtakes Warrior dealing 100 damage; enemy shifts focus to Ranger.
2. **Virtual Threat Multiplier**: Warrior dealing 80 damage with $\times 3.0$ multiplier generates 240 ETS and holds aggro over a Sorceress dealing 150 damage ($\times 1.0$).
3. **Taunt Lock**: Taunt forces enemy focus for exactly 5 turns, ignoring damage-based threat.
4. **Taunt Tie-Breaker**: When 2 warriors taunt the same mob, the higher level / higher `CON`+`STR`+`CHA` warrior retains the lock.
5. **Predator Instinct**: In unthreatened opening combat, enemy focuses lowest `max_hp` squishy party member.
6. **Tactics Independence**: Assigning `TANK` role to a squishy companion changes their action choices but does not grant artificial threat.
