# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Plans:

### 1. Level Curve & Hard Cap (Lv 1 – 10)
- **EXP Progression Curve (Scaled for Level × Base × Multiplier, Steep Grind at Lv 7–10)**:
  - **Lv 1**: 100 EXP (~3–4 solo fights / ~1–2 pack fights)
  - **Lv 2**: 350 EXP (~4–5 solo fights / ~2–3 pack fights)
  - **Lv 3**: 850 EXP (~5–6 solo fights / ~3–4 pack fights)
  - **Lv 4**: 2,000 EXP (~7–8 solo fights / ~4–5 pack fights)
  - **Lv 5**: 5,500 EXP (~10–12 solo fights / ~6–7 pack fights) — *Milestone tier*
  - **Lv 6**: 11,500 EXP (~15–18 solo fights / ~8–10 pack fights)
  - **Lv 7**: 28,000 EXP (~25–28 solo fights / ~12–15 pack fights) — *The Wall begins*
  - **Lv 8**: 65,000 EXP (~40–45 solo fights / ~18–22 pack fights) — *Heavy grind*
  - **Lv 9**: 135,000 EXP (~55–65 solo fights / ~25–30 pack fights) — *Climax grind*
  - **Lv 10**: **CAP (LOCKED)** at 248,300 cumulative EXP. EXP gain stops, UI renders `MAX`.

### 2. Monster EXP Reward Formula
- **Core Formula**:
  $$\text{Monster EXP} = \text{Monster Level} \times \text{Base EXP} \times \text{Multiplier}$$
  - **Normal mob**: $1.0\times$
  - **Elite / Tough mob**: $1.5\times$
  - **Boss / Named NPC**: $2.5\times - 3.0\times$
- **Total Encounter EXP (Additive Sum, No Penalties)**:
  $$\text{Total Encounter EXP} = \sum_{\text{enemy} \in \text{defeated}} (\text{enemy.level} \times \text{enemy.base\_exp} \times \text{enemy.multiplier})$$
- **Example Mixed Pack**:
  - 1× Bandit Normal Lv 5 (Base 100 EXP): $5 \times 100 \times 1.0 = 500\text{ EXP}$
  - 1× Elite Bandit Lv 8 (Base 230 EXP, $1.5\times$): $8 \times 230 \times 1.5 = 2,760\text{ EXP}$
  - **Total Earned**: $500 + 2,760 = \mathbf{3,260\text{ \textbf{EXP}}}$
- **No Level Penalty**: Players receive full earned EXP regardless of level difference; the scaled table naturally governs progression balance.

### 3. Level-Up Growth & Rewards
- **Attribute Spend Budget**: $+5$ points added to `players.current_point_spend` per level.
- **Proficiency Tier Scaling**:
  - Lv 1–4: Proficiency = 2
  - Lv 5–8: Proficiency = 3
  - Lv 9–10: Proficiency = 4
- **Spell Slots (`character_spellpoints`) Expansion**:
  - Lv 1–2: $2 \times$ Level 1 slots
  - Lv 3–4: $3 \times$ Level 1 slots, $1 \times$ Level 2 slot
  - Lv 5–7: $4 \times$ Level 1 slots, $2 \times$ Level 2 slots
  - Lv 8–10: $4 \times$ Level 1 slots, $3 \times$ Level 2 slots, $1 \times$ Level 3 slot
- **Full Recovery**: Level-up fully restores `current_hp = max_hp` and `current_energy = max_energy`.

---

## Scope break down:

### Scope 1: Level Progression Config & Server Math
- Create progression config with scaled EXP threshold table, level 10 cap (248,300 cumulative EXP), and proficiency tier mapping.
- Implement server helper `calculateExpReward(defeatedEnemies)` evaluating $\sum (\text{enemy.level} \times \text{enemy.base\_exp} \times \text{enemy.multiplier})$ (no level penalty).
- Implement authoritative function `evaluateLevelUp(currentLevel, currentExp, gainedExp)` returning new level, remaining EXP, and level-up count.

### Scope 2: Persistence & Level-Up Mutation Transaction
- Create server mutation `applyLevelRewards(userId, gainedExp)` in a database transaction:
  - Increment `characters.current_exp` (clamped to max cap at Lv 10).
  - If level increases: increment `characters.level`, add $+5$ per level to `players.current_point_spend`.
  - Update `character_stats.proficiency` according to the new tier.
  - Upsert `character_spellpoints` to grant newly unlocked spell slots.
  - Reset `current_hp = max_hp` and `current_energy = max_energy`.

### Scope 3: Battle System Victory Integration
- Hook victory detection in `battleSystemCore.js` when all enemies reach 0 HP.
- Compute encounter EXP reward by evaluating monster formula for all defeated enemies.
- Execute progression mutation on the victorious player.
- Return EXP gained, new level status, and level-up events in the battle action response and combat log.

### Scope 4: Client HUD & Battle Victory Screen
- Update player HUD / character sheet to display dynamic EXP bar (`current_exp / target_exp`) and percentage.
- Render `MAX` badge on reaching Level 10.
- Enhance post-battle UI with a Victory result modal showing earned EXP and level-up fanfare.

## IMPORTANT:
- Do not change inrelavent files.
- The currently UX/UI layout for admin.html is working fine and correct, do not current delete layout, just add or adjust. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 



## Implemented

