# Prisma Structure

Prisma 7 uses MySQL. The root schema defines the client generator and datasource; models and enums are split across `src/prisma/models/`. The generated client is written to `src/generated/prisma-fixed/`.

```text
src/
├── prisma.config.ts
├── generated/prisma-fixed/   # Generated client; do not edit
└── prisma/
    ├── schema.prisma         # Generator and datasource
    ├── models/               # Models and enums, grouped by feature
    ├── updates/              # Database update scripts
    └── seed*.{ts,js}         # Seed scripts
```

## Models

- **Accounts and characters:** `users`, `players`, `characters`, `character_stats`, `character_spellpoints`, `character_vaults`, `character_inventory`, `character_items`, `character_item_bonus_time`, `character_effects`, `character_skills`, `character_lifeskills`, `character_recipes`, `character_quests`, `character_memories`, `character_scenes`
- **Items, skills and effects:** `items`, `prefixes`, `suffixes`, `item_bonus`, `itembonus_effects`, `skills`, `skills_in_items`, `skill_effects`, `skill_weapon_types`, `effects`
- **Crafting:** `lifeskills`, `crafting_recipes`, `crafting_recipe_ingredients`
- **World and loot:** `regions`, `locations`, `sublocations`, `location_routes`, `location_weathers`, `location_ambience_states`, `ambiences`, `ambience_figures`, `locations_lootgroups`, `sublocations_items`, `loot_groups`, `lootgroups_items`
- **NPCs and relationships:** `npcs`, `npc_monsters`, `npcmonsters_lootgroups`, `npcs_in_locations_or_sublocations`, `npc_known_locations`, `npc_relationships`, `player_npc_relationships`
- **Parties, combat and story:** `parties`, `party_members`, `party_invites`, `combat_sessions`, `dialogue_sessions`, `dialogue_participants`, `dialogue_messages`, `quests`, `stories`

## Enums

Defined in `models/enums.prisma`: item and equipment; skills and effects; characters and memories; NPC relationships; world, weather and ambience; parties; quests, dialogue and scenes. This includes `MemoryAddByType` and `SceneStage`.

For the authoritative fields and relations, see `src/prisma/models/*.prisma`.
