# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure
## Scope

I have updated schema items. Now, WEAPON will has that base critical.

If a character dual-wields two weapons (like Bandit Leader Kakku using two Steel Swords):

Option A (Main Hand Primary, Offhand Fractional — Recommended): 
CritChance
=
MainHand
chance
+
0.5
×
OffHand
chance
CritChance=MainHand 
chance
​
 +0.5×OffHand 
chance
​
  
CritDamage
=
MainHand
damage
+
0.25
×
OffHand
damage
CritDamage=MainHand 
damage
​
 +0.25×OffHand 
damage
​
  Prevents dual-wielding daggers from instantly hitting 
60
%
+
60%+ crit chance at Level 1.

B. Critical Multiplier Formula
In your database seed, values are stored as percentages (e.g., base_crit_damage: 100 for standard swords, 80 for daggers): 
CritMultiplier
=
1
+
(
CritDamage
100
)
CritMultiplier=1+( 
100
CritDamage
​
 )

If base_crit_damage = 100 
→
1
+
100
100
=
2.0
×
→1+ 
100
100
​
 =2.0× (Double damage, perfectly matching your prompt_helper.js rule: "If there is critical hit, double the damage").
If base_crit_damage = 80 
→
1
+
80
100
=
1.8
×
→1+ 
100
80
​
 =1.8×.
If a legendary weapon has base_crit_damage = 150 
→
1
+
150
100
=
2.5
×
→1+ 
100
150
​
 =2.5×.


## WANT TO ARCHIVE:
- A combat system has critical chance, critical dmg.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented
- **Weapon-Only Critical Stat Calculation (`src/containers/core/battleSystemCore.js`)**:
  - `equipmentBonuses()` now calculates `critChance` and `critDamage` exclusively from equipped weapons (`left_hand` as Main Hand and `right_hand` as Off Hand), ignoring non-weapon gear.
  - Implemented **Option A (Main Hand Primary, Offhand Fractional)**:
    - Dual-wield: $\text{CritChance} = \text{MainHand}_{\text{chance}} + 0.5 \times \text{OffHand}_{\text{chance}}$
    - Dual-wield: $\text{CritDamage} = \text{MainHand}_{\text{damage}} + 0.25 \times \text{OffHand}_{\text{damage}}$
    - Single weapon (or two-handed): $\text{CritChance} = \text{Weapon}_{\text{chance}}, \quad \text{CritDamage} = \text{Weapon}_{\text{damage}}$
    - No weapon: $\text{CritChance} = 0, \quad \text{CritDamage} = 0$
- **Combat Hit Critical Multiplier (`src/containers/core/battleSystemCore.js`)**:
  - In `damage()`, attacks roll against `a.critChance` (`Math.random() * 100 < a.critChance`).
  - When triggered, applies $\text{CritMultiplier} = 1 + \frac{\text{CritDamage}}{100}$ to the total damage.
  - Returns `result.isCrit` and `result.critMultiplier`.
- **Combat Logging**:
  - In `runNpcTurns()` and `performBattleAction()`, critical strikes are prefixed with `CRITICAL HIT!` in the battle log without modifying client layout or styles.
- **Verification**:
  - Verified single-wield, dual-wielding swords, dual-wielding daggers, non-weapon gear isolation, and right-hand only monster setups. All unit tests passed. Prisma schema validation passed.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.