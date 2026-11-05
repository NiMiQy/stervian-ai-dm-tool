# Status Effect Combat Development Plan

## 1. Overview & Goal

Build an authoritative, turn-based **Status Effect Engine** in `battleSystemCore.js` with persistence support in `character_effects`. The system governs crowd control, stat debuffs, and damage-over-time (DoT) while preventing exploit loops (e.g., infinite stun-locking).

Core Status Effects covered:
- `STUN` (Hard Crowd Control)
- `DAZE` (Initiative Debuff)
- `WEAK` (Vulnerability Debuff)
- `BLIND` (Accuracy Debuff)
- `POISON` (Stackable Earth-Mitigated DoT)

---

## 2. Core Formulas & Status Rules

### Common Application Success Formula
Every offensive status effect application rolls against target resistance:

$$\text{Chance (\%)} = \text{clamp}\Big(\text{Base Chance} + (\text{CON}_{\text{Attacker}} \times 2) - \text{statusResist}_{\text{Defender}}, 5, 95\Big)$$

- **Roll**: `Math.random() * 100 < Chance`.
- **`statusResist`**: Derived in `battleSystemCore.js` from Defender's `constitution`, `strength`, and item bonuses.
- **Clamp [5%, 95%]**: Guarantees a 5% lucky minimum and prevents 100% guaranteed exploitation.

---

### Detailed Effect Specifications

| Effect | Duration | Effect Trigger / Impact | Stacking & Refresh Rules |
| :--- | :---: | :--- | :--- |
| **`STUN`** | **1 Turn** | Target completely skips their action when their turn starts. | **No Stacking, No Extension.** If target is already stunned, incoming Stun rolls deal skill damage only; duration remains 1. |
| **`DAZE`** | **3 Turns** | Target loses **30% current Initiative** ($\times 0.7$). Moves later in turn order. | **Refresh Duration to 3.** No turn stacking, no stat penalty stacking. |
| **`WEAK`** | **3 Turns** | Target takes **+30% bonus damage** from all incoming attacks. | **Refresh Duration to 3.** Applied from the next incoming attack. No vulnerability stacking. |
| **`BLIND`** | **2 Turns** | Attacker incurs a **75% miss chance** (only 25% hit success) when attacking. | **Refresh Duration to 2.** No turn stacking, no miss chance stacking. |
| **`POISON`** | **3 Turns** | Deals DoT at start of target's turn. Mitigated by `earthResist`. | **Stackable Damage, Refresh Duration to 3.** Sát thương cộng dồn: $\text{dmg}_{\text{new}} = \text{dmg}_{\text{current}} + \text{dmg}_{\text{hit}}$. |

#### Poison Damage Mitigation Formula
$$\text{Actual Poison Damage} = \max\left(1, \text{Math.round}\left(\text{Accumulated Value} \times \left(1 - \frac{\text{target.earthResist}}{100}\right)\right)\right)$$

---

## 3. Database Schema State & Delta

### Current Status
- `effects`: Pre-seeded with `STUN`, `DAZE`, `WEAK`, `BLIND`, `POISON`.
- `character_stats`: Pre-equipped with `constitution`, `status_resistant`, and `earth_element_resistant`.
- `character_effects`: Uses composite key `@@id([effect_id, character_id])`. Because all effects refresh duration on a single consolidated row per character, this composite key remains valid and performant.

### Required Schema Addition
Only **one field addition** is required in `src/prisma/models/character_effects.prisma`:

```prisma
model character_effects {
  effect_id     Int
  character_id  Int
  duration_turn Int?      @default(0)
  applied_value Int?      @default(0) // Accumulates dynamic Poison DoT (0 for Stun/Daze/Weak/Blind)
  created_at    DateTime? @default(now()) @db.DateTime(0)
  updated_at    DateTime? @updatedAt @db.DateTime(0)
  deleted       Boolean?  @default(false)

  effect    effects    @relation(fields: [effect_id], references: [id])
  character characters @relation(fields: [character_id], references: [id])

  @@id([effect_id, character_id])
}
```

*Optional*: Add `proc_chance Float? @default(1.0)` to `skill_effects.prisma` if configuring skill base rates in the database; otherwise configure per skill in application code.

---

## 4. Combat Runtime Architecture (`battleSystemCore.js`)

In active combat, status effects are stored on unit objects inside `combat_sessions.battle_state`:

```javascript
unit.statuses = [
  { type: 'STUN', duration: 1, value: 0 },
  { type: 'DAZE', duration: 3, value: 0.3 },
  { type: 'WEAK', duration: 3, value: 0.3 },
  { type: 'BLIND', duration: 2, value: 0.75 },
  { type: 'POISON', duration: 3, value: 15 } // 15 total accumulated DoT
];
```

### Turn Lifecycle Integration

```
Turn Selected: Actor
       |
       v
[1. PRE-ACTION (Turn Start Tick)]
  - Has POISON? -> Calculate mitigated dmg via earthResist -> applyDamage() -> duration - 1
  - Actor Dead? -> finishUnit() -> nextTurn()
  - Has STUN?   -> duration - 1 (cleared) -> Log skip -> nextTurn() immediately
       |
       v
[2. ACTION PHASE]
  - Actor Has BLIND? -> Roll 75% miss -> if miss, cancel damage/effects -> return
  - Target Has WEAK? -> Total damage *= 1.3 (+30%)
  - On-Hit Status Proc -> calculateEffectSuccess()
      * STUN:   If already active -> ignore; else duration = 1
      * DAZE:   duration = 3; reduce initiative by 30%
      * WEAK:   duration = 3
      * BLIND:  duration = 2
      * POISON: value += skillPoisonDmg; duration = 3
       |
       v
[3. POST-ACTION (Turn End Tick)]
  - Decrement active durations for DAZE, WEAK, BLIND
  - Remove expired statuses (duration <= 0)
  - Restore base initiative when DAZE expires
```

---

## 5. Development Roadmap

1. **Schema Migration**: Add `applied_value` to `character_effects.prisma`, validate via `npx prisma validate`, update MariaDB column.
2. **Engine Helpers**: Add `calculateEffectSuccess()`, `applyStatusEffect()`, and `processTurnStartStatuses()` to `battleSystemCore.js`.
3. **Turn Loop Hookup**:
   - Inject Turn Start hook in `nextTurn()` and `runNpcTurns()`.
   - Inject Accuracy roll in `damage()` for `BLIND`.
   - Inject Damage amplifier in `damage()` for `WEAK`.
4. **Testing & Verification**:
   - Verify Bash applies 1-turn Stun and second Bash does not extend Stun.
   - Verify consecutive Poisons accumulate DoT and refresh duration to 3.
   - Verify Poison damage reduction against targets with varied `earthResist`.
   - Verify Daze drops initiative position in the turn queue.
