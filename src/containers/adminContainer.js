import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { hashPassword } from '../services/passwordService.js';
import { randomUUID } from 'node:crypto';
import { getAffinityStatus } from '../services/ai/subagents/relationships.js';
import { imageDataToBuffer, imageDataToUrl } from '../components/helpers/imageData.js';
import {
  AMBIENCE,
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_DESCRIPTION_MAX_LENGTH,
  ADMIN_MAX_PAGE_SIZE,
  ADMIN_USER_SORT_FIELDS,
  AFFINITY_MAX,
  AFFINITY_MIN,
  CHARACTER_SEX,
  CHARACTER_TYPE,
  CONSUME_BONUS_MODE,
  CURE_EFFECT_NONE,
  DEFAULT_BACKPACK_SLOTS,
  DEFAULT_LOCATION_TYPE,
  DEFAULT_NPC_LOCATION_KNOWLEDGE,
  DEFAULT_NPC_RELATIONSHIP_TYPE,
  DEFAULT_ROUTE_COST,
  DEFAULT_STARTING_GOLD,
  DEFAULT_SUBLOCATION_SERVICE_PRICE,
  DEFAULT_TIER,
  DEFAULT_VAULT_SLOTS,
  DEFAULT_WEAPON_TYPE,
  EQUIP_SLOT_FIELDS,
  EQUIP_SLOT_ITEM_TYPES,
  INITIAL_ATTRIBUTE_POINT_BUDGET,
  ITEM_LOCATION,
  ITEM_TRIGGER_NONE,
  LOOT_GROUP_RARITY,
  MAP_COORDINATE_MAX,
  MAP_COORDINATE_MIN,
  MAX_INT32,
  MAX_LOOT_CHANCE_PCT,
  MEMORY_TYPE,
  UNARMED_WEAPON_TYPE,
  WEAPON_TYPE,
  QUEST_STATUS,
  QUEST_TYPE,
  RARITY,
  SKILL_DAMAGE_TYPE,
  SKILL_TARGET_RULE,
  SUBLOCATION_TYPE,
  TRADING_SUBLOCATION_TYPES,
  VALID_CHARACTER_SEXES,
  VALID_LOOT_GROUP_RARITIES,
  VALID_MEMORY_TYPES,
  ANY_WEAPON_TYPE,
  CHAOS_FACTOR_MAX,
  CHAOS_FACTOR_MIN,
  DEFAULT_CHAOS_FACTOR,
  SCENE_FIELD_MAX_LENGTHS,
  SCENE_STAGE,
  VALID_SCENE_STAGES,
} from '../configs/constants.js';

const relationCharacterSelect = { select: { id: true, name: true, character_type: true, level: true } };

const characterInclude = {
  character_stat: true,
  player: {
    include: {
      player_npc_relationships: {
        where: { deleted: false },
        include: { npc_character: { include: { character: relationCharacterSelect } } }
      }
    }
  },
  npc: {
    include: {
      npc_monsters: true,
      player_npc_relationships: {
        where: { deleted: false },
        include: { player_character: { include: { character: relationCharacterSelect } } }
      },
      npc_relationships_as_source: {
        where: { deleted: false },
        include: { target_npc: { include: { character: relationCharacterSelect, npc_monsters: true } } }
      },
      npc_relationships_as_target: {
        where: { deleted: false },
        include: { source_npc: { include: { character: relationCharacterSelect, npc_monsters: true } } }
      },
      npc_known_locations: {
        where: { deleted: false },
        include: { location: true, sublocation: true }
      },
      npcs_in_locations_or_sublocations: {
        where: { deleted: false },
        include: { location: true, sublocation: true }
      }
    }
  },
  character_spellpoints: true,
  character_owner_memories: { where: { deleted: false } },
  character_lifeskills: { include: { lifeskill: true } },
  skills: { include: { skill: true } },
  effects: { include: { effect: true } },
  character_inventory: true,
  vault: true,
  character_items: {
    where: { deleted: false },
    include: { items: true, prefix: true, suffix: true },
    orderBy: { id: 'asc' }
  },
  location: { include: { region: true } },
  respawn_location: { include: { region: true } },
  sublocation: true,
  story: true,
  user: { select: { id: true, user_id: true, username: true } }
};

const itemInclude = {
  item_bonus: { include: { itembonus_effects: { where: { deleted: false }, include: { effect: true } } } },
  skills_in_items: { where: { deleted: false }, include: { skill: true } },
  character_items: {
    where: { deleted: false },
    include: { character: { select: { id: true, name: true } } }
  }
};

const lootGroupInclude = {
  items: { where: { deleted: false }, include: { items: { select: { id: true, name: true, type: true, rarity: true, is_consumable: true, is_material: true } } } },
  npcmonsters_lootgroups: {
    where: { deleted: false },
    include: { npc_monsters: { include: { npc: { include: { character: { select: { id: true, name: true, level: true } } } } } } }
  },
  locations_lootgroups: {
    where: { deleted: false },
    include: { locations: { select: { id: true, name: true } } }
  }
};

const sublocationInclude = {
  location: { include: { region: true } },
  owner: { select: { id: true, name: true, character_type: true } },
  sublocations_items: { where: { deleted: false }, include: { item: true } }
};

function fail(functionName, operation, error) { throw databaseError(functionName, operation, error); }
function number(value, fallback = null) { if (value === '' || value === null || value === undefined) return fallback; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function routeCost(value, fallback = undefined) {
  if (value === undefined && fallback !== undefined) return fallback;
  const parsed = number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_INT32) throw new Error(`Route costs must be whole numbers from 0 to ${MAX_INT32}.`);
  return parsed;
}
function mapCoordinates(input) {
  const x = input.map_x === null || input.map_x === '' ? null : number(input.map_x);
  const y = input.map_y === null || input.map_y === '' ? null : number(input.map_y);
  if ((x === null) !== (y === null) || (x !== null && (x < MAP_COORDINATE_MIN || x > MAP_COORDINATE_MAX || y < MAP_COORDINATE_MIN || y > MAP_COORDINATE_MAX))) {
    throw new Error(`Map coordinates must both be empty or between ${MAP_COORDINATE_MIN} and ${MAP_COORDINATE_MAX}.`);
  }
  return { map_x: x, map_y: y };
}
function routePair(input) {
  const first = number(input.location_a_id);
  const second = number(input.location_b_id);
  if (!Number.isInteger(first) || first <= 0 || !Number.isInteger(second) || second <= 0 || first === second) {
    throw new Error('Select two different locations for the route.');
  }
  return first < second ? [first, second] : [second, first];
}
function routeCosts(input, defaults = false) {
  return {
    energy_cost: routeCost(input.energy_cost, defaults ? DEFAULT_ROUTE_COST : undefined),
    food_cost: routeCost(input.food_cost, defaults ? DEFAULT_ROUTE_COST : undefined),
    water_cost: routeCost(input.water_cost, defaults ? DEFAULT_ROUTE_COST : undefined)
  };
}
function nullable(value) { return value === '' || value === undefined ? null : value; }
function numericObject(value = {}) { return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, number(item)])); }
function affinity(value) { return Math.trunc(Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, number(value, 0)))); }
function price(value, fallback = DEFAULT_SUBLOCATION_SERVICE_PRICE) { return Math.trunc(Math.max(0, Math.min(MAX_INT32, number(value, fallback)))); }
function normalizeSex(value) {
  if (!value) return CHARACTER_SEX.MALE;
  const upper = String(value).trim().toUpperCase();
  return VALID_CHARACTER_SEXES.includes(upper) ? upper : CHARACTER_SEX.MALE;
}
function itemBonusData(value = {}) {
  const { item_trigger_type, cure_effect_type, consume_bonus_mode, current_hp_bonus, ...numericFields } = value;
  if (current_hp_bonus !== undefined && numericFields.healing_current_hp === undefined) {
    numericFields.healing_current_hp = current_hp_bonus;
  }
  return {
    ...numericObject(numericFields),
    item_trigger_type: item_trigger_type && item_trigger_type !== ITEM_TRIGGER_NONE ? item_trigger_type : ITEM_TRIGGER_NONE,
    cure_effect_type: cure_effect_type && cure_effect_type !== CURE_EFFECT_NONE ? cure_effect_type : null,
    consume_bonus_mode: Object.values(CONSUME_BONUS_MODE).includes(consume_bonus_mode) ? consume_bonus_mode : CONSUME_BONUS_MODE.NONE
  };
}
function prefixSuffixData(input = {}) {
  const { name, rarity, tier, current_hp_bonus, ...stats } = input;
  return {
    name: nullable(name),
    rarity: rarity || RARITY.NORMAL,
    tier: tier || DEFAULT_TIER,
    ...numericObject(stats)
  };
}
const AMBIENCE_TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'ANY'];
const AMBIENCE_WEATHERS = ['CLEAR', 'SUNNY', 'RAIN', 'HEAVYRAIN', 'STORM', 'FOG', 'SANDSTORM', 'SNOW'];
const AMBIENCE_CROWD_LEVELS = ['EMPTY', 'FEW', 'SOME', 'BUSY', 'PACKED'];
const ambienceInclude = { figures: { orderBy: { id: 'asc' } }, location: { select: { id: true, name: true } }, sublocation: { select: { id: true, name: true, location_id: true } } };

function boundedInt(value, min, max, fallback) {
  return Math.trunc(Math.max(min, Math.min(max, number(value, fallback))));
}

async function ambienceData(client, input = {}) {
  const locationId = number(input.location_id);
  const sublocationId = number(input.sublocation_id);
  if (!locationId) throw new Error('Choose a location for the ambience.');
  const location = await client.locations.findFirst({ where: { id: locationId, deleted: { not: true } }, select: { id: true } });
  if (!location) throw new Error('The selected location does not exist.');
  if (sublocationId) {
    const sublocation = await client.sublocations.findFirst({ where: { id: sublocationId, deleted: { not: true } }, select: { location_id: true } });
    if (!sublocation) throw new Error('The selected sublocation does not exist.');
    if (sublocation.location_id !== locationId) throw new Error('The selected sublocation does not belong to the selected location.');
  }
  const title = String(input.title || '').trim().slice(0, AMBIENCE.TITLE_MAX_LENGTH);
  const description = String(input.description || '').trim();
  if (!title) throw new Error('An ambience title is required.');
  if (!description) throw new Error('An ambience description is required.');
  const minFigures = boundedInt(input.min_figures, 0, AMBIENCE.MAX_FIGURES, 1);
  const maxFigures = boundedInt(input.max_figures, 0, AMBIENCE.MAX_FIGURES, 3);
  if (minFigures > maxFigures) throw new Error('Minimum figures cannot be greater than maximum figures.');
  return {
    location_id: locationId,
    sublocation_id: sublocationId || null,
    title,
    description,
    time_slot: AMBIENCE_TIME_SLOTS.includes(input.time_slot) ? input.time_slot : 'ANY',
    weather: AMBIENCE_WEATHERS.includes(input.weather) ? input.weather : null,
    crowd_level: AMBIENCE_CROWD_LEVELS.includes(input.crowd_level) ? input.crowd_level : 'SOME',
    weight: boundedInt(input.weight, 0, AMBIENCE.MAX_WEIGHT, 1),
    min_figures: minFigures,
    max_figures: maxFigures,
    is_active: input.is_active === undefined ? true : Boolean(input.is_active)
  };
}

function ambienceFigureRows(figures) {
  if (!Array.isArray(figures)) return [];
  return figures
    .map((figure) => ({ label: String(figure?.label || '').trim().slice(0, AMBIENCE.FIGURE_LABEL_MAX_LENGTH), weight: boundedInt(figure?.weight, 1, AMBIENCE.MAX_WEIGHT, 1) }))
    .filter((figure) => figure.label);
}

async function saveAmbience(input, recordId = null) {
  return prisma.$transaction(async (tx) => {
    const data = await ambienceData(tx, input);
    const ambience = recordId
      ? await tx.ambiences.update({ where: { id: recordId }, data })
      : await tx.ambiences.create({ data });
    if (Array.isArray(input.figures) || !recordId) {
      await tx.ambience_figures.deleteMany({ where: { ambience_id: ambience.id } });
      const rows = ambienceFigureRows(input.figures);
      if (rows.length) await tx.ambience_figures.createMany({ data: rows.map((row) => ({ ...row, ambience_id: ambience.id })) });
    }
    return tx.ambiences.findUnique({ where: { id: ambience.id }, include: ambienceInclude });
  });
}

const characterSceneInclude = {
  character: { select: { id: true, name: true, character_type: true } },
  npc_character: { select: { id: true, name: true, character_type: true } }
};

function sceneText(value, maxLength, label, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return text;
}

async function characterSceneData(client, input = {}, isCreate = true) {
  const data = {};
  if (isCreate || input.character_id !== undefined) {
    const characterId = number(input.character_id);
    if (!characterId) throw new Error('Choose the character who owns the scene.');
    const owner = await client.characters.findFirst({ where: { id: characterId, deleted: false }, select: { id: true } });
    if (!owner) throw new Error('The scene owner character was not found.');
    data.character_id = characterId;
  }
  if (isCreate || input.npc_character_id !== undefined) {
    const npcId = number(input.npc_character_id);
    if (npcId) {
      const npc = await client.characters.findFirst({ where: { id: npcId, deleted: false, character_type: CHARACTER_TYPE.NPC }, select: { id: true } });
      if (!npc) throw new Error('The linked NPC must be an active NPC character.');
    }
    data.npc_character_id = npcId;
  }
  if (isCreate || input.party_id !== undefined) data.party_id = number(input.party_id);
  if (isCreate || input.location_id !== undefined) data.location_id = number(input.location_id);
  if (isCreate || input.sublocation_id !== undefined) data.sublocation_id = number(input.sublocation_id);
  if (isCreate || input.scene_goal !== undefined) data.scene_goal = sceneText(input.scene_goal, SCENE_FIELD_MAX_LENGTHS.scene_goal, 'Scene goal', true);
  if (isCreate || input.scene_notes !== undefined) data.scene_notes = sceneText(input.scene_notes, SCENE_FIELD_MAX_LENGTHS.scene_notes, 'Scene notes');
  if (isCreate || input.chaos_factor !== undefined) data.chaos_factor = Math.min(CHAOS_FACTOR_MAX, Math.max(CHAOS_FACTOR_MIN, Math.round(number(input.chaos_factor, DEFAULT_CHAOS_FACTOR))));
  if (isCreate || input.scene_stage !== undefined) {
    const stage = input.scene_stage || SCENE_STAGE.ON_GOING;
    if (!VALID_SCENE_STAGES.includes(stage)) throw new Error(`Scene stage must be one of: ${VALID_SCENE_STAGES.join(', ')}.`);
    data.scene_stage = stage;
  }
  if (isCreate || input.is_secret !== undefined) data.is_secret = Boolean(input.is_secret);
  if (isCreate || input.is_nsfw !== undefined) data.is_nsfw = Boolean(input.is_nsfw);
  return data;
}

function storyData(input = {}) {
  return {
    character_id: number(input.character_id),
    user_id: input.user_id ? String(input.user_id) : randomUUID(),
    story: input.story ? String(input.story) : '',
    action_from_player: input.action_from_player ? String(input.action_from_player) : ''
  };
}
function skillData(input) {
  return {
    name: nullable(input.name), type: input.type, rarity: input.rarity,
    skill_target_rule: input.skill_target_rule || SKILL_TARGET_RULE.TO_ALL,
    skill_damage_type: input.skill_damage_type || SKILL_DAMAGE_TYPE.PHYSICAL,
    cure_effect_type: input.cure_effect_type && input.cure_effect_type !== CURE_EFFECT_NONE ? input.cure_effect_type : null,
    ...numericObject({
      healing_current_hp: number(input.healing_current_hp, 0),
      attack_amplifier: number(input.attack_amplifier, 1),
      magical_attack_amplifier: number(input.magical_attack_amplifier, 1),
      armor_amplifier: number(input.armor_amplifier, 1),
      magical_armor_amplifier: number(input.magical_armor_amplifier, 1),
      fire_damage: number(input.fire_damage, 0),
      ice_damage: number(input.ice_damage, 0),
      earth_damage: number(input.earth_damage, 0),
      lightning_damage: number(input.lightning_damage, 0),
      wind_damage: number(input.wind_damage, 0),
      holy_damage: number(input.holy_damage, 0),
      dark_damage: number(input.dark_damage, 0),
      energy_consume_cost: number(input.energy_consume_cost, 1),
      duration: number(input.duration, 0)
    }),
  };
}
function effectData(input) {
  return {
    name: nullable(input.name), effect_type: input.effect_type,
    description: nullable(input.description)
  };
}

const recipeInclude = {
  lifeskill: true,
  output_item: { select: { id: true, name: true, type: true, rarity: true, price: true } },
  ingredients: { where: { deleted: false }, orderBy: { id: 'asc' }, include: { item: { select: { id: true, name: true, type: true, rarity: true, price: true } } } }
};

function recipeData(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Recipe name is required.');
  const outputItemId = number(input.output_item_id);
  if (!outputItemId) throw new Error('Recipe output item is required.');
  const minOutput = Math.max(1, Math.trunc(number(input.output_quantity, 1)));
  const maxOutput = Math.max(minOutput, Math.trunc(number(input.max_output_quantity, minOutput)));
  return {
    name: name.slice(0, 50),
    description: nullable(input.description),
    lifeskill_id: number(input.lifeskill_id),
    output_item_id: outputItemId,
    output_quantity: minOutput,
    max_output_quantity: maxOutput,
    required_level: Math.max(1, Math.trunc(number(input.required_level, 1))),
    exp_reward: Math.max(0, Math.trunc(number(input.exp_reward, 0))),
    stamina_cost: Math.max(0, Math.trunc(number(input.stamina_cost, 0))),
    success_rate: Math.min(1, Math.max(0, number(input.success_rate, 1))),
    duration_seconds: Math.max(0, Math.trunc(number(input.duration_seconds, 0))),
    is_auto_unlocked: input.is_auto_unlocked === undefined ? true : Boolean(input.is_auto_unlocked)
  };
}

async function syncRecipeIngredients(client, recipeId, ingredients) {
  if (!Array.isArray(ingredients)) return;
  const merged = new Map();
  for (const entry of ingredients) {
    const itemId = number(entry?.item_id);
    const quantity = Math.max(1, Math.trunc(number(entry?.quantity, 1)));
    if (itemId) merged.set(itemId, (merged.get(itemId) || 0) + quantity);
  }
  await client.crafting_recipe_ingredients.deleteMany({ where: { recipe_id: recipeId } });
  if (merged.size) await client.crafting_recipe_ingredients.createMany({ data: [...merged].map(([itemId, quantity]) => ({ recipe_id: recipeId, item_id: itemId, quantity })) });
}

const questInclude = {
  source_npc: { select: { character_id: true, character: { select: { id: true, name: true, level: true } } } },
  target_item: { select: { id: true, name: true, type: true, rarity: true } },
  target_npc: { select: { character_id: true, character: { select: { id: true, name: true, level: true } } } },
  _count: { select: { character_quests: { where: { status: QUEST_STATUS.ACTIVE, deleted: false } } } }
};

async function questData(client, input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Quest name is required.');
  const description = String(input.description || '').trim();
  if (!description) throw new Error('Quest description is required.');
  const objectiveType = String(input.objective_type || '').toUpperCase();
  if (!Object.values(QUEST_TYPE).includes(objectiveType)) throw new Error('Quest objective type must be COLLECT, ELIMINATE or CAPTURE.');
  const sourceNpcId = number(input.source_npc_id);
  if (!sourceNpcId) throw new Error('Quest giver NPC is required.');
  const isCollect = objectiveType === QUEST_TYPE.COLLECT;
  const targetItemId = isCollect ? number(input.target_item_id) : null;
  const targetNpcId = isCollect ? null : number(input.target_npc_character_id);
  if (isCollect && !targetItemId) throw new Error('A COLLECT quest requires a target item.');
  if (!isCollect && !targetNpcId) throw new Error(`An ${objectiveType} quest requires a target NPC or monster.`);
  const npcIds = [...new Set([sourceNpcId, targetNpcId].filter(Boolean))];
  const npcs = await client.npcs.findMany({ where: { character_id: { in: npcIds }, deleted: false, character: { is: { deleted: false, character_type: CHARACTER_TYPE.NPC } } }, select: { character_id: true } });
  const activeNpcIds = new Set(npcs.map((npc) => npc.character_id));
  if (!activeNpcIds.has(sourceNpcId)) throw new Error('Quest giver must be an active NPC.');
  if (targetNpcId && !activeNpcIds.has(targetNpcId)) throw new Error('Quest target must be an active NPC or monster.');
  if (targetItemId && !(await client.items.findFirst({ where: { id: targetItemId, deleted: false }, select: { id: true } }))) throw new Error('Quest target item must be an active item.');
  return {
    name: name.slice(0, 100),
    description,
    source_npc_id: sourceNpcId,
    objective_type: objectiveType,
    target_item_id: targetItemId,
    target_npc_character_id: targetNpcId,
    required_quantity: Math.max(1, Math.min(MAX_INT32, Math.trunc(number(input.required_quantity, 1)))),
    repeatable: Boolean(input.repeatable),
    is_nsfw: Boolean(input.is_nsfw),
    gold_reward: Math.max(0, Math.min(MAX_INT32, Math.trunc(number(input.gold_reward, 0)))),
    affinity_reward: affinity(input.affinity_reward)
  };
}

async function assertUniqueQuestName(client, data, excludeId = null) {
  const existing = await client.quests.findFirst({ where: { source_npc_id: data.source_npc_id, name: data.name, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, deleted: true } });
  if (existing && !existing.deleted) throw new Error('This NPC already offers a quest with that name.');
  if (existing?.deleted) throw new Error('A deleted quest from this NPC already uses that name. Choose a different name.');
}

function lootGroupData(input) {
  const minGold = Math.max(number(input.min_gold, 0), 0);
  const maxGold = Math.max(number(input.max_gold, minGold), minGold);
  const rarity = VALID_LOOT_GROUP_RARITIES.includes(input.loot_group_rarity) ? input.loot_group_rarity : LOOT_GROUP_RARITY.COMMON;
  return { name: nullable(input.name), description: nullable(input.description), min_gold: minGold, max_gold: maxGold, loot_group_rarity: rarity };
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => number(value)).filter((value) => value !== null))];
}

async function syncLootGroupRelations(client, lootGroupId, input) {
  if (Array.isArray(input.loot_items)) {
    await client.lootgroups_items.updateMany({ where: { loot_group_id: lootGroupId }, data: { deleted: true } });
    const relations = input.loot_items.map((item) => ({
      loot_group_id: lootGroupId,
      item_id: number(item.item_id),
      chance_pct: Math.min(Math.max(number(item.chance_pct, 0), 0), MAX_LOOT_CHANCE_PCT),
      min_quantity: Math.max(number(item.min_quantity, 1), 1),
      max_quantity: Math.max(number(item.max_quantity, number(item.min_quantity, 1)), Math.max(number(item.min_quantity, 1), 1))
    })).filter((item) => item.item_id !== null);
    if (relations.length) await client.lootgroups_items.createMany({ data: relations });
  }
  if (Array.isArray(input.monster_ids)) {
    await client.npcmonsters_lootgroups.updateMany({ where: { loot_group_id: lootGroupId }, data: { deleted: true } });
    const monsterIds = uniqueIds(input.monster_ids);
    if (monsterIds.length) await client.npcmonsters_lootgroups.createMany({ data: monsterIds.map((npcMonsterId) => ({ npc_monster_id: npcMonsterId, loot_group_id: lootGroupId })) });
  }
  if (Array.isArray(input.location_links) || Array.isArray(input.location_ids)) {
    await client.locations_lootgroups.updateMany({ where: { loot_group_id: lootGroupId }, data: { deleted: true } });
    const links = Array.isArray(input.location_links)
      ? input.location_links
      : input.location_ids.map((locationId) => ({ location_id: locationId }));
    const byLocation = new Map();
    for (const link of links) {
      const locationId = number(link?.location_id);
      if (locationId === null || byLocation.has(locationId)) continue;
      byLocation.set(locationId, {
        location_id: locationId,
        loot_group_id: lootGroupId,
        chance_pct: Math.min(Math.max(number(link?.chance_pct, MAX_LOOT_CHANCE_PCT), 0), MAX_LOOT_CHANCE_PCT)
      });
    }
    const rows = [...byLocation.values()];
    if (rows.length) await client.locations_lootgroups.createMany({ data: rows });
  }
}

async function syncItemBonusEffects(client, itemId, relations) {
  if (!Array.isArray(relations)) return;
  const bonus = await client.item_bonus.upsert({
    where: { item_id: itemId },
    create: { item_id: itemId },
    update: { deleted: false }
  });
  await client.itembonus_effects.deleteMany({ where: { item_bonus_id: bonus.id } });
  const map = new Map();
  for (const relation of relations) {
    const efId = number(relation.effect_id);
    if (efId !== null && !map.has(efId)) {
      map.set(efId, { item_bonus_id: bonus.id, effect_id: efId });
    }
  }
  const rows = [...map.values()];
  if (rows.length) {
    await client.itembonus_effects.createMany({ data: rows });
  }
}

async function syncItemSkills(client, itemId, skillIds) {
  if (!Array.isArray(skillIds)) return;
  await client.skills_in_items.deleteMany({ where: { item_id: itemId } });
  const uniqueSkillIds = uniqueIds(skillIds);
  if (uniqueSkillIds.length) {
    await client.skills_in_items.createMany({
      data: uniqueSkillIds.map((skillId) => ({ item_id: itemId, skill_id: skillId }))
    });
  }
}

const SKILL_WEAPON_TYPES = new Set([...Object.values(WEAPON_TYPE), UNARMED_WEAPON_TYPE, ANY_WEAPON_TYPE]);

async function syncSkillWeaponTypes(client, skillId, weaponTypes) {
  if (!Array.isArray(weaponTypes)) return;
  const types = [...new Set(weaponTypes.map((type) => String(type || '').toUpperCase()))];
  if (types.some((type) => !SKILL_WEAPON_TYPES.has(type))) throw new Error('Unsupported weapon type for skill restriction.');
  await client.skill_weapon_types.deleteMany({ where: { skill_id: skillId } });
  if (types.length) await client.skill_weapon_types.createMany({ data: types.map((type) => ({ skill_id: skillId, weapon_type: type })) });
}

async function syncSkillEffects(client, skillId, relations) {
  if (!Array.isArray(relations)) return;
  await client.skill_effects.deleteMany({ where: { skill_id: skillId } });
  const map = new Map();
  for (const relation of relations) {
    const efId = number(relation.effect_id);
    if (efId !== null && !map.has(efId)) {
      map.set(efId, {
        skill_id: skillId,
        effect_id: efId,
        duration: number(relation.duration, 1),
        healing_current_hp: number(relation.healing_current_hp, 0),
        is_stun_cure: Boolean(relation.is_stun_cure),
        is_daze_cure: Boolean(relation.is_daze_cure),
        is_weak_cure: Boolean(relation.is_weak_cure),
        is_blind_cure: Boolean(relation.is_blind_cure),
        is_poison_cure: Boolean(relation.is_poison_cure),
        is_cure_all: Boolean(relation.is_cure_all)
      });
    }
  }
  const rows = [...map.values()];
  if (rows.length) {
    await client.skill_effects.createMany({ data: rows });
  }
}

const equipmentSlots = new Set(Object.keys(EQUIP_SLOT_FIELDS));

function characterItemData(characterId, item, location, equipSlot = null) {
  return {
    character_id: characterId,
    item_id: number(item.item_id),
    location,
    equip_slot: equipSlot,
    quantity: Math.max(number(item.quantity, 1), 1),
    current_level_upgraded: Math.max(number(item.current_level_upgraded, 0), 0),
    prefix_id: item.prefix_id ? number(item.prefix_id) : null,
    suffix_id: item.suffix_id ? number(item.suffix_id) : null
  };
}

async function replaceCharacterItems(client, characterId, location, items) {
  await client.character_items.updateMany({
    where: { character_id: characterId, location },
    data: { deleted: true }
  });

  const rows = (Array.isArray(items) ? items : [])
    .map((item) => characterItemData(characterId, item, location, item.equip_slot || null))
    .filter((item) => item.item_id !== null);
  if (rows.length) await client.character_items.createMany({ data: rows });
}

function normalizeEquipSlot(value) {
  const slot = String(value || '').toUpperCase();
  return equipmentSlots.has(slot) ? slot : null;
}

async function validateEquippedRows(client, rows) {
  const equipped = rows.filter((row) => row.equip_slot);
  if (!equipped.length) return;
  const usedSlots = new Set();
  for (const row of equipped) {
    if (usedSlots.has(row.equip_slot)) throw new Error(`Only one item can be equipped in slot ${row.equip_slot}.`);
    usedSlots.add(row.equip_slot);
  }
  const items = await client.items.findMany({ where: { id: { in: [...new Set(equipped.map((row) => row.item_id))] } }, select: { id: true, name: true, type: true } });
  const itemsById = new Map(items.map((item) => [item.id, item]));
  for (const row of equipped) {
    const item = itemsById.get(row.item_id);
    if (!item) throw new Error(`Item #${row.item_id} does not exist.`);
    if (!EQUIP_SLOT_ITEM_TYPES[row.equip_slot]?.includes(item.type)) throw new Error(`${item.name || `Item #${item.id}`} (${item.type}) cannot be equipped in slot ${row.equip_slot}.`);
    if (item.type === 'TWO_HAND' && usedSlots.has('RIGHT_HAND')) throw new Error(`${item.name || `Item #${item.id}`} is two-handed, so the right hand slot must be empty.`);
  }
}

async function syncCarriedItems(client, characterId, items) {
  const existing = await client.character_items.findMany({
    where: { character_id: characterId, deleted: false, location: { in: [ITEM_LOCATION.BACKPACK, ITEM_LOCATION.EQUIPPED] } }
  });
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const rows = (Array.isArray(items) ? items : [])
    .map((item) => {
      const equipSlot = normalizeEquipSlot(item.equip_slot);
      const data = characterItemData(characterId, item, equipSlot ? ITEM_LOCATION.EQUIPPED : ITEM_LOCATION.BACKPACK, equipSlot);
      if (equipSlot) data.quantity = 1;
      return { id: number(item.id), ...data };
    })
    .filter((row) => row.item_id !== null);
  await validateEquippedRows(client, rows);

  const keptIds = new Set();
  for (const { id, ...data } of rows) {
    const current = id !== null ? existingById.get(id) : null;
    if (current && !keptIds.has(id)) {
      keptIds.add(id);
      await client.character_items.update({
        where: { id },
        data: {
          ...data,
          ...(current.prefix_id !== data.prefix_id ? { prefix_stats: null } : {}),
          ...(current.suffix_id !== data.suffix_id ? { suffix_stats: null } : {})
        }
      });
    } else {
      await client.character_items.create({ data });
    }
  }
  const removedIds = existing.filter((row) => !keptIds.has(row.id)).map((row) => row.id);
  if (removedIds.length) await client.character_items.updateMany({ where: { id: { in: removedIds } }, data: { deleted: true } });
}

async function syncCharacterItems(client, characterId, input) {
  if (input.inventory?.includes_equipped) {
    await syncCarriedItems(client, characterId, input.inventory.items);
    return;
  }

  if (input.inventory) await replaceCharacterItems(client, characterId, ITEM_LOCATION.BACKPACK, input.inventory.items);

  if (input.equipment) {
    const previous = await client.character_items.findMany({
      where: { character_id: characterId, location: ITEM_LOCATION.EQUIPPED, deleted: false }
    });
    await client.character_items.updateMany({
      where: { character_id: characterId, location: ITEM_LOCATION.EQUIPPED },
      data: { deleted: true }
    });
    const equipped = Object.entries(input.equipment)
      .map(([field, itemId]) => ({
        item_id: number(itemId),
        equip_slot: field.replace(/_id$/, '').toUpperCase()
      }))
      .filter((item) => item.item_id !== null && equipmentSlots.has(item.equip_slot))
      .map((item) => {
        const kept = previous.find((row) => row.equip_slot === item.equip_slot && row.item_id === item.item_id);
        const data = characterItemData(characterId, kept || item, ITEM_LOCATION.EQUIPPED, item.equip_slot);
        return kept ? { ...data, prefix_stats: kept.prefix_stats, suffix_stats: kept.suffix_stats } : data;
      });
    if (equipped.length) await client.character_items.createMany({ data: equipped });
  }
}

async function syncCharacterVault(client, characterId, vaultInput) {
  if (!vaultInput) return;
  const vault = await client.character_vaults.upsert({
    where: { character_id: characterId },
    create: {
      character_id: characterId,
      max_slots: number(vaultInput.max_slots, DEFAULT_VAULT_SLOTS),
      tier: number(vaultInput.tier, 1),
      stored_gold: number(vaultInput.stored_gold, 0)
    },
    update: {
      max_slots: number(vaultInput.max_slots, DEFAULT_VAULT_SLOTS),
      tier: number(vaultInput.tier, 1),
      stored_gold: number(vaultInput.stored_gold, 0),
      deleted: false
    }
  });
  if (Array.isArray(vaultInput.items)) await replaceCharacterItems(client, characterId, ITEM_LOCATION.VAULT, vaultInput.items);
}

async function syncSublocationItems(client, sublocationId, itemIds) {
  if (!Array.isArray(itemIds)) return;
  await client.sublocations_items.updateMany({
    where: { sublocation_id: sublocationId },
    data: { deleted: true }
  });
  const uniqueItems = [...new Set(itemIds.map((id) => number(id)).filter((id) => id !== null))];
  for (const itemId of uniqueItems) {
    await client.sublocations_items.upsert({
      where: { sublocation_id_item_id: { sublocation_id: sublocationId, item_id: itemId } },
      create: { sublocation_id: sublocationId, item_id: itemId, deleted: false },
      update: { deleted: false }
    });
  }
}

async function activeNpcIds(client, ids) {
  const unique = uniqueIds(ids);
  if (!unique.length) return new Set();
  const rows = await client.npcs.findMany({
    where: {
      character_id: { in: unique },
      deleted: false,
      OR: [{ npc_monsters: { is: null } }, { npc_monsters: { is: { deleted: true } } }],
      character: { is: { deleted: false, character_type: CHARACTER_TYPE.NPC } }
    },
    select: { character_id: true }
  });
  return new Set(rows.map((row) => row.character_id));
}

async function activePlayerIds(client, ids) {
  const unique = uniqueIds(ids);
  if (!unique.length) return new Set();
  const rows = await client.players.findMany({
    where: {
      character_id: { in: unique },
      deleted: false,
      character: { is: { deleted: false, character_type: CHARACTER_TYPE.PLAYER } }
    },
    select: { character_id: true }
  });
  return new Set(rows.map((row) => row.character_id));
}

async function syncPlayerNpcRelationships(client, playerCharacterId, relations) {
  if (!Array.isArray(relations)) return;
  await client.player_npc_relationships.updateMany({
    where: { player_character_id: playerCharacterId },
    data: { deleted: true }
  });
  const targetIds = relations.map((relation) => relation?.npc_character_id);
  const validNpcIds = await activeNpcIds(client, targetIds);
  const seen = new Set();
  for (const relation of relations) {
    const npcCharacterId = number(relation?.npc_character_id);
    if (npcCharacterId === null || seen.has(npcCharacterId) || !validNpcIds.has(npcCharacterId)) continue;
    seen.add(npcCharacterId);
    await client.player_npc_relationships.upsert({
      where: { player_character_id_npc_character_id: { player_character_id: playerCharacterId, npc_character_id: npcCharacterId } },
      create: {
        player_character_id: playerCharacterId,
        npc_character_id: npcCharacterId,
        affinity: affinity(relation.affinity),
        status: getAffinityStatus(affinity(relation.affinity)),
        is_player_name_revealed: Boolean(relation.is_player_name_revealed),
        interaction_notes: nullable(relation.interaction_notes),
        deleted: false
      },
      update: {
        affinity: affinity(relation.affinity),
        status: getAffinityStatus(affinity(relation.affinity)),
        is_player_name_revealed: Boolean(relation.is_player_name_revealed),
        interaction_notes: nullable(relation.interaction_notes),
        deleted: false
      }
    });
  }
}

async function syncNpcPlayerRelationships(client, npcCharacterId, relations) {
  if (!Array.isArray(relations)) return;
  await client.player_npc_relationships.updateMany({
    where: { npc_character_id: npcCharacterId },
    data: { deleted: true }
  });
  const playerIds = relations.map((relation) => relation?.player_character_id);
  const validPlayerIds = await activePlayerIds(client, playerIds);
  const seen = new Set();
  for (const relation of relations) {
    const playerCharacterId = number(relation?.player_character_id);
    if (playerCharacterId === null || seen.has(playerCharacterId) || !validPlayerIds.has(playerCharacterId)) continue;
    seen.add(playerCharacterId);
    await client.player_npc_relationships.upsert({
      where: { player_character_id_npc_character_id: { player_character_id: playerCharacterId, npc_character_id: npcCharacterId } },
      create: {
        player_character_id: playerCharacterId,
        npc_character_id: npcCharacterId,
        affinity: affinity(relation.affinity),
        status: getAffinityStatus(affinity(relation.affinity)),
        is_player_name_revealed: Boolean(relation.is_player_name_revealed),
        interaction_notes: nullable(relation.interaction_notes),
        deleted: false
      },
      update: {
        affinity: affinity(relation.affinity),
        status: getAffinityStatus(affinity(relation.affinity)),
        is_player_name_revealed: Boolean(relation.is_player_name_revealed),
        interaction_notes: nullable(relation.interaction_notes),
        deleted: false
      }
    });
  }
}

async function syncNpcRelationships(client, npcCharacterId, relations) {
  if (!Array.isArray(relations)) return;
  await client.npc_relationships.updateMany({
    where: { source_npc_id: npcCharacterId },
    data: { deleted: true }
  });
  const targetIds = relations.map((relation) => relation?.target_npc_id);
  const validNpcIds = await activeNpcIds(client, targetIds);
  const seen = new Set();
  for (const relation of relations) {
    const targetNpcId = number(relation?.target_npc_id);
    if (targetNpcId === null || targetNpcId === npcCharacterId || seen.has(targetNpcId) || !validNpcIds.has(targetNpcId)) continue;
    seen.add(targetNpcId);
    await client.npc_relationships.upsert({
      where: { source_npc_id_target_npc_id: { source_npc_id: npcCharacterId, target_npc_id: targetNpcId } },
      create: {
        source_npc_id: npcCharacterId,
        target_npc_id: targetNpcId,
        relationship_type: relation.relationship_type || DEFAULT_NPC_RELATIONSHIP_TYPE,
        context_note: nullable(relation.context_note),
        is_nsfw: Boolean(relation.is_nsfw),
        deleted: false
      },
      update: {
        relationship_type: relation.relationship_type || DEFAULT_NPC_RELATIONSHIP_TYPE,
        context_note: nullable(relation.context_note),
        is_nsfw: Boolean(relation.is_nsfw),
        deleted: false
      }
    });
  }
}

async function syncNpcKnownLocations(client, npcCharacterId, locations) {
  if (!Array.isArray(locations)) return;
  await client.npc_known_locations.updateMany({
    where: { character_id: npcCharacterId },
    data: { deleted: true }
  });
  const locationIds = uniqueIds(locations.map((entry) => entry?.location_id));
  const sublocationIds = uniqueIds(locations.map((entry) => entry?.sublocation_id));
  const [validLocations, validSublocations] = await Promise.all([
    locationIds.length ? client.locations.findMany({ where: { id: { in: locationIds }, deleted: false }, select: { id: true } }) : [],
    sublocationIds.length ? client.sublocations.findMany({ where: { id: { in: sublocationIds }, deleted: false }, select: { id: true, location_id: true } }) : []
  ]);
  const validLocationIds = new Set(validLocations.map((location) => location.id));
  const validSublocationsById = new Map(validSublocations.map((sublocation) => [sublocation.id, sublocation]));
  const seen = new Set();
  const rows = [];
  for (const entry of locations) {
    const locationId = number(entry?.location_id);
    const sublocationId = number(entry?.sublocation_id);
    if (locationId === null && sublocationId === null) continue;
    if (locationId !== null && !validLocationIds.has(locationId)) continue;
    const sublocation = sublocationId === null ? null : validSublocationsById.get(sublocationId);
    if (sublocationId !== null && !sublocation) continue;
    if (locationId !== null && sublocation && sublocation.location_id !== locationId) continue;
    const key = `${locationId || ''}:${sublocationId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      character_id: npcCharacterId,
      location_id: locationId,
      sublocation_id: sublocationId,
      location_knowledge_type: entry.location_knowledge_type || DEFAULT_NPC_LOCATION_KNOWLEDGE,
      location_semantic_memory: nullable(entry.location_semantic_memory),
      deleted: false
    });
  }
  if (rows.length) await client.npc_known_locations.createMany({ data: rows });
}

async function syncNpcAppearances(client, npcCharacterId, appearances) {
  if (!Array.isArray(appearances)) return;
  await client.npcs_in_locations_or_sublocations.updateMany({
    where: { npc_id: npcCharacterId },
    data: { deleted: true }
  });
  const locationIds = uniqueIds(appearances.map((entry) => entry?.location_id));
  const sublocationIds = uniqueIds(appearances.map((entry) => entry?.sublocation_id));
  const [validLocations, validSublocations] = await Promise.all([
    locationIds.length ? client.locations.findMany({ where: { id: { in: locationIds }, deleted: false }, select: { id: true } }) : [],
    sublocationIds.length ? client.sublocations.findMany({ where: { id: { in: sublocationIds }, deleted: false }, select: { id: true } }) : []
  ]);
  const validLocationIds = new Set(validLocations.map((location) => location.id));
  const validSublocationIds = new Set(validSublocations.map((sublocation) => sublocation.id));
  const seen = new Set();
  for (const entry of appearances) {
    const locationId = number(entry?.location_id);
    const sublocationId = number(entry?.sublocation_id);
    if ((locationId === null && sublocationId === null) || (locationId !== null && sublocationId !== null)) continue;
    if (locationId !== null && !validLocationIds.has(locationId)) continue;
    if (sublocationId !== null && !validSublocationIds.has(sublocationId)) continue;
    const key = locationId !== null ? `location:${locationId}` : `sublocation:${sublocationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (locationId !== null) {
      await client.npcs_in_locations_or_sublocations.upsert({
        where: { npc_id_location_id: { npc_id: npcCharacterId, location_id: locationId } },
        create: { npc_id: npcCharacterId, location_id: locationId, deleted: false },
        update: { deleted: false, sublocation_id: null }
      });
    } else {
      await client.npcs_in_locations_or_sublocations.upsert({
        where: { npc_id_sublocation_id: { npc_id: npcCharacterId, sublocation_id: sublocationId } },
        create: { npc_id: npcCharacterId, sublocation_id: sublocationId, deleted: false },
        update: { deleted: false, location_id: null }
      });
    }
  }
}

export async function getAdminDashboard(options = {}) {
  try {
    const userPage = Math.max(number(options.userPage, 1), 1);
    const userPageSize = Math.min(Math.max(number(options.userPageSize, ADMIN_DEFAULT_PAGE_SIZE), 1), ADMIN_MAX_PAGE_SIZE);
    const userSearch = String(options.userSearch || '').trim();
    const userSort = ADMIN_USER_SORT_FIELDS.includes(options.userSort) ? options.userSort : 'id';
    const userDirection = options.userDirection === 'desc' ? 'desc' : 'asc';
    const userWhere = {
      ...(userSearch ? { username: { contains: userSearch } } : {}),
      ...(options.userStatus === 'deleted' ? { deleted: true } : options.userStatus === 'active' ? { deleted: { not: true } } : {})
    };
    const userOrderBy = userSort === 'character' ? { character: { id: userDirection } } : userSort === 'role' ? { is_admin: userDirection } : userSort === 'status' ? { deleted: userDirection } : { [userSort]: userDirection };
    const [
      users, userTotal, userOptions, characters, items, lifeskills, skills, effects,
      regions, locations, locationRoutes, sublocations, loot_groups, crafting_recipes, quests, monsters,
      prefixes, suffixes, stories, npcAppearances, ambiences, character_scenes
    ] = await Promise.all([
      prisma.users.findMany({ where: userWhere, orderBy: [userOrderBy, { id: 'asc' }], skip: (userPage - 1) * userPageSize, take: userPageSize, select: { id: true, user_id: true, username: true, is_admin: true, deleted: true, created_at: true, character: { select: { id: true, name: true } } } }),
      prisma.users.count({ where: userWhere }),
      prisma.users.findMany({ where: { deleted: false }, orderBy: { username: 'asc' }, select: { id: true, user_id: true, username: true } }),
      prisma.characters.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: characterInclude }),
      prisma.items.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: itemInclude }),
      prisma.lifeskills.findMany({ orderBy: { id: 'asc' }, include: { character_lifeskills: true } }),
      prisma.skills.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: { skill_effects: { where: { deleted: false }, include: { effect: true } }, for_weapon_types: true } }),
      prisma.effects.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: { skill_effects: { where: { deleted: false }, include: { skills: true } } } }),
      prisma.regions.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: { locations: true } }),
      prisma.locations.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: { region: true, locations_lootgroups: { where: { deleted: false }, include: { loot_groups: true } } } }),
      prisma.location_routes.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: { location_a: true, location_b: true } }),
      prisma.sublocations.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: sublocationInclude }),
      prisma.loot_groups.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: lootGroupInclude }),
      prisma.crafting_recipes.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: recipeInclude }),
      prisma.quests.findMany({ where: { deleted: false }, orderBy: { id: 'asc' }, include: questInclude }),
      prisma.npc_monsters.findMany({ where: { deleted: false, npc: { deleted: false } }, orderBy: { character_id: 'asc' }, include: { npc: { include: { character: { select: { id: true, name: true, level: true, deleted: true } } } } } }),
      prisma.prefixes.findMany({ where: { deleted: false }, orderBy: { id: 'asc' } }),
      prisma.suffixes.findMany({ where: { deleted: false }, orderBy: { id: 'asc' } }),
      prisma.stories.findMany({ orderBy: { id: 'desc' }, include: { character: { select: { id: true, name: true } } } }),
      prisma.npcs_in_locations_or_sublocations.findMany({ where: { deleted: false } }),
      prisma.ambiences.findMany({ where: { deleted: { not: true } }, orderBy: { id: 'asc' }, include: ambienceInclude }),
      prisma.character_scenes.findMany({ where: { deleted: { not: true } }, orderBy: { id: 'desc' }, include: characterSceneInclude })
    ]);
    const adminCharacters = characters.map((character) => ({
      ...character,
      image_data: imageDataToUrl(character.image_data),
      character_memories: character.character_owner_memories || [],
      gold: character.player?.gold ?? null,
      verified: character.player?.verified ?? false,
      is_nsfw: character.player?.is_nsfw ?? false,
      current_point_spend: character.player?.current_point_spend ?? null
    }));
    return {
      users,
      userOptions,
      characters: adminCharacters,
      items,
      lifeskills,
      skills,
      effects,
      regions,
      locations,
      locationRoutes,
      sublocations,
      loot_groups,
      crafting_recipes,
      quests,
      monsters,
      prefixes,
      suffixes,
      stories,
      npcAppearances,
      ambiences,
      character_scenes,
      userMeta: { page: userPage, pageSize: userPageSize, total: userTotal, pages: Math.ceil(userTotal / userPageSize) }
    };
  } catch (error) { fail('getAdminDashboard', 'read', error); }
}

export async function createAdminRecord(model, input) {
  try {
    if (model === 'users') {
      if (!input.password) throw new Error('A password is required when creating a user.');
      return prisma.users.create({
        data: {
          user_id: randomUUID(),
          username: input.username,
          password: await hashPassword(input.password),
          is_admin: Boolean(input.is_admin),
          deleted: Boolean(input.deleted)
        },
        select: { id: true, user_id: true, username: true, is_admin: true, deleted: true, created_at: true }
      });
    }
    if (model === 'lifeskills') return prisma.lifeskills.create({ data: { name: input.name, description: nullable(input.description) } });
    if (model === 'skills') return prisma.$transaction(async (tx) => {
      const skill = await tx.skills.create({ data: skillData(input) });
      await syncSkillEffects(tx, skill.id, input.skill_effects);
      await syncSkillWeaponTypes(tx, skill.id, input.weapon_types);
      return tx.skills.findUnique({ where: { id: skill.id }, include: { skill_effects: { include: { effect: true } }, for_weapon_types: true } });
    });
    if (model === 'effects') return prisma.effects.create({ data: effectData(input) });
    if (model === 'crafting_recipes') return prisma.$transaction(async (tx) => {
      const recipe = await tx.crafting_recipes.create({ data: recipeData(input) });
      await syncRecipeIngredients(tx, recipe.id, input.ingredients);
      return tx.crafting_recipes.findUnique({ where: { id: recipe.id }, include: recipeInclude });
    });
    if (model === 'quests') return prisma.$transaction(async (tx) => {
      const data = await questData(tx, input);
      await assertUniqueQuestName(tx, data);
      const quest = await tx.quests.create({ data });
      return tx.quests.findUnique({ where: { id: quest.id }, include: questInclude });
    });
    if (model === 'loot_groups') return prisma.$transaction(async (tx) => {
      const group = await tx.loot_groups.create({ data: lootGroupData(input) });
      await syncLootGroupRelations(tx, group.id, input);
      return tx.loot_groups.findUnique({ where: { id: group.id }, include: lootGroupInclude });
    });
    if (model === 'regions') return prisma.regions.create({ data: { name: input.name, description: nullable(input.description), geography: nullable(input.geography), politics: nullable(input.politics), culture: nullable(input.culture) } });
    if (model === 'locations') return prisma.locations.create({ data: { region_id: number(input.region_id), name: input.name, description: nullable(input.description), subgeography: nullable(input.subgeography), subpolitics: nullable(input.subpolitics), subculture: nullable(input.subculture), is_safe_zone: Boolean(input.is_safe_zone), location_type: input.location_type || DEFAULT_LOCATION_TYPE } });
    if (model === 'location_routes') return prisma.$transaction(async (tx) => {
      const [locationAId, locationBId] = routePair(input);
      const costs = routeCosts(input, true);
      const locations = await tx.locations.findMany({ where: { id: { in: [locationAId, locationBId] }, deleted: false } });
      if (locations.length !== 2 || locations.some((location) => location.map_x === null || location.map_y === null)) {
        throw new Error('Both route locations must be active and pinned on the map.');
      }
      const pair = { location_a_id: locationAId, location_b_id: locationBId };
      const existing = await tx.location_routes.findUnique({ where: { location_a_id_location_b_id: pair } });
      if (existing && !existing.deleted) throw new Error('Those locations are already connected.');
      if (existing) return tx.location_routes.update({ where: { id: existing.id }, data: { ...costs, deleted: false }, include: { location_a: true, location_b: true } });
      return tx.location_routes.create({ data: { ...pair, ...costs }, include: { location_a: true, location_b: true } });
    });
    if (model === 'sublocations') return prisma.$transaction(async (tx) => {
      const type = input.sublocation_type || SUBLOCATION_TYPE.DEFAULT;
      const sublocation = await tx.sublocations.create({
        data: {
          location_id: number(input.location_id),
          owner_id: number(input.owner_id),
          name: input.name,
          description: input.description ? String(input.description).slice(0, ADMIN_DESCRIPTION_MAX_LENGTH) : '',
          sublocation_type: type,
          long_rest_price: type === SUBLOCATION_TYPE.INN ? price(input.long_rest_price) : 0,
          food_water_refill_price: type === SUBLOCATION_TYPE.INN ? price(input.food_water_refill_price) : 0
        }
      });
      if (TRADING_SUBLOCATION_TYPES.includes(type) && Array.isArray(input.items)) {
        await syncSublocationItems(tx, sublocation.id, input.items);
      }
      return tx.sublocations.findUnique({ where: { id: sublocation.id }, include: sublocationInclude });
    });
    if (model === 'items') return prisma.$transaction(async (tx) => {
      const item = await tx.items.create({
        data: {
          name: nullable(input.name),
          type: input.type,
          weapon_type: input.weapon_type || DEFAULT_WEAPON_TYPE,
          rarity: input.rarity,
          size: number(input.size, 1),
          is_stackable: Boolean(input.is_stackable),
          max_stack: number(input.max_stack, 1),
          max_upgrade_level: number(input.max_upgrade_level, 0),
          description: nullable(input.description),
          price: number(input.price),
          is_buyable: Boolean(input.is_buyable),
          is_consumable: Boolean(input.is_consumable),
          is_material: Boolean(input.is_material),
          is_nsfw: Boolean(input.is_nsfw),
          item_bonus: input.item_bonus || Array.isArray(input.item_effects) ? { create: itemBonusData(input.item_bonus || {}) } : undefined
        }
      });
      await syncItemBonusEffects(tx, item.id, input.item_effects);
      await syncItemSkills(tx, item.id, input.skills);
      return tx.items.findUnique({ where: { id: item.id }, include: itemInclude });
    });
    if (model === 'characters') {
      return prisma.$transaction(async (tx) => {
        const type = input.character_type === CHARACTER_TYPE.NPC ? CHARACTER_TYPE.NPC : CHARACTER_TYPE.PLAYER;
        if (type === CHARACTER_TYPE.PLAYER && input.user_id) {
          const conflict = await tx.characters.findFirst({
            where: { user_id: input.user_id, deleted: false }
          });
          if (conflict) {
            throw new Error(`User is already assigned to character "${conflict.name || conflict.id}". Each user can only own one character.`);
          }
        }
        const character = await tx.characters.create({
          data: {
            user_id: type === CHARACTER_TYPE.PLAYER ? nullable(input.user_id) : null,
            character_type: type,
            name: nullable(input.name),
            race: nullable(input.race),
            age: number(input.age),
            job: nullable(input.job),
            sex: normalizeSex(input.sex),
            alignment: nullable(input.alignment),
            appearance: nullable(input.appearance),
            description: nullable(input.description),
            location_id: number(input.location_id, 1),
            sublocation_id: input.sublocation_id ? number(input.sublocation_id) : null,
            respawn_location_id: number(input.respawn_location_id, 1),
            level: number(input.level, 1),
            current_exp: number(input.current_exp, 0),
            is_updated_by_user: Boolean(input.is_updated_by_user),
            image_data: input.image_data !== undefined ? imageDataToBuffer(input.image_data) : undefined,
            ...(type === CHARACTER_TYPE.PLAYER ? { player: { create: { gold: number(input.gold, DEFAULT_STARTING_GOLD), verified: Boolean(input.verified), is_nsfw: Boolean(input.is_nsfw), current_point_spend: number(input.current_point_spend, INITIAL_ATTRIBUTE_POINT_BUDGET) } } } : {
              npc: { create: { is_attackable: input.npc?.is_attackable ?? true, is_speakable: Boolean(input.npc?.is_speakable), is_recruitable: Boolean(input.npc?.is_recruitable) && !input.npc?.npc_monster, ...(input.npc?.npc_monster ? { npc_monsters: { create: { experience_reward: number(input.npc.npc_monster.experience_reward, 0) } } } : {}) } }
            })
          },
          include: characterInclude
        });
        return updateCharacter(character.id, input, tx);
      });
    }
    if (model === 'prefixes') return prisma.prefixes.create({ data: prefixSuffixData(input) });
    if (model === 'suffixes') return prisma.suffixes.create({ data: prefixSuffixData(input) });
    if (model === 'stories') return prisma.stories.create({ data: storyData(input), include: { character: { select: { id: true, name: true } } } });
    if (model === 'ambiences') return saveAmbience(input);
    if (model === 'character_scenes') return prisma.character_scenes.create({ data: await characterSceneData(prisma, input, true), include: characterSceneInclude });
    throw new Error('Unsupported admin model.');
  } catch (error) { fail(`createAdmin${model}`, 'create', error); }
}

export async function updateAdminRecord(model, id, input) {
  try {
    const recordId = number(id);
    if (model === 'users') return prisma.users.update({ where: { id: recordId }, data: { username: input.username, is_admin: Boolean(input.is_admin), ...(input.deleted !== undefined ? { deleted: Boolean(input.deleted) } : {}), ...(input.password ? { password: await hashPassword(input.password) } : {}) }, select: { id: true, user_id: true, username: true, is_admin: true, deleted: true, created_at: true } });
    if (model === 'lifeskills') return prisma.lifeskills.update({ where: { id: recordId }, data: { name: input.name, description: nullable(input.description) } });
    if (model === 'skills') return prisma.$transaction(async (tx) => {
      const skill = await tx.skills.update({ where: { id: recordId }, data: skillData(input) });
      await syncSkillEffects(tx, recordId, input.skill_effects);
      await syncSkillWeaponTypes(tx, recordId, input.weapon_types);
      return tx.skills.findUnique({ where: { id: recordId }, include: { skill_effects: { include: { effect: true } }, for_weapon_types: true } });
    });
    if (model === 'effects') return prisma.effects.update({ where: { id: recordId }, data: effectData(input) });
    if (model === 'crafting_recipes') return prisma.$transaction(async (tx) => {
      await tx.crafting_recipes.update({ where: { id: recordId }, data: recipeData(input) });
      await syncRecipeIngredients(tx, recordId, input.ingredients);
      return tx.crafting_recipes.findUnique({ where: { id: recordId }, include: recipeInclude });
    });
    if (model === 'quests') return prisma.$transaction(async (tx) => {
      const current = await tx.quests.findFirst({ where: { id: recordId, deleted: false }, select: { id: true } });
      if (!current) throw new Error('Quest not found.');
      const data = await questData(tx, input);
      await assertUniqueQuestName(tx, data, recordId);
      await tx.quests.update({ where: { id: recordId }, data });
      return tx.quests.findUnique({ where: { id: recordId }, include: questInclude });
    });
    if (model === 'loot_groups') return prisma.$transaction(async (tx) => {
      const group = await tx.loot_groups.update({ where: { id: recordId }, data: lootGroupData(input) });
      await syncLootGroupRelations(tx, recordId, input);
      return tx.loot_groups.findUnique({ where: { id: recordId }, include: lootGroupInclude });
    });
    if (model === 'regions') return prisma.regions.update({ where: { id: recordId }, data: { name: input.name, description: nullable(input.description), geography: nullable(input.geography), politics: nullable(input.politics), culture: nullable(input.culture) } });
    if (model === 'locations') {
      const coordinateUpdate = Object.hasOwn(input, 'map_x') || Object.hasOwn(input, 'map_y');
      const coordinates = coordinateUpdate ? mapCoordinates(input) : {};
      return prisma.$transaction(async (tx) => {
        const updated = await tx.locations.update({
          where: { id: recordId },
          data: {
            region: input.region_id !== undefined && input.region_id !== null ? { connect: { id: number(input.region_id) } } : undefined,
            name: input.name !== undefined ? input.name : undefined,
            description: input.description !== undefined ? nullable(input.description) : undefined,
            subgeography: input.subgeography !== undefined ? nullable(input.subgeography) : undefined,
            subpolitics: input.subpolitics !== undefined ? nullable(input.subpolitics) : undefined,
            subculture: input.subculture !== undefined ? nullable(input.subculture) : undefined,
            is_safe_zone: input.is_safe_zone !== undefined ? Boolean(input.is_safe_zone) : undefined,
            location_type: input.location_type || undefined,
            ...coordinates
          }
        });
        if (coordinateUpdate && coordinates.map_x === null) {
          await tx.location_routes.updateMany({ where: { deleted: false, OR: [{ location_a_id: recordId }, { location_b_id: recordId }] }, data: { deleted: true } });
        }
        return updated;
      });
    }
    if (model === 'location_routes') {
      const costs = {};
      for (const field of ['energy_cost', 'food_cost', 'water_cost']) {
        if (Object.hasOwn(input, field)) costs[field] = routeCost(input[field]);
      }
      if (!Object.keys(costs).length) throw new Error('Provide at least one route cost to update.');
      return prisma.location_routes.update({ where: { id: recordId }, data: costs, include: { location_a: true, location_b: true } });
    }
    if (model === 'sublocations') return prisma.$transaction(async (tx) => {
      const type = input.sublocation_type || undefined;
      const sublocation = await tx.sublocations.update({
        where: { id: recordId },
        data: {
          location_id: input.location_id !== undefined ? number(input.location_id) : undefined,
          owner_id: input.owner_id !== undefined ? number(input.owner_id) : undefined,
          name: input.name !== undefined ? input.name : undefined,
          description: input.description !== undefined ? String(input.description).slice(0, ADMIN_DESCRIPTION_MAX_LENGTH) : undefined,
          sublocation_type: type,
          long_rest_price: input.sublocation_type !== undefined || input.long_rest_price !== undefined
            ? (type === SUBLOCATION_TYPE.INN ? price(input.long_rest_price) : 0)
            : undefined,
          food_water_refill_price: input.sublocation_type !== undefined || input.food_water_refill_price !== undefined
            ? (type === SUBLOCATION_TYPE.INN ? price(input.food_water_refill_price) : 0)
            : undefined
        }
      });
      const resolvedType = sublocation.sublocation_type;
      if (TRADING_SUBLOCATION_TYPES.includes(resolvedType)) {
        if (Array.isArray(input.items)) {
          await syncSublocationItems(tx, recordId, input.items);
        }
      } else {
        await tx.sublocations_items.updateMany({ where: { sublocation_id: recordId }, data: { deleted: true } });
      }
      return tx.sublocations.findUnique({ where: { id: recordId }, include: sublocationInclude });
    });
    if (model === 'items') {
      const { item_bonus, skills, ...item } = input;
      await prisma.items.update({
        where: { id: recordId },
        data: {
          name: nullable(item.name),
          type: item.type,
          weapon_type: item.weapon_type || undefined,
          rarity: item.rarity,
          size: number(item.size, 1),
          is_stackable: Boolean(item.is_stackable),
          max_stack: number(item.max_stack, 1),
          max_upgrade_level: number(item.max_upgrade_level, 0),
          description: nullable(item.description),
          price: number(item.price),
          is_buyable: Boolean(item.is_buyable),
          is_consumable: Boolean(item.is_consumable),
          is_material: Boolean(item.is_material),
          is_nsfw: Boolean(item.is_nsfw)
        },
        include: itemInclude
      });
      if (item_bonus || Array.isArray(input.item_effects)) {
        const bonus = itemBonusData(item_bonus || {});
        await prisma.item_bonus.upsert({ where: { item_id: recordId }, create: { item_id: recordId, ...bonus }, update: bonus });
      }
      await syncItemBonusEffects(prisma, recordId, input.item_effects);
      await syncItemSkills(prisma, recordId, skills);
      return prisma.items.findUnique({ where: { id: recordId }, include: itemInclude });
    }
    if (model === 'characters') return updateCharacter(recordId, input);
    if (model === 'prefixes') return prisma.prefixes.update({ where: { id: recordId }, data: prefixSuffixData(input) });
    if (model === 'suffixes') return prisma.suffixes.update({ where: { id: recordId }, data: prefixSuffixData(input) });
    if (model === 'stories') {
      return prisma.stories.update({
        where: { id: recordId },
        data: {
          story: input.story !== undefined ? String(input.story) : undefined,
          action_from_player: input.action_from_player !== undefined ? String(input.action_from_player) : undefined
        },
        include: { character: { select: { id: true, name: true } } }
      });
    }
    if (model === 'ambiences') return saveAmbience(input, recordId);
    if (model === 'character_scenes') return prisma.character_scenes.update({ where: { id: recordId }, data: await characterSceneData(prisma, input, false), include: characterSceneInclude });
    throw new Error('Unsupported admin model.');
  } catch (error) { fail(`updateAdmin${model}`, 'update', error); }
}

async function updateCharacter(id, input, client = prisma) {
  const update = async (tx) => {
    const existing = await tx.characters.findUnique({ where: { id }, select: { character_type: true, deleted: true } });
    if (!existing) throw new Error('Character not found.');
    if (existing.deleted) throw new Error('Deleted characters cannot be edited.');
    const type = existing.character_type;
    if (type === CHARACTER_TYPE.PLAYER && input.user_id) {
      const conflict = await tx.characters.findFirst({
        where: { user_id: input.user_id, id: { not: id }, deleted: false }
      });
      if (conflict) {
        throw new Error(`User is already assigned to character "${conflict.name || conflict.id}". Each user can only own one character.`);
      }
    }
    const character = await tx.characters.update({
      where: { id },
      data: {
        user_id: type === CHARACTER_TYPE.PLAYER ? nullable(input.user_id) : null,
        name: nullable(input.name),
        race: nullable(input.race),
        age: number(input.age),
        job: nullable(input.job),
        sex: input.sex !== undefined ? normalizeSex(input.sex) : undefined,
        alignment: nullable(input.alignment),
        appearance: nullable(input.appearance),
        description: nullable(input.description),
        location_id: number(input.location_id, 1),
        sublocation_id: input.sublocation_id !== undefined ? (input.sublocation_id ? number(input.sublocation_id) : null) : undefined,
        respawn_location_id: number(input.respawn_location_id, 1),
        level: number(input.level, 1),
        ...(input.current_exp !== undefined ? { current_exp: number(input.current_exp, 0) } : {}),
        ...(input.is_updated_by_user !== undefined ? { is_updated_by_user: Boolean(input.is_updated_by_user) } : {}),
        ...(input.image_data !== undefined ? { image_data: imageDataToBuffer(input.image_data) } : {})
      }
    });
    if (type === CHARACTER_TYPE.PLAYER) {
      await tx.players.upsert({ where: { character_id: id }, create: { character_id: id, gold: number(input.gold, DEFAULT_STARTING_GOLD), verified: Boolean(input.verified), is_nsfw: Boolean(input.is_nsfw), current_point_spend: number(input.current_point_spend, INITIAL_ATTRIBUTE_POINT_BUDGET) }, update: { ...(input.gold !== undefined ? { gold: number(input.gold, DEFAULT_STARTING_GOLD) } : {}), ...(input.verified !== undefined ? { verified: Boolean(input.verified) } : {}), ...(input.is_nsfw !== undefined ? { is_nsfw: Boolean(input.is_nsfw) } : {}), ...(input.current_point_spend !== undefined ? { current_point_spend: number(input.current_point_spend, INITIAL_ATTRIBUTE_POINT_BUDGET) } : {}), deleted: false } });
      await tx.npcs.updateMany({ where: { character_id: id }, data: { deleted: true } });
      await tx.npc_monsters.updateMany({ where: { character_id: id }, data: { deleted: true } });
    } else {
      await tx.players.updateMany({ where: { character_id: id }, data: { deleted: true } });
      await tx.npcs.upsert({ where: { character_id: id }, create: { character_id: id, is_attackable: input.npc?.is_attackable ?? true, is_speakable: Boolean(input.npc?.is_speakable), is_recruitable: Boolean(input.npc?.is_recruitable) && !input.npc?.npc_monster }, update: { is_attackable: input.npc?.is_attackable ?? true, is_speakable: Boolean(input.npc?.is_speakable), is_recruitable: Boolean(input.npc?.is_recruitable) && !input.npc?.npc_monster, deleted: false } });
      if (input.npc?.npc_monster) await tx.npc_monsters.upsert({ where: { character_id: id }, create: { character_id: id, experience_reward: number(input.npc.npc_monster.experience_reward, 0) }, update: { experience_reward: number(input.npc.npc_monster.experience_reward, 0), deleted: false } });
      else await tx.npc_monsters.updateMany({ where: { character_id: id }, data: { deleted: true } });
    }
    if (type === CHARACTER_TYPE.PLAYER) {
      await syncPlayerNpcRelationships(tx, id, input.player_npc_relationships || []);
    } else if (input.npc?.npc_monster) {
      await syncNpcPlayerRelationships(tx, id, []);
      await syncNpcRelationships(tx, id, []);
      await syncNpcKnownLocations(tx, id, []);
      await syncNpcAppearances(tx, id, []);
    } else {
      await syncNpcPlayerRelationships(tx, id, input.player_npc_relationships || []);
      await syncNpcRelationships(tx, id, input.npc_relationships || []);
      await syncNpcKnownLocations(tx, id, input.npc_known_locations || []);
      if (Array.isArray(input.npc_appearances)) await syncNpcAppearances(tx, id, input.npc_appearances);
    }
    if (input.stats) { const stats = numericObject(input.stats); await tx.character_stats.upsert({ where: { character_id: id }, create: { character_id: id, ...stats }, update: stats }); }
    if (Array.isArray(input.spellpoints)) {
      await tx.character_spellpoints.deleteMany({ where: { character_id: id } });
      const spellpoints = input.spellpoints
        .map((x) => ({
          character_id: id,
          level: number(x.level, 1),
          max_current: number(x.max_current, 0),
          current: number(x.current, 0)
        }))
        .filter((x) => x.level !== null);
      if (spellpoints.length) await tx.character_spellpoints.createMany({ data: spellpoints });
    }
    if (Array.isArray(input.memories)) {
      await tx.character_memories.deleteMany({ where: { character_id: id } });
      const memories = input.memories
        .map((x) => ({
          character_id: id,
          target_character_id: number(x.target_character_id),
          memory_type: VALID_MEMORY_TYPES.includes(x.memory_type) ? x.memory_type : MEMORY_TYPE.SEMANTIC,
          content: String(x.content || x.memory || '').trim(),
          is_secret: Boolean(x.is_secret),
          is_nsfw: Boolean(x.is_nsfw)
        }))
        .filter((x) => x.content);
      if (memories.length) await tx.character_memories.createMany({ data: memories });
    }
    if (Array.isArray(input.lifeskills)) {
      await tx.character_lifeskills.deleteMany({ where: { character_id: id } });
      const map = new Map();
      for (const x of input.lifeskills) {
        const lsId = number(x.lifeskill_id);
        if (lsId !== null && !map.has(lsId)) {
          map.set(lsId, {
            character_id: id,
            lifeskill_id: lsId,
            current_level: number(x.current_level, 1),
            current_exp: number(x.current_exp, 0)
          });
        }
      }
      const rows = [...map.values()];
      if (rows.length) await tx.character_lifeskills.createMany({ data: rows });
    }
    if (Array.isArray(input.skills)) {
      await tx.character_skills.deleteMany({ where: { character_id: id } });
      const uniqueSkills = uniqueIds(input.skills);
      if (uniqueSkills.length) {
        await tx.character_skills.createMany({
          data: uniqueSkills.map((skillId) => ({ character_id: id, skill_id: skillId }))
        });
      }
    }
    if (Array.isArray(input.effects)) {
      await tx.character_effects.deleteMany({ where: { character_id: id } });
      const map = new Map();
      for (const effect of input.effects) {
        const efId = number(effect.effect_id);
        if (efId !== null && !map.has(efId)) {
          map.set(efId, {
            character_id: id,
            effect_id: efId,
            duration_turn: number(effect.duration_turn, 0)
          });
        }
      }
      const rows = [...map.values()];
      if (rows.length) await tx.character_effects.createMany({ data: rows });
    }
    if (input.inventory) {
      const inventory = await tx.character_inventory.upsert({ where: { character_id: id }, create: { character_id: id, max_slots: number(input.inventory.max_slots, DEFAULT_BACKPACK_SLOTS) }, update: { max_slots: number(input.inventory.max_slots, DEFAULT_BACKPACK_SLOTS) } });
      await tx.character_inventory.update({ where: { id: inventory.id }, data: { deleted: false } });
    }
    await syncCharacterItems(tx, id, input);
    if (type === CHARACTER_TYPE.PLAYER && input.vault) {
      await syncCharacterVault(tx, id, input.vault);
    }
    const refreshedCharacter = await tx.characters.findUnique({ where: { id }, include: characterInclude });
    return refreshedCharacter ? { ...refreshedCharacter, character_memories: refreshedCharacter.character_owner_memories || [] } : refreshedCharacter;
  };
  return client === prisma ? prisma.$transaction(update) : update(client);
}

async function deleteCharacter(id) {
  return prisma.$transaction(async (tx) => {
    const character = await tx.characters.findUnique({ where: { id }, select: { id: true } });
    if (!character) throw new Error('Character not found.');
    const inventory = await tx.character_inventory.findUnique({ where: { character_id: id }, select: { id: true } });
    const vault = await tx.character_vaults.findUnique({ where: { character_id: id }, select: { id: true } });
    await tx.characters.update({ where: { id }, data: { deleted: true } });
    await tx.players.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.npcs.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.npc_monsters.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_items.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_stats.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_spellpoints.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_memories.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_lifeskills.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_skills.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.character_effects.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.player_npc_relationships.updateMany({
      where: { OR: [{ player_character_id: id }, { npc_character_id: id }] },
      data: { deleted: true }
    });
    await tx.npc_relationships.updateMany({
      where: { OR: [{ source_npc_id: id }, { target_npc_id: id }] },
      data: { deleted: true }
    });
    await tx.npc_known_locations.updateMany({ where: { character_id: id }, data: { deleted: true } });
    await tx.npcs_in_locations_or_sublocations.updateMany({ where: { npc_id: id }, data: { deleted: true } });
    await tx.npcmonsters_lootgroups.updateMany({ where: { npc_monster_id: id }, data: { deleted: true } });
    if (inventory) {
      await tx.character_inventory.update({ where: { id: inventory.id }, data: { deleted: true } });
    }
    if (vault) {
      await tx.character_vaults.update({ where: { id: vault.id }, data: { deleted: true } });
    }
    return { id, deleted: true };
  });
}

export async function deleteAdminRecord(model, id) {
  try {
    const delegate = prisma[model];
    if (!delegate) throw new Error('Unsupported admin model.');
    if (model === 'lifeskills') return prisma.$transaction(async (tx) => {
      await tx.character_lifeskills.deleteMany({ where: { lifeskill_id: number(id) } });
      return tx.lifeskills.delete({ where: { id: number(id) } });
    });
    if (model === 'loot_groups') return prisma.$transaction(async (tx) => {
      const groupId = number(id);
      await tx.lootgroups_items.updateMany({ where: { loot_group_id: groupId }, data: { deleted: true } });
      await tx.npcmonsters_lootgroups.updateMany({ where: { loot_group_id: groupId }, data: { deleted: true } });
      await tx.locations_lootgroups.updateMany({ where: { loot_group_id: groupId }, data: { deleted: true } });
      return tx.loot_groups.update({ where: { id: groupId }, data: { deleted: true } });
    });
    if (model === 'locations') return prisma.$transaction(async (tx) => {
      const locationId = number(id);
      await tx.location_routes.updateMany({ where: { deleted: false, OR: [{ location_a_id: locationId }, { location_b_id: locationId }] }, data: { deleted: true } });
      await tx.locations_lootgroups.updateMany({ where: { location_id: locationId }, data: { deleted: true } });
      return tx.locations.update({ where: { id: locationId }, data: { deleted: true } });
    });
    if (model === 'sublocations') return prisma.$transaction(async (tx) => {
      const subId = number(id);
      await tx.sublocations_items.updateMany({ where: { sublocation_id: subId }, data: { deleted: true } });
      await tx.characters.updateMany({ where: { sublocation_id: subId }, data: { sublocation_id: null } });
      return tx.sublocations.update({ where: { id: subId }, data: { deleted: true } });
    });
    if (model === 'quests') return prisma.$transaction(async (tx) => {
      const questId = number(id);
      await tx.character_quests.updateMany({ where: { quest_id: questId, status: QUEST_STATUS.ACTIVE, deleted: false }, data: { status: QUEST_STATUS.FAILED } });
      return tx.quests.update({ where: { id: questId }, data: { deleted: true } });
    });
    if (model === 'characters') return deleteCharacter(number(id));
    if (model === 'stories') return prisma.stories.delete({ where: { id: number(id) } });
    return delegate.update({ where: { id: number(id) }, data: { deleted: true } });
  } catch (error) { fail(`deleteAdmin${model}`, 'delete', error); }
}
