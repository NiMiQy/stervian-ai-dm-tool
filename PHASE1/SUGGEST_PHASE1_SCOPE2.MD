# Skill Damage Formulas and Calculation Flow

## Shared Derived Formulas

```text
physicalPower = STR + 0.5 × DEX + 0.5 × proficiency

magicPower = INT + 0.5 × WIS + 0.5 × CHAR + 0.5 × proficiency

spellAmpPercent = min(50, 0.5 × max(0, INT - 5))

spellMultiplier = 1 + spellAmpPercent / 100
```

```text
activeArmorAmplifier = max(
  0,
  activeDefenseSkill.armor_amplifier ?? 1.0
)

activeMagicArmorAmplifier = max(
  0,
  activeDefenseSkill.magic_armor_amplifier ?? 1.0
)

effectiveTargetArmor = max(
  0,
  targetArmor × activeArmorAmplifier
)

effectiveTargetMagicArmor = max(
  0,
  targetMagicArmor × activeMagicArmorAmplifier
)

armorMultiplier = 100 / (100 + effectiveTargetArmor)

magicArmorMultiplier = 100 / (100 + effectiveTargetMagicArmor)

effectiveElementResistance = clamp(targetElementResistance, -50, 75)

elementResistanceMultiplier = 1 - effectiveElementResistance / 100
```

When no defensive skill is active, both defensive amplifiers use `1.0`, so effective Armor and Magic Armor equal their normal derived values. Only the defender's active `DEFEND` skill supplies these amplifiers; never use amplifier fields from the attacking skill.

## `DEFEND` Armor Formulas

`DEFEND` does not deal damage. It activates a defensive stance whose amplifiers affect matching incoming damage components.

```text
effectiveTargetArmor = max(
  0,
  targetArmor × armor_amplifier
)

effectiveTargetMagicArmor = max(
  0,
  targetMagicArmor × magic_armor_amplifier
)

physicalDamageReductionPercent =
  100 × effectiveTargetArmor / (100 + effectiveTargetArmor)

magicDamageReductionPercent =
  100 × effectiveTargetMagicArmor / (100 + effectiveTargetMagicArmor)
```

```text
armor_amplifier = 1.0        -> normal Armor
armor_amplifier = 1.5        -> 150% effective Armor
magic_armor_amplifier = 2.0  -> 200% effective Magic Armor
```

The defensive amplifier changes effective defense, not damage directly. It does not reduce elemental damage; elemental components continue to use their matching elemental resistance.

## `ATTACK` Damage Formula

`ATTACK` is a physical action such as Basic Strike. It does not consume a Spell Point.

```text
rawPhysicalComponent = physicalPower × attack_amplifier

finalPhysicalComponent = max(
  1,
  floor(
    rawPhysicalComponent
    × 100 / (100 + effectiveTargetArmor)
  )
)

finalDamage = finalPhysicalComponent
```

## `MAGIC_ATTACK` Damage Formulas

`MAGIC_ATTACK` is a repeatable basic mage action. It does not consume a Spell Point and does not receive `spellMultiplier`.

### Non-elemental Magic Attack

```text
rawMagicComponent = magicPower × magic_attack_amplifier

finalMagicComponent = max(
  1,
  floor(
    rawMagicComponent
    × 100 / (100 + effectiveTargetMagicArmor)
  )
)

finalDamage = finalMagicComponent
```

### Elemental Magic Attack

Use this formula for a repeatable elemental action such as Fire Bolt.

```text
rawElementComponent =
  magicPower × magic_attack_amplifier
  + skillElementDamage

finalElementComponent = max(
  1,
  floor(
    rawElementComponent
    × (1 - clamp(targetElementResistance, -50, 75) / 100)
  )
)

finalDamage = finalElementComponent
```

Fire Bolt specialization:

```text
rawFireComponent =
  magicPower × magic_attack_amplifier
  + fire_damage

finalFireComponent = max(
  1,
  floor(
    rawFireComponent
    × (1 - clamp(targetFireResistance, -50, 75) / 100)
  )
)

finalDamage = finalFireComponent
```

## `SPELL` Damage Formulas

`SPELL` consumes a Spell Point and receives `spellMultiplier`.

### Pure Elemental Spell — Recommended for Fireball

The caster's `magicPower` scales the spell, but the complete result uses the spell's element as its damage type.

```text
rawElementSpellComponent =
  (
    magicPower × magic_attack_amplifier
    + skillElementDamage
  )
  × spellMultiplier

finalElementSpellComponent = max(
  1,
  floor(
    rawElementSpellComponent
    × (1 - clamp(targetElementResistance, -50, 75) / 100)
  )
)

finalDamage = finalElementSpellComponent
```

Advanced Fireball specialization:

```text
rawFireComponent =
  (
    magicPower × magic_attack_amplifier
    + fire_damage
  )
  × spellMultiplier

finalFireComponent = max(
  1,
  floor(
    rawFireComponent
    × (1 - clamp(targetFireResistance, -50, 75) / 100)
  )
)

finalDamage = finalFireComponent
```

### Non-elemental Spell

```text
rawMagicComponent =
  magicPower
  × magic_attack_amplifier
  × spellMultiplier

finalMagicComponent = max(
  1,
  floor(
    rawMagicComponent
    × 100 / (100 + effectiveTargetMagicArmor)
  )
)

finalDamage = finalMagicComponent
```

### Hybrid Magic and Elemental Spell

Use this only when the skill is intentionally defined to deal two damage types, such as Arcane Flame. Calculate and reduce each component separately.

```text
finalMagicComponent = floor(
  magicPower
  × magic_attack_amplifier
  × spellMultiplier
  × 100 / (100 + effectiveTargetMagicArmor)
)

finalElementComponent = floor(
  skillElementDamage
  × magic_attack_amplifier
  × spellMultiplier
  × (1 - clamp(targetElementResistance, -50, 75) / 100)
)

finalDamage = max(
  1,
  finalMagicComponent + finalElementComponent
)
```

Hybrid Fire specialization:

```text
finalMagicComponent = floor(
  magicPower
  × magic_attack_amplifier
  × spellMultiplier
  × 100 / (100 + effectiveTargetMagicArmor)
)

finalFireComponent = floor(
  fire_damage
  × magic_attack_amplifier
  × spellMultiplier
  × (1 - clamp(targetFireResistance, -50, 75) / 100)
)

finalDamage = max(
  1,
  finalMagicComponent + finalFireComponent
)
```

## Multiple Element Formula

Calculate every non-zero elemental field separately with its matching target resistance.

```text
for each element where skillElementDamage[element] > 0:
  rawElementComponent[element] =
    skillElementDamage[element]
    × magic_attack_amplifier
    × spellMultiplier

  finalElementComponent[element] = floor(
    rawElementComponent[element]
    × (
        1
        - clamp(targetElementResistance[element], -50, 75) / 100
      )
  )

finalMagicComponent = 0 when the skill has no Magic component

finalDamage = max(
  1,
  finalMagicComponent
  + sum(finalElementComponent[element])
)
```

## Damage Calculation Flow

```text
Player selects skill and target
  -> Server receives only attacker ID, target ID, and skill ID
  -> Load authoritative attacker, target, skill, equipment, and active statuses
  -> Validate battle, turn, target, learned skill, cooldown, and resource cost
  -> Stop if attacker has a blocking status
       Dead / Knocked Out
       Stunned
       Silenced when using MAGIC_ATTACK or SPELL
       Disarmed when using a weapon-required ATTACK
  -> Determine SkillType
       ATTACK
       MAGIC_ATTACK
       DEFEND
       SPELL
  -> Check resource availability
       ATTACK: no Spell Point
       MAGIC_ATTACK: no Spell Point; optional Energy cost
       DEFEND: no Spell Point; optional Energy cost
       SPELL: consume the required Spell Point
  -> If SkillType is DEFEND
       activate the skill's armor_amplifier
       activate the skill's magic_armor_amplifier
       apply its duration/status rules
       deal no direct damage
       save the stance and advance the battle turn
  -> Calculate attacker derived power
       physicalPower
       magicPower
       spellMultiplier for SPELL only
  -> Build raw damage component or components
       Physical
       Magic
       Fire / Ice / Earth / Lightning / Wind / Holy / Dark
  -> Apply attacker status modifiers to raw components
       Weakened
       Empowered
       Elemental bonus
       Critical modifier
  -> Check target defensive statuses
       Defending
       Vulnerable
       Magic Barrier
       Elemental weakness or resistance
       Invulnerable
  -> Calculate effective defenses from the active DEFEND skill
       effectiveTargetArmor = targetArmor × armor_amplifier
       effectiveTargetMagicArmor = targetMagicArmor × magic_armor_amplifier
       default each amplifier to 1.0 when no DEFEND skill is active
  -> Select one matching defense for each damage component
       Physical component -> effectiveTargetArmor
       Magic component -> effectiveTargetMagicArmor
       Fire component -> targetFireResistance
       Ice component -> targetIceResistance
       Other element -> matching elemental resistance
  -> Calculate each reduced component
       Do not apply Armor to Magic or elemental damage
       Do not apply Magic Armor to Physical or elemental damage
       Do not apply elemental resistance to Physical or non-elemental Magic damage
  -> floor each reduced component once
  -> sum all reduced components
  -> apply final shields, absorption, or damage immunity
  -> finalDamage = max(0, damageAfterShield)
  -> targetCurrentHP = max(0, targetCurrentHP - finalDamage)
  -> resolve damage-triggered effects and statuses
  -> atomically save resource cost, HP, statuses, and battle turn
  -> return final output
       damage type breakdown
       final total damage
       attacker resources
       target current HP
       applied or resisted effects
       combat narration data
```

## Final Output Shape

Defensive action:

```text
{
  armor_amplifier: activeArmorAmplifier,
  magic_armor_amplifier: activeMagicArmorAmplifier,
  effective_armor: effectiveTargetArmor,
  effective_magic_armor: effectiveTargetMagicArmor,
  total: 0
}
```

Physical attack:

```text
{
  physical: finalPhysicalComponent,
  total: finalDamage
}
```

Pure Fire spell:

```text
{
  fire: finalFireComponent,
  total: finalDamage
}
```

Hybrid Magic and Fire spell:

```text
{
  magic: finalMagicComponent,
  fire: finalFireComponent,
  total: finalDamage
}
```
