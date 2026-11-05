import ambienceFiguresTable from '../ambience_figures/ambience_figures.js';
import ambiencesTable from '../ambiences/ambiences.js';
import characterEffectsTable from '../character_effects/character_effects.js';
import characterInventoryTable from '../character_inventory/character_inventory.js';
import characterItemBonusTimeTable from '../character_item_bonus_time/character_item_bonus_time.js';
import characterItemsTable from '../character_items/character_items.js';
import characterLifeskillsTable from '../character_lifeskills/character_lifeskills.js';
import characterMemoriesTable from '../character_memories/character_memories.js';
import characterQuestsTable from '../character_quests/character_quests.js';
import characterRecipesTable from '../character_recipes/character_recipes.js';
import characterScenesTable from '../character_scenes/character_scenes.js';
import characterSkillsTable from '../character_skills/character_skills.js';
import characterSpellpointsTable from '../character_spellpoints/character_spellpoints.js';
import characterStatsTable from '../character_stats/character_stats.js';
import characterVaultsTable from '../character_vaults/character_vaults.js';
import charactersTable from '../characters/characters.js';
import combatSessionsTable from '../combat_sessions/combat_sessions.js';
import craftingRecipeIngredientsTable from '../crafting_recipe_ingredients/crafting_recipe_ingredients.js';
import craftingRecipesTable from '../crafting_recipes/crafting_recipes.js';
import dialogueMessagesTable from '../dialogue_messages/dialogue_messages.js';
import dialogueParticipantsTable from '../dialogue_participants/dialogue_participants.js';
import dialogueSessionsTable from '../dialogue_sessions/dialogue_sessions.js';
import effectsTable from '../effects/effects.js';
import itemBonusTable from '../item_bonus/item_bonus.js';
import itembonusEffectsTable from '../itembonus_effects/itembonus_effects.js';
import itemsTable from '../items/items.js';
import lifeskillsTable from '../lifeskills/lifeskills.js';
import locationAmbienceStatesTable from '../location_ambience_states/location_ambience_states.js';
import locationRoutesTable from '../location_routes/location_routes.js';
import locationWeathersTable from '../location_weathers/location_weathers.js';
import locationsTable from '../locations/locations.js';
import locationsLootgroupsTable from '../locations_lootgroups/locations_lootgroups.js';
import lootGroupsTable from '../loot_groups/loot_groups.js';
import lootgroupsItemsTable from '../lootgroups_items/lootgroups_items.js';
import npcKnownLocationsTable from '../npc_known_locations/npc_known_locations.js';
import npcMonstersTable from '../npc_monsters/npc_monsters.js';
import npcRelationshipsTable from '../npc_relationships/npc_relationships.js';
import npcmonstersLootgroupsTable from '../npcmonsters_lootgroups/npcmonsters_lootgroups.js';
import npcsTable from '../npcs/npcs.js';
import npcsInLocationsOrSublocationsTable from '../npcs_in_locations_or_sublocations/npcs_in_locations_or_sublocations.js';
import partiesTable from '../parties/parties.js';
import partyInvitesTable from '../party_invites/party_invites.js';
import partyMembersTable from '../party_members/party_members.js';
import playerNpcRelationshipsTable from '../player_npc_relationships/player_npc_relationships.js';
import playersTable from '../players/players.js';
import prefixesTable from '../prefixes/prefixes.js';
import questsTable from '../quests/quests.js';
import regionsTable from '../regions/regions.js';
import skillEffectsTable from '../skill_effects/skill_effects.js';
import skillWeaponTypesTable from '../skill_weapon_types/skill_weapon_types.js';
import skillsTable from '../skills/skills.js';
import skillsInItemsTable from '../skills_in_items/skills_in_items.js';
import storiesTable from '../stories/stories.js';
import sublocationsTable from '../sublocations/sublocations.js';
import sublocationsItemsTable from '../sublocations_items/sublocations_items.js';
import suffixesTable from '../suffixes/suffixes.js';
import usersTable from '../users/users.js';

export const MCP_TABLES = Object.freeze([
  ambienceFiguresTable,
  ambiencesTable,
  characterEffectsTable,
  characterInventoryTable,
  characterItemBonusTimeTable,
  characterItemsTable,
  characterLifeskillsTable,
  characterMemoriesTable,
  characterQuestsTable,
  characterRecipesTable,
  characterScenesTable,
  characterSkillsTable,
  characterSpellpointsTable,
  characterStatsTable,
  characterVaultsTable,
  charactersTable,
  combatSessionsTable,
  craftingRecipeIngredientsTable,
  craftingRecipesTable,
  dialogueMessagesTable,
  dialogueParticipantsTable,
  dialogueSessionsTable,
  effectsTable,
  itemBonusTable,
  itembonusEffectsTable,
  itemsTable,
  lifeskillsTable,
  locationAmbienceStatesTable,
  locationRoutesTable,
  locationWeathersTable,
  locationsTable,
  locationsLootgroupsTable,
  lootGroupsTable,
  lootgroupsItemsTable,
  npcKnownLocationsTable,
  npcMonstersTable,
  npcRelationshipsTable,
  npcmonstersLootgroupsTable,
  npcsTable,
  npcsInLocationsOrSublocationsTable,
  partiesTable,
  partyInvitesTable,
  partyMembersTable,
  playerNpcRelationshipsTable,
  playersTable,
  prefixesTable,
  questsTable,
  regionsTable,
  skillEffectsTable,
  skillWeaponTypesTable,
  skillsTable,
  skillsInItemsTable,
  storiesTable,
  sublocationsTable,
  sublocationsItemsTable,
  suffixesTable,
  usersTable
]);

export const MCP_TABLE_MAP = new Map(MCP_TABLES.map((entry) => [entry.table, entry]));
export const MCP_TABLE_NAMES = Object.freeze(MCP_TABLES.map((entry) => entry.table));
