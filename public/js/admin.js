const state = {
  model: 'users',
  data: {},
  editing: null,
  activeCharacterTab: 'identity',
  characterStats: {},
  appliedRelations: new Set(),
  userFilter: '',
  userStatus: 'all',
  userSort: 'id',
  userSortDirection: 'asc',
  userPage: 1,
  userPageSize: 50,
  userLoadTimer: null,
  filters: {
    characters: { search: '', level: '', type: '', status: '' },
    items: { search: '', type: '', rarity: '', weapon_type: '' },
    skills: { search: '', type: '', rarity: '', damage_type: '', target_rule: '', weapon_type: '' },
    effects: { search: '', effect_type: '' },
    lifeskills: { search: '' },
    regions: { search: '' },
    locations: { search: '', region_id: '', zone_type: '' },
    sublocations: { search: '', location_id: '', sublocation_type: '' },
    ambiences: { search: '', location_id: '', time_slot: '', crowd_level: '' },
    loot_groups: { search: '' },
    crafting_recipes: { search: '', lifeskill_id: '' },
    quests: { search: '', objective_type: '', source_npc_id: '', repeatable: '' },
    prefixes: { search: '', rarity: '', tier: '' },
    suffixes: { search: '', rarity: '', tier: '' },
    stories: { search: '' },
    character_scenes: { search: '', character_name: '', party_id: '', npc_type: '', scene_stage: '' }
  },
  sceneSelection: new Set(),
  sceneMemoryType: 'EPISODIC',
  sceneSummarizing: false,
  modelSort: {
    column: 'id',
    direction: 'asc'
  },
  page: 1,
  pageSize: 25,
  worldMapSelectedLocationId: null,
  worldState: null,
  worldStateTimer: null,
  worldStateClockTimer: null
};

const skillWeaponTypes = ['ANY_WEAPON', 'SWORD', 'GREATSWORD', 'SHORTSWORD', 'KNIFE', 'AXE', 'SPEAR', 'CLUB', 'STAFF', 'QUARTERSTAFF', 'BOW', 'SHIELD', 'NONE'];

const worldMapViewState = { scale: 1, x: 0, y: 0, drag: null, dragged: false };

const statFields = [
  'proficiency', 'intelligent', 'strength', 'dexterity', 'charisma', 'constitution', 'wisdom',
  'armor', 'magic_armor',
  'fire_element_resistant', 'ice_element_resistant', 'earth_element_resistant', 'lightning_element_resistant',
  'wind_element_resistant', 'holy_element_resistant', 'dark_element_resistant', 'status_resistant', 'accuracy', 'base_crit_chance', 'base_crit_damage',
  'max_hp', 'current_hp', 'max_energy', 'current_energy', 'max_food', 'current_food', 'max_water', 'current_water'
];

const statDefaults = {
  proficiency: 2, intelligent: 5, strength: 5, dexterity: 5, charisma: 5, constitution: 5, wisdom: 5,
  armor: 5, magic_armor: 4,
  fire_element_resistant: 5, ice_element_resistant: 5, earth_element_resistant: 5, lightning_element_resistant: 5,
  wind_element_resistant: 5, holy_element_resistant: 3, dark_element_resistant: 3, status_resistant: 4, accuracy: 1, base_crit_chance: 0, base_crit_damage: 0,
  max_hp: 10, current_hp: 10, max_energy: 100, current_energy: 100,
  max_food: 100, current_food: 100, max_water: 100, current_water: 100
};

const effectFields = [
  'max_hp_bonus', 'healing_current_hp', 'current_food_bonus', 'current_water_bonus', 'current_energy_bonus',
  'proficiency_bonus', 'intelligent_bonus', 'strength_bonus',
  'dexterity_bonus', 'charisma_bonus', 'constitution_bonus', 'wisdom_bonus', 'armor_bonus',
  'magical_armor_bonus', 'physical_attack_bonus', 'magical_attack_bonus', 'effect_resistant_bonus',
  'fire_element_resistant', 'ice_element_resistant', 'earth_element_resistant', 'lightning_element_resistant',
  'wind_element_resistant', 'holy_element_resistant', 'dark_element_resistant', 'crit_chance_bonus', 'crit_damage_bonus', 'evade_chance_bonus', 'accuracy_bonus'
];

const jsonFields = new Set(['spellpoints', 'memories', 'lifeskills', 'skills', 'effects', 'inventory', 'equipment']);

const skillFields = [
  ['name', 'Name', 'text'],
  ['type', 'Type', 'select:ATTACK,MAGIC_ATTACK,DEFEND,SPELL'],
  ['rarity', 'Rarity', 'select:NORMAL,UNCOMMON,RARE,UNIQUE,MYSTIC,LEGENDARY,ANCIENT'],
  ['skill_target_rule', 'Target rule', 'select:SELF_ONLY,ALL_PARTY_MEMBERS,ON_SELECTED_ALLY,ON_SELECTED_ENEMY,ALL_ENEMIES,TO_ALL'],
  ['skill_damage_type', 'Damage type', 'select:PHYSICAL,MAGICAL,HYBRID'],
  ['healing_current_hp', 'Healing current HP', 'number'],
  ['cure_effect_type', 'Cure effect', 'select:NONE,STUN,DAZE,WEAK,BLIND,POISON'],
  ['attack_amplifier', 'Attack amplifier', 'number'],
  ['magical_attack_amplifier', 'Magic attack amplifier', 'number'],
  ['armor_amplifier', 'Armor amplifier', 'number'],
  ['magical_armor_amplifier', 'Magic armor amplifier', 'number'],
  ['fire_damage', 'Fire damage', 'number'],
  ['ice_damage', 'Ice damage', 'number'],
  ['earth_damage', 'Earth damage', 'number'],
  ['lightning_damage', 'Lightning damage', 'number'],
  ['wind_damage', 'Wind damage', 'number'],
  ['holy_damage', 'Holy damage', 'number'],
  ['dark_damage', 'Dark damage', 'number'],
  ['energy_consume_cost', 'Energy cost', 'number'],
  ['duration', 'Duration (turns)', 'number']
];

const models = {
  users: {
    label: 'Users',
    fields: [
      ['username', 'Username', 'text', true],
      ['password', 'Password (leave blank to keep)', 'password'],
      ['is_admin', 'Administrator', 'checkbox']
    ]
  },
  characters: {
    label: 'Characters',
    fields: [
      ['character_type', 'Character type', 'select:PLAYER,NPC'],
      ['user_id', 'Owner user', 'user_picker', true, 'player'],
      ['name', 'Name', 'text'],
      ['race', 'Race', 'text'],
      ['age', 'Age', 'number'],
      ['job', 'Job', 'text'],
      ['sex', 'Sex', 'select:MALE,FEMALE,OTHER'],
      ['alignment', 'Alignment', 'select_or_text:Lawful Good,Neutral Good,Chaotic Good,Lawful Neutral,True Neutral,Chaotic Neutral,Lawful Evil,Neutral Evil,Chaotic Evil,Unaligned'],
      ['level', 'Level', 'number'],
      ['current_exp', 'Experience', 'number'],
      ['gold', 'Gold', 'number', 'player'],
      ['current_point_spend', 'Point spend', 'number', 'player'],
      ['location_id', 'Location', 'location_picker'],
      ['sublocation_id', 'SubLocation', 'sublocation_picker'],
      ['respawn_location_id', 'Respawn location', 'location_picker'],
      ['is_updated_by_user', 'Updated by user', 'checkbox', 'player'],
      ['verified', 'Verified', 'checkbox', 'player'],
      ['is_nsfw', 'NSFW', 'checkbox', 'player'],
      ['npc_is_attackable', 'Attackable', 'checkbox', 'npc'],
      ['npc_is_speakable', 'Speakable', 'checkbox', 'npc'],
      ['is_monster', 'Monster', 'checkbox', 'npc'],
      ['experience_reward', 'Experience reward', 'number', 'monster'],
      ['appearance', 'Appearance', 'textarea', 'full'],
      ['description', 'Description', 'textarea', 'full']
    ]
  },
  items: {
    label: 'Items',
    fields: [
      ['name', 'Name', 'text'],
      ['type', 'Type', 'select:HELMET,ARMOR,SHOES,GLOVES,EARRING,RING,NECKLACE,BELT,MAIN_HAND,TWO_HAND,QUEST_ITEMS,MISCS,FOOD,FISH,POTION'],
      ['weapon_type', 'Weapon type', 'select:SWORD,BOW,STAFF,QUARTERSTAFF,AXE,SPEAR,GREATSWORD,SHORTSWORD,CLUB,KNIFE'],
      ['rarity', 'Rarity', 'select:NORMAL,UNCOMMON,RARE,UNIQUE,MYSTIC,LEGENDARY,ANCIENT'],
      ['size', 'Size', 'number'],
      ['price', 'Price', 'number'],
      ['is_stackable', 'Stackable', 'checkbox'],
      ['max_stack', 'Max stack', 'number'],
      ['max_upgrade_level', 'Max upgrade level', 'number'],
      ['is_buyable', 'Buyable', 'checkbox'],
      ['is_consumable', 'Consumable', 'checkbox'],
      ['is_material', 'Material', 'checkbox'],
      ['is_nsfw', 'NSFW', 'checkbox'],
      ['description', 'Description', 'textarea', 'full'],
      ['effect.item_trigger_type', 'Bonus trigger', 'select:NONE,ON_START_OF_TURN,ON_END_OF_TURN,AT_TURN_NUMBER,EVERY_TURN'],
      ['effect.cure_effect_type', 'Cure effect', 'select:NONE,STUN,DAZE,WEAK,BLIND,POISON'],
      ...effectFields.map((field) => [`effect.${field}`, field, 'number'])
    ]
  },
  skills: { label: 'Skills', fields: skillFields },
  effects: {
    label: 'Effects',
    fields: [
      ['name', 'Name', 'text'],
      ['effect_type', 'Effect type', 'select:NONE,BUFF,CURE,HEALING,RECOVERY,STUN,DAZE,WEAK,BLIND,POISON,HUNGRY,STARVING,STARVATION,THIRSTY,DEHYDRATED,SEVERE_DEHYDRATION'],
      ['description', 'Description', 'textarea', 'full'],
    ]
  },
  lifeskills: {
    label: 'Lifeskills',
    fields: [
      ['name', 'Name', 'text'],
      ['description', 'Description', 'textarea', 'full']
    ]
  },
  regions: {
    label: 'Regions',
    fields: [
      ['name', 'Name', 'text'],
      ['description', 'Description', 'textarea', 'full'],
      ['geography', 'Geography', 'textarea'],
      ['politics', 'Politics', 'textarea'],
      ['culture', 'Culture', 'textarea']
    ]
  },
  locations: {
    label: 'Locations',
    fields: [
      ['region_id', 'Region', 'region_picker', true],
      ['name', 'Name', 'text'],
      ['location_type', 'Location type', 'select:VILLAGE,TOWN,CAPITAL,FORTRESS,STRONGHOLD,DANGER_FIELD,HUNTING_FIELD,DUNGEON'],
      ['is_safe_zone', 'Safe Zone (Peaceful town / vault access)', 'checkbox'],
      ['description', 'Description', 'textarea', 'full'],
      ['subgeography', 'Sub-geography', 'textarea'],
      ['subpolitics', 'Sub-politics', 'textarea'],
      ['subculture', 'Sub-culture', 'textarea']
    ]
  },
  world_map: { label: 'World Map', fields: [] },
  world_state: { label: 'World State', fields: [] },
  sublocations: {
    label: 'SubLocations',
    fields: [
      ['name', 'Name', 'text'],
      ['location_id', 'Location', 'location_picker'],
      ['sublocation_type', 'SubLocation type', 'select:DEFAULT,SECRET_HIDEOUT,HOUSE,CASTLE,MANSION,GUILD_OFFICE,ALLEY,SQUARE,INN,SHOP'],
      ['owner_id', 'Owner character', 'number'],
      ['description', 'Description', 'textarea', 'full']
    ]
  },
  ambiences: { label: 'Ambiences', fields: [] },
  loot_groups: {
    label: 'Loot Groups',
    fields: [
      ['name', 'Name', 'text'],
      ['loot_group_rarity', 'Rarity', 'select:COMMON,UNCOMMON,RARE,LEGENDARY,BOSS'],
      ['description', 'Description', 'textarea', 'full'],
      ['min_gold', 'Minimum gold', 'number'],
      ['max_gold', 'Maximum gold', 'number']
    ]
  },
  crafting_recipes: {
    label: 'Recipes',
    fields: [
      ['name', 'Name', 'text'],
      ['description', 'Description', 'textarea', 'full']
    ]
  },
  quests: {
    label: 'Quests',
    fields: [
      ['name', 'Name', 'text'],
      ['description', 'Description', 'textarea', 'full']
    ]
  },
  prefixes: {
    label: 'Prefixes',
    fields: [
      ['name', 'Name', 'text'],
      ['rarity', 'Rarity', 'select:NORMAL,UNCOMMON,RARE,UNIQUE,MYSTIC,LEGENDARY,ANCIENT'],
      ['tier', 'Tier', 'select:TIER_1,TIER_2,TIER_3,TIER_4'],
      ['crit_chance', 'Crit Chance (%)', 'number'],
      ['crit_damage', 'Crit Damage (%)', 'number']
    ]
  },
  suffixes: {
    label: 'Suffixes',
    fields: [
      ['name', 'Name', 'text'],
      ['rarity', 'Rarity', 'select:NORMAL,UNCOMMON,RARE,UNIQUE,MYSTIC,LEGENDARY,ANCIENT'],
      ['tier', 'Tier', 'select:TIER_1,TIER_2,TIER_3,TIER_4'],
      ['crit_chance', 'Crit Chance (%)', 'number'],
      ['crit_damage', 'Crit Damage (%)', 'number']
    ]
  },
  stories: {
    label: 'Stories',
    fields: [
      ['character_id', 'Character ID', 'number'],
      ['user_id', 'User ID (UUID)', 'text'],
      ['story', 'Story Narrative', 'textarea', 'full'],
      ['action_from_player', 'Latest Action', 'textarea', 'full']
    ]
  },
  character_scenes: {
    label: 'Scenes',
    fields: []
  }
};

const sceneStages = ['on_going', 'solved', 'abandoned'];
const sceneSummaryMemoryTypes = ['SEMANTIC', 'EPISODIC', 'SECRET'];
const SCENE_SUMMARY_MAX = 5;

function sceneHasNpc(scene) {
  return Boolean(scene?.npc_character_id && scene?.npc_character?.character_type === 'NPC');
}

const SCENE_NPC_TYPES = { NPC: 'NPC', PLAYER: 'PLAYER', MONSTER: 'MONSTER', NONE: 'NONE' };

function sceneNpcType(scene) {
  if (!scene?.npc_character_id) return SCENE_NPC_TYPES.NONE;
  if (scene.npc_character?.character_type === 'PLAYER') return SCENE_NPC_TYPES.PLAYER;
  const linked = (state.data.characters || []).find((character) => Number(character.id) === Number(scene.npc_character_id));
  const isMonster = Boolean(linked?.npc?.npc_monsters && linked.npc.npc_monsters.deleted !== true);
  return isMonster ? SCENE_NPC_TYPES.MONSTER : SCENE_NPC_TYPES.NPC;
}

function sceneDate(value) {
  return value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : '—';
}

function scenePlaceName(scene) {
  const location = (state.data.locations || []).find((loc) => Number(loc.id) === Number(scene.location_id));
  const sublocation = (state.data.sublocations || []).find((sub) => Number(sub.id) === Number(scene.sublocation_id));
  return { location: location ? `${location.name} (#${location.id})` : (scene.location_id ? `#${scene.location_id}` : '—'), sublocation: sublocation ? `${sublocation.name} (#${sublocation.id})` : (scene.sublocation_id ? `#${scene.sublocation_id}` : '—') };
}

function pruneSceneSelection() {
  const valid = new Set((state.data.character_scenes || []).filter(sceneHasNpc).map((scene) => scene.id));
  [...state.sceneSelection].forEach((id) => { if (!valid.has(id)) state.sceneSelection.delete(id); });
}

function updateSceneSummarizeBar() {
  const count = state.sceneSelection.size;
  const button = $('#sceneSummarizeButton');
  const label = $('#sceneSelectionCount');
  if (label) label.textContent = `${count}/${SCENE_SUMMARY_MAX} selected`;
  if (button) {
    button.disabled = !count || state.sceneSummarizing;
    button.textContent = state.sceneSummarizing ? 'Summarizing…' : 'Summarize scene to memory';
  }
  const clear = $('#sceneSelectionClear');
  if (clear) clear.disabled = !count || state.sceneSummarizing;
}

async function summarizeSelectedScenes() {
  const sceneIds = [...state.sceneSelection];
  if (!sceneIds.length || state.sceneSummarizing) return;
  if (!confirm(`Summarize ${sceneIds.length} scene${sceneIds.length === 1 ? '' : 's'} into ${state.sceneMemoryType} NPC memory?`)) return;
  state.sceneSummarizing = true;
  updateSceneSummarizeBar();
  try {
    const result = await api('/api/admin/character_scenes/summarize', {
      method: 'POST',
      body: JSON.stringify({ scene_ids: sceneIds, memory_type: state.sceneMemoryType })
    });
    const details = (result.results || []).map((entry) => `${entry.npc_name} → memory #${entry.memory?.id ?? '?'}${entry.is_fallback ? ' (fallback text)' : ''}`).join('; ');
    show(`${result.message}${details ? ` ${details}` : ''}`);
    state.sceneSelection.clear();
  } catch (error) {
    show(error.message, true);
  } finally {
    state.sceneSummarizing = false;
    renderTable();
    updateSceneSummarizeBar();
  }
}

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const AI_API_KEY_STORAGE_KEY = 'stervian.aiApiKey';
const AI_API_KEY_HEADER = 'x-ai-api-key';

function adminAiApiKeyHeaders() {
  try {
    const key = localStorage.getItem(AI_API_KEY_STORAGE_KEY);
    return key ? { [AI_API_KEY_HEADER]: key } : {};
  } catch {
    return {};
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...adminAiApiKeyHeaders() },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(body.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

function show(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').className = `notice${error ? ' error' : ''}`;
  if (message) {
    setTimeout(() => {
      if ($('#notice').textContent === message) $('#notice').textContent = '';
    }, 6000);
  }
}

function getFilteredRecords(model = state.model) {
  const list = [...(state.data[model] || [])];
  if (model === 'users') return list;

  const f = state.filters[model] || {};
  let filtered = list;

  if (model === 'characters') {
    const q = String(f.search || '').trim().toLowerCase();
    const lvl = String(f.level ?? '').trim();
    const kind = (c) => (c.character_type !== 'NPC' ? 'PLAYER' : (c.npc?.npc_monsters && c.npc.npc_monsters.deleted !== true ? 'MONSTER' : 'NPC'));
    filtered = list.filter((c) => {
      const matchName = !q || String(c.name || '').toLowerCase().includes(q);
      const matchLevel = !lvl || Number(c.level || 1) === Number(lvl);
      const matchType = !f.type || kind(c) === f.type;
      const matchStatus = !f.status || (f.status === 'deleted' ? Boolean(c.deleted) : !c.deleted);
      return matchName && matchLevel && matchType && matchStatus;
    });
  } else if (model === 'items') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((item) => {
      const matchSearch = !q || `${item.name || ''} ${item.id} ${item.type} ${item.rarity} ${item.weapon_type || ''} ${item.description || ''}`.toLowerCase().includes(q);
      const matchType = !f.type || item.type === f.type;
      const matchRarity = !f.rarity || item.rarity === f.rarity;
      const matchWeapon = !f.weapon_type || item.weapon_type === f.weapon_type;
      return matchSearch && matchType && matchRarity && matchWeapon;
    });
  } else if (model === 'skills') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((sk) => {
      const matchSearch = !q || `${sk.name || ''} ${sk.id} ${sk.type} ${sk.rarity} ${sk.skill_damage_type || ''} ${sk.skill_target_rule || ''}`.toLowerCase().includes(q);
      const matchType = !f.type || sk.type === f.type;
      const matchRarity = !f.rarity || sk.rarity === f.rarity;
      const matchDamage = !f.damage_type || sk.skill_damage_type === f.damage_type;
      const weaponList = (sk.for_weapon_types || []).map((entry) => entry.weapon_type);
      const matchWeapon = !f.weapon_type || (f.weapon_type === 'ANY' ? !weaponList.length : weaponList.includes(f.weapon_type));
      return matchSearch && matchType && matchRarity && matchDamage && matchWeapon;
    });
  } else if (model === 'effects') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((ef) => {
      const matchSearch = !q || `${ef.name || ''} ${ef.id} ${ef.effect_type} ${ef.description || ''}`.toLowerCase().includes(q);
      const matchType = !f.effect_type || ef.effect_type === f.effect_type;
      return matchSearch && matchType;
    });
  } else if (model === 'lifeskills') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((ls) => !q || `${ls.name || ''} ${ls.id} ${ls.description || ''}`.toLowerCase().includes(q));
  } else if (model === 'regions') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((rg) => !q || `${rg.name || ''} ${rg.id} ${rg.description || ''} ${rg.geography || ''} ${rg.politics || ''} ${rg.culture || ''}`.toLowerCase().includes(q));
  } else if (model === 'locations') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((loc) => {
      const matchSearch = !q || `${loc.name || ''} ${loc.id} ${loc.region?.name || ''} ${loc.location_type || ''} ${loc.description || ''}`.toLowerCase().includes(q);
      const matchRegion = !f.region_id || Number(loc.region_id) === Number(f.region_id);
      const matchZone = !f.zone_type || (f.zone_type === 'safe' ? Boolean(loc.is_safe_zone) : !loc.is_safe_zone);
      return matchSearch && matchRegion && matchZone;
    });
  } else if (model === 'sublocations') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((sub) => {
      const matchSearch = !q || `${sub.name || ''} ${sub.id} ${sub.location?.name || ''} ${sub.sublocation_type || ''} ${sub.description || ''}`.toLowerCase().includes(q);
      const matchLocation = !f.location_id || Number(sub.location_id) === Number(f.location_id);
      const matchType = !f.sublocation_type || sub.sublocation_type === f.sublocation_type;
      return matchSearch && matchLocation && matchType;
    });
  } else if (model === 'ambiences') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((amb) => {
      const figureText = (amb.figures || []).map((fig) => fig.label).join(' ');
      const matchSearch = !q || `${amb.id} ${amb.title || ''} ${amb.location?.name || ''} ${amb.sublocation?.name || ''} ${amb.description || ''} ${figureText}`.toLowerCase().includes(q);
      const matchLocation = !f.location_id || Number(amb.location_id) === Number(f.location_id);
      const matchSlot = !f.time_slot || amb.time_slot === f.time_slot;
      const matchCrowd = !f.crowd_level || amb.crowd_level === f.crowd_level;
      return matchSearch && matchLocation && matchSlot && matchCrowd;
    });
  } else if (model === 'loot_groups') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((lg) => !q || `${lg.name || ''} ${lg.id} ${lg.description || ''}`.toLowerCase().includes(q));
  } else if (model === 'crafting_recipes') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((recipe) => {
      const ingredientNames = (recipe.ingredients || []).map((ing) => ing.item?.name || '').join(' ');
      const matchSearch = !q || `${recipe.name || ''} ${recipe.id} ${recipe.description || ''} ${recipe.output_item?.name || ''} ${ingredientNames}`.toLowerCase().includes(q);
      const matchSkill = !f.lifeskill_id || Number(recipe.lifeskill_id) === Number(f.lifeskill_id);
      return matchSearch && matchSkill;
    });
  } else if (model === 'quests') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((quest) => {
      const matchSearch = !q || `${quest.name || ''} ${quest.id} ${quest.description || ''} ${quest.source_npc?.character?.name || ''} ${questTargetName(quest)}`.toLowerCase().includes(q);
      const matchType = !f.objective_type || quest.objective_type === f.objective_type;
      const matchNpc = !f.source_npc_id || Number(quest.source_npc_id) === Number(f.source_npc_id);
      const matchRepeat = !f.repeatable || (f.repeatable === 'repeatable' ? Boolean(quest.repeatable) : !quest.repeatable);
      return matchSearch && matchType && matchNpc && matchRepeat;
    });
  } else if (model === 'prefixes' || model === 'suffixes') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((p) => {
      const matchSearch = !q || `${p.name || ''} ${p.id}`.toLowerCase().includes(q);
      const matchRarity = !f.rarity || p.rarity === f.rarity;
      const matchTier = !f.tier || p.tier === f.tier;
      return matchSearch && matchRarity && matchTier;
    });
  } else if (model === 'stories') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((st) => {
      const charName = st.character?.name || '';
      return !q || `${st.id} ${charName} ${st.story || ''} ${st.action_from_player || ''}`.toLowerCase().includes(q);
    });
  } else if (model === 'character_scenes') {
    const q = String(f.search || '').trim().toLowerCase();
    filtered = list.filter((scene) => {
      const matchSearch = !q || `${scene.id} ${scene.scene_goal || ''} ${scene.scene_notes || ''} ${scene.character?.name || ''} ${scene.npc_character?.name || ''}`.toLowerCase().includes(q);
      const characterQuery = String(f.character_name || '').trim().toLowerCase();
      const matchCharacter = !characterQuery || `${scene.character?.name || ''} ${scene.character_id}`.toLowerCase().includes(characterQuery);
      const matchParty = !String(f.party_id || '').trim() || Number(scene.party_id) === Number(f.party_id);
      const matchNpcType = !f.npc_type || sceneNpcType(scene) === f.npc_type;
      const matchStage = !f.scene_stage || scene.scene_stage === f.scene_stage;
      return matchSearch && matchCharacter && matchParty && matchNpcType && matchStage;
    });
  }

  // Sorting
  const sortCol = state.modelSort.column;
  const sortDir = state.modelSort.direction === 'desc' ? -1 : 1;

  filtered.sort((a, b) => {
    let valA = a[sortCol];
    let valB = b[sortCol];

    if (sortCol === 'region') { valA = a.region?.name || ''; valB = b.region?.name || ''; }
    if (sortCol === 'location') { valA = a.location?.name || ''; valB = b.location?.name || ''; }
    if (sortCol === 'character' || sortCol === 'character_id') { valA = a.character?.name || a.character_id || ''; valB = b.character?.name || b.character_id || ''; }
    if (sortCol === 'sublocation_type') { valA = a.sublocation_type || ''; valB = b.sublocation_type || ''; }
    if (sortCol === 'sublocations_items') { valA = a.sublocations_items?.length || 0; valB = b.sublocations_items?.length || 0; }
    if (sortCol === 'locations') { valA = a.locations?.length || 0; valB = b.locations?.length || 0; }
    if (sortCol === 'characters') { valA = a.character_lifeskills?.length || 0; valB = b.character_lifeskills?.length || 0; }
    if (sortCol === 'skill_weapons') { valA = (a.for_weapon_types || []).map((entry) => entry.weapon_type).sort().join(','); valB = (b.for_weapon_types || []).map((entry) => entry.weapon_type).sort().join(','); }
    if (sortCol === 'effects') { valA = a.skill_effects?.length || 0; valB = b.skill_effects?.length || 0; }
    if (sortCol === 'skills') { valA = a.skill_effects?.length || 0; valB = b.skill_effects?.length || 0; }
    if (sortCol === 'items') { valA = a.items?.length || 0; valB = b.items?.length || 0; }
    if (sortCol === 'lifeskill') { valA = a.lifeskill?.name || ''; valB = b.lifeskill?.name || ''; }
    if (sortCol === 'output') { valA = a.output_item?.name || ''; valB = b.output_item?.name || ''; }
    if (sortCol === 'source_npc') { valA = a.source_npc?.character?.name || ''; valB = b.source_npc?.character?.name || ''; }
    if (sortCol === 'target') { valA = questTargetName(a); valB = questTargetName(b); }
    if (sortCol === 'rewards') { valA = Number(a.gold_reward || 0); valB = Number(b.gold_reward || 0); }
    if (sortCol === 'active_runs') { valA = a._count?.character_quests || 0; valB = b._count?.character_quests || 0; }
    if (sortCol === 'repeatable') { valA = a.repeatable ? 1 : 0; valB = b.repeatable ? 1 : 0; }
    if (sortCol === 'ingredients') { valA = a.ingredients?.length || 0; valB = b.ingredients?.length || 0; }
    if (sortCol === 'monsters') { valA = a.npcmonsters_lootgroups?.length || 0; valB = b.npcmonsters_lootgroups?.length || 0; }
    if (sortCol === 'zone_type') { valA = a.is_safe_zone ? 1 : 0; valB = b.is_safe_zone ? 1 : 0; }
    if (sortCol === 'bonus') { valA = (a.item_bonus ? 1 : 0) + (a.item_bonus?.itembonus_effects?.length || 0); valB = (b.item_bonus ? 1 : 0) + (b.item_bonus?.itembonus_effects?.length || 0); }

    if (valA === valB) return (a.id - b.id) * sortDir;
    if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * sortDir;
    return String(valA ?? '').localeCompare(String(valB ?? '')) * sortDir;
  });

  return filtered;
}

function rows() {
  if (state.model === 'users') return [...(state.data.users || [])];
  const allFiltered = getFilteredRecords();
  const start = (state.page - 1) * state.pageSize;
  return allFiltered.slice(start, start + state.pageSize);
}

function resetUserFilters() {
  state.userFilter = '';
  state.userStatus = 'all';
  state.userSort = 'id';
  state.userSortDirection = 'asc';
  state.userPage = 1;
  clearTimeout(state.userLoadTimer);
  $('#userFilter').value = '';
  $('#userStatus').value = 'all';
}

function renderModelFilters() {
  const container = $('#modelFilters');
  const paging = $('#genericPaging');
  if (!container) return;

  if (state.model === 'users') {
    $('#userFilters').hidden = false;
    container.hidden = true;
    if (paging) paging.hidden = true;
    return;
  }

  $('#userFilters').hidden = true;

  if (state.model === 'world_map' || state.model === 'world_state') {
    container.hidden = true;
    if (paging) paging.hidden = true;
    return;
  }

  if (state.model === 'characters') {
    container.hidden = false;
    const cf = state.filters.characters;
    container.innerHTML = `
      <label>Search name
        <input id="filterSearch" type="search" placeholder="Character name..." value="${esc(cf.search || '')}">
      </label>
      <label>Level
        <input id="filterLevel" type="number" min="1" placeholder="Any" value="${esc(cf.level || '')}">
      </label>
      <label>Type
        <select id="filterCharType">
          <option value="">All types</option>
          ${[['PLAYER', 'Player'], ['NPC', 'NPC'], ['MONSTER', 'Monster']].map(([v, t]) => `<option value="${v}" ${cf.type === v ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label>Status
        <select id="filterCharStatus">
          <option value="">All statuses</option>
          <option value="active" ${cf.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="deleted" ${cf.status === 'deleted' ? 'selected' : ''}>Deleted</option>
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { cf.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterLevel').oninput = (e) => { cf.level = e.target.value; state.page = 1; renderTable(); };
    $('#filterCharType').onchange = (e) => { cf.type = e.target.value; state.page = 1; renderTable(); };
    $('#filterCharStatus').onchange = (e) => { cf.status = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.characters = { search: '', level: '', type: '', status: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
    return;
  }

  container.hidden = false;
  const f = state.filters[state.model] || {};

  if (state.model === 'items') {
    const types = ['HELMET', 'ARMOR', 'SHOES', 'GLOVES', 'EARRING', 'RING', 'NECKLACE', 'BELT', 'MAIN_HAND', 'TWO_HAND', 'QUEST_ITEMS', 'MISCS', 'FOOD', 'FISH', 'POTION', 'SKILL_SCROLL'];
    const rarities = ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'];
    const weaponTypes = ['SWORD', 'BOW', 'STAFF', 'QUARTERSTAFF', 'AXE', 'SPEAR', 'GREATSWORD', 'SHORTSWORD', 'CLUB', 'KNIFE'];
    container.innerHTML = `
      <label>Search items
        <input id="filterSearch" type="search" placeholder="Name, ID, desc..." value="${esc(f.search || '')}">
      </label>
      <label>Type
        <select id="filterType">
          <option value="">All types</option>
          ${types.map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label>Rarity
        <select id="filterRarity">
          <option value="">All rarities</option>
          ${rarities.map((r) => `<option value="${r}" ${f.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </label>
      <label>Weapon
        <select id="filterWeapon">
          <option value="">All weapons</option>
          ${weaponTypes.map((w) => `<option value="${w}" ${f.weapon_type === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterType').onchange = (e) => { f.type = e.target.value; state.page = 1; renderTable(); };
    $('#filterRarity').onchange = (e) => { f.rarity = e.target.value; state.page = 1; renderTable(); };
    $('#filterWeapon').onchange = (e) => { f.weapon_type = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.items = { search: '', type: '', rarity: '', weapon_type: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'skills') {
    const types = ['ATTACK', 'MAGIC_ATTACK', 'DEFEND', 'SPELL'];
    const rarities = ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'];
    const damageTypes = ['PHYSICAL', 'MAGICAL', 'HYBRID'];
    container.innerHTML = `
      <label>Search skills
        <input id="filterSearch" type="search" placeholder="Name, ID..." value="${esc(f.search || '')}">
      </label>
      <label>Type
        <select id="filterType">
          <option value="">All types</option>
          ${types.map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label>Rarity
        <select id="filterRarity">
          <option value="">All rarities</option>
          ${rarities.map((r) => `<option value="${r}" ${f.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </label>
      <label>Damage
        <select id="filterDamage">
          <option value="">All damage</option>
          ${damageTypes.map((d) => `<option value="${d}" ${f.damage_type === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </label>
      <label>Weapon
        <select id="filterSkillWeapon">
          <option value="">All weapons</option>
          <option value="ANY" ${f.weapon_type === 'ANY' ? 'selected' : ''}>Any weapon</option>
          ${skillWeaponTypes.map((w) => `<option value="${w}" ${f.weapon_type === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterType').onchange = (e) => { f.type = e.target.value; state.page = 1; renderTable(); };
    $('#filterRarity').onchange = (e) => { f.rarity = e.target.value; state.page = 1; renderTable(); };
    $('#filterDamage').onchange = (e) => { f.damage_type = e.target.value; state.page = 1; renderTable(); };
    $('#filterSkillWeapon').onchange = (e) => { f.weapon_type = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.skills = { search: '', type: '', rarity: '', damage_type: '', target_rule: '', weapon_type: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'effects') {
    const effectTypes = ['NONE', 'BUFF', 'CURE', 'HEALING', 'RECOVERY', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON', 'HUNGRY', 'STARVING', 'STARVATION', 'THIRSTY', 'DEHYDRATED', 'SEVERE_DEHYDRATION'];
    container.innerHTML = `
      <label>Search effects
        <input id="filterSearch" type="search" placeholder="Name, ID, desc..." value="${esc(f.search || '')}">
      </label>
      <label>Effect Type
        <select id="filterEffectType">
          <option value="">All types</option>
          ${effectTypes.map((et) => `<option value="${et}" ${f.effect_type === et ? 'selected' : ''}>${et}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterEffectType').onchange = (e) => { f.effect_type = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.effects = { search: '', effect_type: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'locations') {
    const regions = state.data.regions || [];
    container.innerHTML = `
      <label>Search locations
        <input id="filterSearch" type="search" placeholder="Name, ID, desc..." value="${esc(f.search || '')}">
      </label>
      <label>Region
        <select id="filterRegion">
          <option value="">All regions</option>
          ${regions.map((r) => `<option value="${r.id}" ${String(f.region_id) === String(r.id) ? 'selected' : ''}>🌍 ${esc(r.name)}</option>`).join('')}
        </select>
      </label>
      <label>Zone Type
        <select id="filterZone">
          <option value="">All zones</option>
          <option value="safe" ${f.zone_type === 'safe' ? 'selected' : ''}>🛡️ Safe Zone only</option>
          <option value="combat" ${f.zone_type === 'combat' ? 'selected' : ''}>⚔️ Combat Zone only</option>
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterRegion').onchange = (e) => { f.region_id = e.target.value; state.page = 1; renderTable(); };
    $('#filterZone').onchange = (e) => { f.zone_type = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.locations = { search: '', region_id: '', zone_type: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'sublocations') {
    const locations = (state.data.locations || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const subTypes = ['DEFAULT', 'SECRET_HIDEOUT', 'HOUSE', 'CASTLE', 'MANSION', 'GUILD_OFFICE', 'ALLEY', 'SQUARE', 'INN', 'SHOP'];
    container.innerHTML = `
      <label>Search sublocations
        <input id="filterSearch" type="search" placeholder="Search by name, ID, or description..." value="${esc(f.search || '')}">
      </label>
      <label>Location
        <select id="filterLocation">
          <option value="">All locations</option>
          ${locations.map((loc) => `<option value="${loc.id}" ${String(f.location_id || '') === String(loc.id) ? 'selected' : ''}>${esc(loc.name)} (#${loc.id})</option>`).join('')}
        </select>
      </label>
      <label>Type
        <select id="filterType">
          <option value="">All types</option>
          ${subTypes.map((t) => `<option value="${t}" ${f.sublocation_type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterLocation').onchange = (e) => { f.location_id = e.target.value; state.page = 1; renderTable(); };
    $('#filterType').onchange = (e) => { f.sublocation_type = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.sublocations = { search: '', location_id: '', sublocation_type: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'ambiences') {
    const locations = (state.data.locations || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    container.innerHTML = `
      <label>Search ambiences
        <input id="filterSearch" type="search" placeholder="Search title, place, figures..." value="${esc(f.search || '')}">
      </label>
      <label>Location
        <select id="filterLocation">
          <option value="">All locations</option>
          ${locations.map((loc) => `<option value="${loc.id}" ${String(f.location_id || '') === String(loc.id) ? 'selected' : ''}>${esc(loc.name)} (#${loc.id})</option>`).join('')}
        </select>
      </label>
      <label>Time
        <select id="filterTimeSlot">
          <option value="">All times</option>
          ${ambienceTimeSlots.map((t) => `<option value="${t}" ${f.time_slot === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label>Crowd
        <select id="filterCrowd">
          <option value="">All crowds</option>
          ${ambienceCrowdLevels.map((c) => `<option value="${c}" ${f.crowd_level === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterLocation').onchange = (e) => { f.location_id = e.target.value; state.page = 1; renderTable(); };
    $('#filterTimeSlot').onchange = (e) => { f.time_slot = e.target.value; state.page = 1; renderTable(); };
    $('#filterCrowd').onchange = (e) => { f.crowd_level = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.ambiences = { search: '', location_id: '', time_slot: '', crowd_level: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'crafting_recipes') {
    container.innerHTML = `
      <label>Search recipes
        <input id="filterSearch" type="search" placeholder="Search by name, ID, output or ingredient..." value="${esc(f.search || '')}">
      </label>
      <label>Life skill
        <select id="filterLifeskill">
          <option value="">All life skills</option>
          ${(state.data.lifeskills || []).map((skill) => `<option value="${skill.id}" ${String(f.lifeskill_id) === String(skill.id) ? 'selected' : ''}>${esc(skill.name)}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterLifeskill').onchange = (e) => { f.lifeskill_id = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.crafting_recipes = { search: '', lifeskill_id: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'quests') {
    container.innerHTML = `
      <label>Search quests
        <input id="filterSearch" type="search" placeholder="Search by name, ID, giver or target..." value="${esc(f.search || '')}">
      </label>
      <label>Objective
        <select id="filterObjective">
          <option value="">All objectives</option>
          ${questObjectiveTypes.map((t) => `<option value="${t}" ${f.objective_type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label>Quest giver
        <select id="filterQuestNpc">
          <option value="">All NPCs</option>
          ${questNpcOptions(f.source_npc_id)}
        </select>
      </label>
      <label>Repeat
        <select id="filterRepeatable">
          <option value="">All quests</option>
          <option value="repeatable" ${f.repeatable === 'repeatable' ? 'selected' : ''}>Repeatable</option>
          <option value="once" ${f.repeatable === 'once' ? 'selected' : ''}>One-time</option>
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterObjective').onchange = (e) => { f.objective_type = e.target.value; state.page = 1; renderTable(); };
    $('#filterQuestNpc').onchange = (e) => { f.source_npc_id = e.target.value; state.page = 1; renderTable(); };
    $('#filterRepeatable').onchange = (e) => { f.repeatable = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.quests = { search: '', objective_type: '', source_npc_id: '', repeatable: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (['lifeskills', 'regions', 'loot_groups'].includes(state.model)) {
    container.innerHTML = `
      <label>Search ${models[state.model].label.toLowerCase()}
        <input id="filterSearch" type="search" placeholder="Search by name, ID, or description..." value="${esc(f.search || '')}">
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters[state.model] = { search: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'prefixes' || state.model === 'suffixes') {
    const rarities = ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'];
    const tiers = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'];
    const modelLabel = state.model === 'prefixes' ? 'prefixes' : 'suffixes';
    container.innerHTML = `
      <label>Search ${modelLabel}
        <input id="filterSearch" type="search" placeholder="Name, ID..." value="${esc(f.search || '')}">
      </label>
      <label>Rarity
        <select id="filterRarity">
          <option value="">All rarities</option>
          ${rarities.map((r) => `<option value="${r}" ${f.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </label>
      <label>Tier
        <select id="filterTier">
          <option value="">All tiers</option>
          ${tiers.map((t) => `<option value="${t}" ${f.tier === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterRarity').onchange = (e) => { f.rarity = e.target.value; state.page = 1; renderTable(); };
    $('#filterTier').onchange = (e) => { f.tier = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters[state.model] = { search: '', rarity: '', tier: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  } else if (state.model === 'character_scenes') {
    const npcTypeOptions = [
      ['', 'All types'],
      [SCENE_NPC_TYPES.NPC, 'NPC'],
      [SCENE_NPC_TYPES.PLAYER, 'Player'],
      [SCENE_NPC_TYPES.MONSTER, 'Monster'],
      [SCENE_NPC_TYPES.NONE, 'No NPC']
    ];
    container.innerHTML = `
      <label>Search scenes
        <input id="filterSearch" type="search" placeholder="Goal, notes, names, ID..." value="${esc(f.search || '')}">
      </label>
      <label>Character name
        <input id="filterSceneCharacter" type="search" placeholder="Player name or ID" value="${esc(f.character_name || '')}">
      </label>
      <label>Party ID
        <input id="filterSceneParty" type="number" min="1" placeholder="Any" value="${esc(f.party_id || '')}">
      </label>
      <label>NPC type
        <select id="filterSceneNpc">
          ${npcTypeOptions.map(([value, label]) => `<option value="${value}" ${(f.npc_type || '') === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <label>Stage
        <select id="filterSceneStage">
          <option value="">All stages</option>
          ${sceneStages.map((stage) => `<option value="${stage}" ${f.scene_stage === stage ? 'selected' : ''}>${stage}</option>`).join('')}
        </select>
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
      <span class="sceneSummarizeBar">
        <label>Memory type
          <select id="sceneMemoryType">
            ${sceneSummaryMemoryTypes.map((type) => `<option value="${type}" ${state.sceneMemoryType === type ? 'selected' : ''}>${type}</option>`).join('')}
          </select>
        </label>
        <span id="sceneSelectionCount" class="muted"></span>
        <button id="sceneSelectionClear" class="ghost" type="button">Clear selection</button>
        <button id="sceneSummarizeButton" class="primary" type="button">Summarize scene to memory</button>
      </span>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#filterSceneCharacter').oninput = (e) => { f.character_name = e.target.value; state.page = 1; renderTable(); };
    $('#filterSceneParty').oninput = (e) => { f.party_id = e.target.value; state.page = 1; renderTable(); };
    $('#filterSceneNpc').onchange = (e) => { f.npc_type = e.target.value; state.page = 1; renderTable(); };
    $('#filterSceneStage').onchange = (e) => { f.scene_stage = e.target.value; state.page = 1; renderTable(); };
    $('#sceneMemoryType').onchange = (e) => { state.sceneMemoryType = e.target.value; };
    $('#sceneSelectionClear').onclick = () => { state.sceneSelection.clear(); renderTable(); updateSceneSummarizeBar(); };
    $('#sceneSummarizeButton').onclick = summarizeSelectedScenes;
    $('#btnResetFilters').onclick = () => {
      state.filters.character_scenes = { search: '', character_name: '', party_id: '', npc_type: '', scene_stage: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
    pruneSceneSelection();
    updateSceneSummarizeBar();
  } else if (state.model === 'stories') {
    container.innerHTML = `
      <label>Search stories
        <input id="filterSearch" type="search" placeholder="Search narrative, character, ID..." value="${esc(f.search || '')}">
      </label>
      <button id="btnResetFilters" class="ghost" type="button" title="Reset filters">Clear</button>
    `;
    $('#filterSearch').oninput = (e) => { f.search = e.target.value; state.page = 1; renderTable(); };
    $('#btnResetFilters').onclick = () => {
      state.filters.stories = { search: '' };
      state.page = 1;
      renderModelFilters();
      renderTable();
    };
  }
}

function renderTabs() {
  $('#tabs').className = 'tabs';
  $('#tabs').innerHTML = Object.entries(models).map(([key, model]) =>
    `<button class="${key === state.model ? 'active' : ''}" data-model="${key}">${model.label}</button>`
  ).join('');

  $('#tabs').onclick = (event) => {
    const model = event.target.dataset.model;
    if (model) {
      show('');
      resetUserFilters();
      state.model = model;
      state.editing = null;
      state.page = 1;
      state.modelSort = { column: 'id', direction: 'asc' };
      renderTabs();
      renderModelFilters();
      load();
    }
  };
}

function summary(model, record) {
  if (model === 'users') {
    return [
      record.id,
      record.user_id,
      record.username,
      record.character ? `Character #${record.character.id}` : '—',
      record.is_admin ? '<span class="badge badge-player">Admin</span>' : '<span class="muted">User</span>',
      record.deleted ? '<span class="pill-tag pill-danger">Deleted</span>' : '<span class="pill-tag pill-safe">Active</span>',
      record.created_at ? new Date(record.created_at).toISOString().slice(0, 19).replace('T', ' ') : '—'
    ];
  }
  if (model === 'characters') {
    const isMonster = Boolean(record.npc?.npc_monsters && record.npc.npc_monsters.deleted !== true);
    const typeBadge = record.character_type === 'NPC' ? (isMonster ? '<span class="badge badge-monster">🐉 Monster</span>' : '<span class="badge badge-npc">🧙 NPC</span>') : '<span class="badge badge-player">👤 Player</span>';
    const locDisplay = record.location?.name ? `${esc(record.location.name)}${record.sublocation?.name ? ` › ${esc(record.sublocation.name)}` : ''} (#${record.location.id})` : (record.location_id ? `#${record.location_id}` : '—');
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      record.user?.username || record.user_id || '—',
      locDisplay,
      record.level || 1,
      record.character_type === 'PLAYER' ? (record.player?.verified ? '<span class="pill-tag pill-safe">Verified</span>' : '<span class="muted">No</span>') : '—',
      record.character_type === 'PLAYER' ? (record.player?.is_nsfw ? '<span class="pill-tag pill-danger">NSFW</span>' : '<span class="muted">Safe</span>') : '—',
      typeBadge,
      record.deleted ? '<span class="pill-tag pill-danger">Deleted</span>' : '<span class="pill-tag pill-safe">Active</span>'
    ];
  }
  if (model === 'items') {
    const rarity = (record.rarity || 'NORMAL').toLowerCase();
    const efCount = record.item_bonus?.itembonus_effects?.length || 0;
    const skCount = record.skills_in_items?.length || 0;
    const isStack = record.is_stackable;
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="pill-tag">${esc(record.type)}${record.weapon_type ? ` · ${esc(record.weapon_type)}` : ''}</span>`,
      `<span class="badge badge-rarity-${rarity}">${esc(record.rarity || 'NORMAL')}</span>`,
      `<span class="pill-gold">💰 ${Number(record.price ?? 0).toLocaleString()}</span>${isStack ? ` <span class="pill-tag">Max ×${record.max_stack || 99}</span>` : ' <span class="muted" style="font-size:11px;">(1x)</span>'}`,
      `${efCount ? `<span class="pill-tag" style="color:var(--gold);">✨ ${efCount} effect${efCount > 1 ? 's' : ''}</span>` : ''} ${skCount ? `<span class="pill-tag" style="color:#67e89e;">🔮 ${skCount} skill${skCount > 1 ? 's' : ''}</span>` : ''} ${record.item_bonus ? '<small class="muted">Stats applied</small>' : '<span class="muted">—</span>'}`
    ];
  }
  if (model === 'skills') {
    const rarity = (record.rarity || 'NORMAL').toLowerCase();
    const efCount = record.skill_effects?.length || 0;
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="pill-tag">${esc(record.type)} (${esc(record.skill_damage_type || 'PHYSICAL')})</span>`,
      `<span class="badge badge-rarity-${rarity}">${esc(record.rarity || 'NORMAL')}</span>`,
      `<span class="pill-tag">${esc(record.skill_target_rule || 'SELF_ONLY')}</span>`,
      (record.for_weapon_types || []).length ? (record.for_weapon_types || []).map((entry) => `<span class="pill-tag">${esc(entry.weapon_type)}</span>`).join(' ') : '<span class="muted">Any</span>',
      `<span class="pill-tag">⚡ ${record.energy_consume_cost ?? 1} AP</span>`,
      efCount ? `<span class="pill-tag" style="color:#67e89e;">✨ ${efCount} effect${efCount > 1 ? 's' : ''}</span>` : '<span class="muted">—</span>'
    ];
  }
  if (model === 'effects') {
    const efType = record.effect_type || 'BUFF';
    const isBuff = efType === 'BUFF';
    const isCure = efType === 'CURE';
    const isHeal = efType === 'HEALING';
    const isRec = efType === 'RECOVERY';
    const isSurvival = ['HUNGRY', 'STARVING', 'STARVATION', 'THIRSTY', 'DEHYDRATED', 'SEVERE_DEHYDRATION'].includes(efType);
    const efBadgeClass = isBuff ? 'badge-effect-buff' : isCure ? 'badge-effect-cure' : isHeal ? 'badge-effect-healing' : isRec ? 'badge-effect-recovery' : isSurvival ? 'badge-effect-survival' : 'badge-effect-debuff';
    const skCount = record.skill_effects?.length || 0;
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="badge ${efBadgeClass}">${esc(efType)}</span>`,
      `<span class="pill-tag">🔮 ${skCount} skill${skCount === 1 ? '' : 's'}</span>`,
      `<span title="${esc(record.description || '')}">${esc((record.description || '—').slice(0, 60))}${(record.description?.length || 0) > 60 ? '…' : ''}</span>`
    ];
  }
  if (model === 'lifeskills') {
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="pill-tag">👤 ${record.character_lifeskills?.length || 0} active</span>`,
      `<span title="${esc(record.description || '')}">${esc((record.description || '—').slice(0, 80))}${(record.description?.length || 0) > 80 ? '…' : ''}</span>`
    ];
  }
  if (model === 'regions') {
    return [
      record.id,
      `<strong>🌍 ${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="pill-tag">📍 ${record.locations?.length || 0} location${(record.locations?.length || 0) === 1 ? '' : 's'}</span>`,
      `<span title="${esc(record.description || '')}">${esc((record.description || '—').slice(0, 80))}${(record.description?.length || 0) > 80 ? '…' : ''}</span>`
    ];
  }
  if (model === 'locations') {
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="pill-tag">🌍 ${esc(record.region?.name || ('Region #' + record.region_id))}</span>`,
      record.is_safe_zone ? '<span class="pill-tag pill-safe">🛡️ Safe Zone</span>' : '<span class="pill-tag pill-danger">⚔️ Combat Zone</span>',
      `<span class="pill-tag">${esc(record.location_type || 'VILLAGE')}</span>`,
      `<span title="${esc(record.description || '')}">${esc((record.description || '—').slice(0, 50))}${(record.description?.length || 0) > 50 ? '…' : ''}</span>`
    ];
  }
  if (model === 'sublocations') {
    const locName = record.location?.name ? `${esc(record.location.name)} (#${record.location.id})` : (record.location_id ? `#${record.location_id}` : '—');
    const isShopOrInn = record.sublocation_type === 'INN' || record.sublocation_type === 'SHOP';
    const itemCount = record.sublocations_items?.length || 0;
    const typeBadge = `<span class="pill-tag">${esc(record.sublocation_type || 'DEFAULT')}</span>`;
    const itemBadge = isShopOrInn ? `<span class="pill-tag" style="color:var(--gold);">🛍️ ${itemCount} item${itemCount === 1 ? '' : 's'}</span>` : '<span class="muted">—</span>';
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      locName,
      typeBadge,
      itemBadge,
      `<span title="${esc(record.description || '')}">${esc((record.description || '—').slice(0, 60))}${(record.description?.length || 0) > 60 ? '…' : ''}</span>`
    ];
  }
  if (model === 'loot_groups') {
    const rarity = (record.loot_group_rarity || 'COMMON').toLowerCase();
    return [
      record.id,
      `<strong>🎁 ${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="badge ${rarity}">${esc(record.loot_group_rarity || 'COMMON')}</span>`,
      `<span class="pill-gold">💰 ${record.min_gold ?? 0} – ${record.max_gold ?? 0}</span>`,
      `<span class="pill-tag">📦 ${record.items?.length || 0} item${(record.items?.length || 0) === 1 ? '' : 's'}</span>`,
      `<span class="pill-tag">📍 ${record.locations_lootgroups?.length || 0} loc${(record.locations_lootgroups?.length || 0) === 1 ? '' : 's'}</span>`,
      `<span class="pill-tag">🐉 ${record.npcmonsters_lootgroups?.length || 0} enem${(record.npcmonsters_lootgroups?.length || 0) === 1 ? 'y' : 'ies'}</span>`,
      `<span title="${esc(record.description || '')}">${esc((record.description || '—').slice(0, 50))}${(record.description?.length || 0) > 50 ? '…' : ''}</span>`
    ];
  }
  if (model === 'crafting_recipes') {
    const ingredients = (record.ingredients || []).map((ing) => `${ing.quantity}× ${ing.item?.name || `Item #${ing.item_id}`}`).join(', ');
    const outputQty = Number(record.max_output_quantity || record.output_quantity) > Number(record.output_quantity || 1)
      ? `${record.output_quantity}–${record.max_output_quantity}`
      : `${record.output_quantity || 1}`;
    return [
      record.id,
      `<strong>📜 ${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="pill-tag">${esc(record.lifeskill?.name || '—')}</span>`,
      `${esc(outputQty)}× ${esc(record.output_item?.name || '—')}`,
      `<span title="${esc(ingredients)}">${esc(ingredients.slice(0, 60) || '—')}${ingredients.length > 60 ? '…' : ''}</span>`,
      `Lv ${record.required_level ?? 1}`,
      `⚡ ${record.stamina_cost ?? 0} · ⏱ ${record.duration_seconds ?? 0}s`,
      `${record.exp_reward ?? 0} XP`
    ];
  }
  if (model === 'quests') {
    const icon = { COLLECT: '🧺', ELIMINATE: '⚔️', CAPTURE: '🪤' }[record.objective_type] || '📜';
    const activeRuns = record._count?.character_quests || 0;
    return [
      record.id,
      `<strong>📜 ${esc(record.name || 'Unnamed')}</strong>`,
      esc(record.source_npc?.character?.name || `NPC #${record.source_npc_id}`),
      `<span class="pill-tag">${icon} ${esc(record.objective_type || '—')}</span>`,
      `${esc(record.required_quantity ?? 1)}× ${esc(questTargetName(record))}`,
      `<span class="pill-gold">💰 ${Number(record.gold_reward || 0).toLocaleString()}</span>${Number(record.exp_reward || 0) ? ` <span class="pill-tag">✨ ${Number(record.exp_reward).toLocaleString()} XP</span>` : ''}${Number(record.affinity_reward || 0) ? ` <span class="pill-tag">❤ ${record.affinity_reward > 0 ? '+' : ''}${record.affinity_reward}</span>` : ''}`,
      record.repeatable ? 'Repeatable' : 'One-time',
      `${activeRuns} active`
    ];
  }
  if (model === 'prefixes') {
    const rarity = (record.rarity || 'NORMAL').toLowerCase();
    const tier = record.tier || 'TIER_1';
    const tierClass = tier.toLowerCase().replace('_', '-');
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="badge badge-rarity-${rarity}">${esc(record.rarity || 'NORMAL')}</span>`,
      `<span class="badge badge-${tierClass}">${esc(tier.replace('_', ' '))}</span>`,
      `⚔️ +${record.physical_attack_bonus || 0} / 🔮 +${record.magical_attack_bonus || 0}`,
      `🛡️ +${record.armor_bonus || 0} / +${record.magical_armor_bonus || 0}`,
      `🎯 +${record.crit_chance || 0}% / +${record.crit_damage || 0}%`
    ];
  }
  if (model === 'suffixes') {
    const rarity = (record.rarity || 'NORMAL').toLowerCase();
    const tier = record.tier || 'TIER_1';
    const tierClass = tier.toLowerCase().replace('_', '-');
    return [
      record.id,
      `<strong>${esc(record.name || 'Unnamed')}</strong>`,
      `<span class="badge badge-rarity-${rarity}">${esc(record.rarity || 'NORMAL')}</span>`,
      `<span class="badge badge-${tierClass}">${esc(tier.replace('_', ' '))}</span>`,
      `⚔️ +${record.physical_attack_bonus || 0} / 🔮 +${record.magical_attack_bonus || 0}`,
      `🛡️ +${record.armor_bonus || 0} / +${record.magical_armor_bonus || 0}`,
      `🎯 +${record.crit_chance || 0}% / +${record.crit_damage || 0}%`
    ];
  }
  if (model === 'ambiences') {
    const place = record.sublocation ? `🏠 ${esc(record.sublocation.name)} <span class="muted">(${esc(record.location?.name || '')})</span>` : `📍 ${esc(record.location?.name || record.location_id)}`;
    const figures = record.figures || [];
    return [
      record.id,
      `<strong>${esc(record.title || 'Untitled')}</strong>${record.is_active ? '' : ' <span class="pill-tag pill-danger">Inactive</span>'}`,
      place,
      `<span class="pill-tag">${esc(record.time_slot || 'ANY')}</span> <span class="pill-tag">${esc(record.weather || 'ANY WEATHER')}</span>`,
      `<span class="badge">${esc(record.crowd_level || 'SOME')}</span>`,
      `<span title="${esc(figures.map((fig) => `${fig.label} (${fig.weight})`).join(', '))}">👥 ${figures.length} · ${record.min_figures}-${record.max_figures} shown</span>`,
      record.weight
    ];
  }
  if (model === 'stories') {
    const charName = record.character ? `👤 ${esc(record.character.name || 'Unnamed')} (#${record.character.id})` : (record.character_id ? `#${record.character_id}` : '—');
    const userVal = record.user_id ? `<span class="muted" style="font-size:11px;">${esc(record.user_id.slice(0, 8))}…</span>` : '—';
    const storySnippet = esc((record.story || '').slice(0, 65));
    const actionSnippet = esc((record.action_from_player || '').slice(0, 35));
    return [
      record.id,
      charName,
      userVal,
      `<span title="${esc(record.story || '')}">${storySnippet || '<span class="muted">(empty narrative)</span>'}${(record.story?.length || 0) > 65 ? '…' : ''}</span>`,
      `<span title="${esc(record.action_from_player || '')}">${actionSnippet || '—'}${(record.action_from_player?.length || 0) > 35 ? '…' : ''}</span>`,
      record.updated_at ? new Date(record.updated_at).toISOString().slice(0, 19).replace('T', ' ') : '—'
    ];
  }
  if (model === 'character_scenes') {
    const place = scenePlaceName(record);
    const select = sceneHasNpc(record)
      ? `<input type="checkbox" class="sceneSelect" data-scene-id="${record.id}" ${state.sceneSelection.has(record.id) ? 'checked' : ''} aria-label="Select scene ${record.id} to summarize">`
      : '';
    const stageClass = record.scene_stage === 'solved' ? 'pill-safe' : record.scene_stage === 'abandoned' ? 'pill-danger' : '';
    return [
      select,
      record.id,
      record.character ? `👤 ${esc(record.character.name || 'Unnamed')} (#${record.character_id})` : `#${record.character_id}`,
      record.party_id ?? '—',
      record.npc_character ? `🧙 ${esc(record.npc_character.name || 'Unnamed')} (#${record.npc_character_id})` : '<span class="muted">—</span>',
      `<span title="${esc(record.scene_goal || '')}">${esc(place.location)}</span>`,
      esc(place.sublocation),
      `<span class="pill-tag ${stageClass}">${esc(record.scene_stage || 'on_going')}</span>`,
      record.chaos_factor ?? 5,
      sceneDate(record.created_at),
      sceneDate(record.updated_at),
      record.is_secret ? '<span class="pill-tag pill-danger">Secret</span>' : '<span class="muted">No</span>',
      record.is_nsfw ? '<span class="pill-tag pill-danger">NSFW</span>' : '<span class="muted">No</span>'
    ];
  }
  return [record.id, esc(record.name), esc(record.region?.name || record.region_id), esc(record.description || '—')];
}

function renderSceneModal(record) {
  const isCreate = !state.editing;
  const characters = (state.data.characters || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const npcs = characters.filter((c) => c.character_type === 'NPC');
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '🎭 SCENE';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = isCreate ? 'Create Scene' : `Edit Scene #${record.id}`;
  $('#save').textContent = isCreate ? 'Create Scene' : 'Save Changes';
  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader"><span class="cardSectionTitle">🎭 Scene</span></div>
        <label class="full">Scene goal
          <textarea name="scene_goal" maxlength="500" required placeholder="What ends the scene">${esc(record.scene_goal || '')}</textarea>
        </label>
        <label class="full">Scene notes
          <textarea name="scene_notes" maxlength="3000" style="min-height:140px;" placeholder="Hooks, people involved, progress">${esc(record.scene_notes || '')}</textarea>
        </label>
        <div class="cardGrid2">
          <label>Stage
            <select name="scene_stage">${sceneStages.map((stage) => `<option value="${stage}" ${(record.scene_stage || 'on_going') === stage ? 'selected' : ''}>${stage}</option>`).join('')}</select>
          </label>
          <label>Chaos factor (1–9)
            <input name="chaos_factor" type="number" min="1" max="9" value="${esc(record.chaos_factor ?? 5)}">
          </label>
          <label><input name="is_secret" type="checkbox" ${record.is_secret ? 'checked' : ''}> Secret scene</label>
          <label><input name="is_nsfw" type="checkbox" ${record.is_nsfw ? 'checked' : ''}> NSFW scene</label>
        </div>
      </div>
      <div class="cardSection">
        <div class="cardSectionHeader"><span class="cardSectionTitle">🔗 Links</span></div>
        <div class="cardGrid2">
          <label>Owner character
            <select name="character_id" required>${renderCharacterOptions(record.character_id)}</select>
          </label>
          <label>Party ID
            <input name="party_id" type="number" min="1" placeholder="None" value="${esc(record.party_id ?? '')}">
          </label>
          <label>Canon NPC
            <select name="npc_character_id">
              <option value="">-- No NPC --</option>
              ${npcs.map((c) => `<option value="${c.id}" ${Number(c.id) === Number(record.npc_character_id) ? 'selected' : ''}>🧙 ${esc(c.name || 'Unnamed')} (#${c.id})</option>`).join('')}
            </select>
          </label>
          <label>Location
            <select name="location_id">${renderLocationOptions(record.location_id)}</select>
          </label>
          <label>Sublocation
            <select name="sublocation_id">${renderSublocationOptions(record.sublocation_id)}</select>
          </label>
        </div>
      </div>
      ${isCreate ? '' : `
        <div class="cardSection">
          <div class="cardSectionHeader"><span class="cardSectionTitle">⏱️ Timestamps</span></div>
          <div class="cardGrid2" style="font-size:12px;">
            <div><b>Created At:</b> <span class="muted">${record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}</span></div>
            <div><b>Last Updated:</b> <span class="muted">${record.updated_at ? new Date(record.updated_at).toLocaleString() : 'N/A'}</span></div>
          </div>
        </div>`}
    </div>`;
}

async function restoreUser(id) {
  if (!confirm('Are you sure you want to restore this user account?')) return;
  try {
    const result = await api(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted: false })
    });
    show(result.message);
    await load();
  } catch (error) {
    show(error.message, true);
  }
}

function renderTable() {
  if (state.model !== 'world_state') stopWorldStateRefresh();
  if (state.model === 'world_map') {
    renderWorldMapEditor();
    return;
  }
  if (state.model === 'world_state') {
    renderWorldState();
    return;
  }
  $('#worldMapEditor').hidden = true;
  $('#table').hidden = false;
  const labels = state.model === 'users' ?
    [['ID', 'id'], ['User ID', 'user_id'], ['Username', 'username'], ['Character', 'character'], ['Role', 'role'], ['Status', 'status'], ['Created', 'created_at']] :
    state.model === 'characters' ?
    [['ID', 'id'], ['Name', 'name'], ['Owner', 'user'], ['Location', 'location'], ['Level', 'level'], ['Verified', 'verified'], ['NSFW', 'is_nsfw'], ['Type', 'type'], ['Status', 'deleted']] :
    state.model === 'items' ?
    [['ID', 'id'], ['Name', 'name'], ['Type', 'type'], ['Rarity', 'rarity'], ['Price & Stack', 'price'], ['Bonus & Effects', 'bonus']] :
    state.model === 'skills' ?
    [['ID', 'id'], ['Name', 'name'], ['Type & Dmg', 'type'], ['Rarity', 'rarity'], ['Target Rule', 'skill_target_rule'], ['Weapons', 'skill_weapons'], ['Cost', 'energy_consume_cost'], ['Effects', 'effects']] :
    state.model === 'effects' ?
    [['ID', 'id'], ['Name', 'name'], ['Effect Type', 'effect_type'], ['Linked Skills', 'skills'], ['Description', 'description']] :
    state.model === 'lifeskills' ?
    [['ID', 'id'], ['Name', 'name'], ['Active Characters', 'characters'], ['Description', 'description']] :
    state.model === 'regions' ?
    [['ID', 'id'], ['Name', 'name'], ['Locations', 'locations'], ['World Lore', 'description']] :
    state.model === 'locations' ?
    [['ID', 'id'], ['Name', 'name'], ['Region', 'region'], ['Zone Type', 'zone_type'], ['Type', 'location_type'], ['Description', 'description']] :
    state.model === 'sublocations' ?
    [['ID', 'id'], ['Name', 'name'], ['Location', 'location'], ['Type', 'sublocation_type'], ['Items', 'items'], ['Description', 'description']] :
    state.model === 'loot_groups' ?
    [['ID', 'id'], ['Name', 'name'], ['Rarity', 'loot_group_rarity'], ['Gold Range', 'min_gold'], ['Drop Items', 'items'], ['Locations', 'locations'], ['Enemies', 'monsters'], ['Description', 'description']] :
    state.model === 'crafting_recipes' ?
    [['ID', 'id'], ['Name', 'name'], ['Life Skill', 'lifeskill'], ['Output', 'output'], ['Ingredients', 'ingredients'], ['Req. Level', 'required_level'], ['Energy / Time', 'stamina_cost'], ['EXP', 'exp_reward']] :
    state.model === 'quests' ?
    [['ID', 'id'], ['Name', 'name'], ['Quest Giver', 'source_npc'], ['Objective', 'objective_type'], ['Target', 'target'], ['Rewards', 'rewards'], ['Repeat', 'repeatable'], ['Active Runs', 'active_runs']] :
    state.model === 'prefixes' ?
    [['ID', 'id'], ['Name', 'name'], ['Rarity', 'rarity'], ['Tier', 'tier'], ['ATK Bonus', 'physical_attack_bonus'], ['DEF Bonus', 'armor_bonus'], ['Crit', 'crit_chance']] :
    state.model === 'suffixes' ?
    [['ID', 'id'], ['Name', 'name'], ['Rarity', 'rarity'], ['Tier', 'tier'], ['ATK Bonus', 'physical_attack_bonus'], ['DEF Bonus', 'armor_bonus'], ['Crit', 'crit_chance']] :
    state.model === 'ambiences' ?
    [['ID', 'id'], ['Title', 'title'], ['Place', 'location'], ['Time & Weather', 'time_slot'], ['Crowd', 'crowd_level'], ['Figures', 'figures'], ['Weight', 'weight']] :
    state.model === 'stories' ?
    [['ID', 'id'], ['Character', 'character_id'], ['User UUID', 'user_id'], ['Story Excerpt', 'story'], ['Latest Action', 'action_from_player'], ['Updated', 'updated_at']] :
    state.model === 'character_scenes' ?
    [['Pick', ''], ['ID', 'id'], ['Character', 'character_id'], ['Party', 'party_id'], ['NPC', 'npc_character_id'], ['Location', 'location_id'], ['Sublocation', 'sublocation_id'], ['Stage', 'scene_stage'], ['Chaos', 'chaos_factor'], ['Created', 'created_at'], ['Updated', 'updated_at'], ['Secret', 'is_secret'], ['NSFW', 'is_nsfw']] :
    [['ID', 'id'], ['Name', 'name'], ['Region', 'region'], ['Description', 'description']];

  const list = rows();
  const allFiltered = state.model === 'users' ? list : getFilteredRecords();
  const total = state.model === 'users' ? (state.data.userMeta?.total ?? list.length) : allFiltered.length;
  const grandTotal = (state.data[state.model] || []).length;

  $('#userFilters').hidden = state.model !== 'users';
  $('#genericCreate').hidden = state.model === 'characters';
  $('#characterActions').hidden = state.model !== 'characters';

  if (state.model === 'users') {
    const meta = state.data.userMeta || { page: 1, pages: 1, total: list.length };
    $('#userPage').textContent = `${meta.page} / ${Math.max(meta.pages, 1)}`;
    $('#userPrev').disabled = meta.page <= 1;
    $('#userNext').disabled = meta.page >= meta.pages;
    $('#genericPaging').hidden = true;
  } else {
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    $('#genericPage').textContent = `${state.page} / ${totalPages}`;
    $('#genericPrev').disabled = state.page <= 1;
    $('#genericNext').disabled = state.page >= totalPages;
    $('#genericPaging').hidden = total <= state.pageSize;
  }

  $('#title').textContent = models[state.model].label;
  if (state.model === 'users') {
    $('#count').textContent = `${total} record${total === 1 ? '' : 's'}${state.userFilter || state.userStatus !== 'all' ? ' matching filter' : ''}`;
  } else {
    $('#count').textContent = total === grandTotal ? `${total} record${total === 1 ? '' : 's'}` : `${total} of ${grandTotal} records matching filter`;
  }

  const header = labels.map(([label, key]) => {
    if (!key) return `<th>${label}</th>`;
    const active = state.model === 'users' ? state.userSort === key : state.modelSort.column === key;
    const dir = state.model === 'users' ? state.userSortDirection : state.modelSort.direction;
    const indicator = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th><button class="sortHeader" data-sort="${key}" aria-label="Sort by ${label}">${label}${indicator}</button></th>`;
  }).join('');

  $('#table').innerHTML = list.length ?
    `<div class="tableWrap"><table><thead><tr>${header}<th></th></tr></thead><tbody>${list.map((record) => {
      const isUserDeleted = state.model === 'users' && record.deleted;
      const isCharDeleted = state.model === 'characters' && record.deleted;
      let actionButtons = '';
      if (!isCharDeleted) {
        actionButtons += `<button class="ghost edit" data-id="${record.id}">Edit</button>`;
      }
      if (isUserDeleted) {
        actionButtons += `<button class="primary restore" data-id="${record.id}" style="font-size:11px; padding:4px 8px;">Restore</button>`;
      } else {
        actionButtons += `<button class="danger remove" data-id="${record.id}">Delete</button>`;
      }
      return `<tr>${summary(state.model, record).map((value) => `<td>${value}</td>`).join('')}<td class="actionsCell">${actionButtons}</td></tr>`;
    }).join('')}</tbody></table></div>` :
    '<div class="empty">No records found matching current criteria.</div>';

  $('#table').onclick = (event) => {
    const sceneCheckbox = event.target.closest('.sceneSelect');
    if (sceneCheckbox) {
      const sceneId = Number(sceneCheckbox.dataset.sceneId);
      if (sceneCheckbox.checked) {
        if (state.sceneSelection.size >= SCENE_SUMMARY_MAX) {
          sceneCheckbox.checked = false;
          show(`You can summarize up to ${SCENE_SUMMARY_MAX} scenes at a time.`, true);
          return;
        }
        state.sceneSelection.add(sceneId);
      } else {
        state.sceneSelection.delete(sceneId);
      }
      updateSceneSummarizeBar();
      return;
    }
    const sort = event.target.closest('[data-sort]')?.dataset.sort;
    if (sort) {
      if (state.model === 'users') {
        if (state.userSort === sort) state.userSortDirection = state.userSortDirection === 'asc' ? 'desc' : 'asc';
        else { state.userSort = sort; state.userSortDirection = 'asc'; }
        state.userPage = 1;
        load();
      } else {
        if (state.modelSort.column === sort) state.modelSort.direction = state.modelSort.direction === 'asc' ? 'desc' : 'asc';
        else { state.modelSort.column = sort; state.modelSort.direction = 'asc'; }
        state.page = 1;
        renderTable();
      }
      return;
    }
    const id = event.target.dataset.id;
    if (event.target.classList.contains('edit')) {
      state.appliedRelations.clear();
      openEditor(Number(id));
    }
    if (event.target.classList.contains('restore')) {
      restoreUser(Number(id));
    }
    if (event.target.classList.contains('remove')) remove(Number(id));
  };
}

function applyAdminWorldMapView() {
  const stage = $('#worldMapStage');
  const content = $('#worldMapTransform');
  if (!stage || !content) return;
  const stateView = worldMapViewState;
  const image = content.querySelector('img');
  if (image && !image.complete && image.dataset.mapLoadBound !== 'true') {
    image.dataset.mapLoadBound = 'true';
    image.addEventListener('load', applyAdminWorldMapView, { once: true });
  }
  if (image?.naturalWidth && image?.naturalHeight) {
    stage.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  }
  stateView.scale = Math.max(1, Math.min(4, stateView.scale));
  content.style.width = `${stateView.scale * 100}%`;
  stateView.x = Math.max(Math.min(0, stage.clientWidth - content.offsetWidth), Math.min(0, stateView.x));
  stateView.y = Math.max(Math.min(0, stage.clientHeight - content.offsetHeight), Math.min(0, stateView.y));
  if (stateView.scale === 1) {
    stateView.x = 0;
    stateView.y = 0;
  }
  stage.classList.toggle('is-zoomed', stateView.scale > 1);
  content.style.transform = `translate(${stateView.x}px, ${stateView.y}px)`;
  const pins = $('#worldMapPins');
  if (pins) {
    for (const pin of pins.children) {
      pin.style.left = `${stateView.x + content.offsetWidth * Number(pin.dataset.mapX) / 100}px`;
      pin.style.top = `${stateView.y + content.offsetHeight * Number(pin.dataset.mapY) / 100}px`;
    }
  }
  $('#worldMapZoomLevel').textContent = `${Math.round(stateView.scale * 100)}%`;
  $('#worldMapZoomOut').disabled = stateView.scale <= 1;
  $('#worldMapZoomIn').disabled = stateView.scale >= 4;
  $('#worldMapZoomReset').disabled = stateView.scale === 1 && stateView.x === 0 && stateView.y === 0;
}

function setAdminWorldMapZoom(nextScale, clientX, clientY) {
  const stage = $('#worldMapStage');
  if (!stage) return;
  const bounds = stage.getBoundingClientRect();
  const pointX = clientX - bounds.left - stage.clientLeft;
  const pointY = clientY - bounds.top - stage.clientTop;
  const view = worldMapViewState;
  const mapX = (pointX - view.x) / view.scale;
  const mapY = (pointY - view.y) / view.scale;
  view.scale = Math.max(1, Math.min(4, nextScale));
  view.x = pointX - mapX * view.scale;
  view.y = pointY - mapY * view.scale;
  applyAdminWorldMapView();
}

function setupAdminWorldMapView() {
  const stage = $('#worldMapStage');
  if (!stage) return;
  if (stage.dataset.resizeBound !== 'true') {
    stage.dataset.resizeBound = 'true';
    window.addEventListener('resize', applyAdminWorldMapView);
  }
  const zoomAtCenter = (factor) => {
    const bounds = stage.getBoundingClientRect();
    setAdminWorldMapZoom(worldMapViewState.scale * factor, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  };
  $('#worldMapZoomIn').onclick = () => zoomAtCenter(1.25);
  $('#worldMapZoomOut').onclick = () => zoomAtCenter(0.8);
  $('#worldMapZoomReset').onclick = () => {
    worldMapViewState.scale = 1;
    worldMapViewState.x = 0;
    worldMapViewState.y = 0;
    applyAdminWorldMapView();
  };
  stage.onwheel = (event) => {
    event.preventDefault();
    setAdminWorldMapZoom(worldMapViewState.scale * (event.deltaY < 0 ? 1.12 : 0.89), event.clientX, event.clientY);
  };
  stage.ondragstart = (event) => event.preventDefault();
  stage.onpointerdown = (event) => {
    if (event.button !== 0 || event.target.closest('[data-world-map-pin]')) return;
    worldMapViewState.drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: worldMapViewState.x, y: worldMapViewState.y };
    worldMapViewState.dragged = false;
    stage.classList.add('is-panning');
    stage.setPointerCapture(event.pointerId);
  };
  stage.onpointermove = (event) => {
    const drag = worldMapViewState.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.clientX;
    const deltaY = event.clientY - drag.clientY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) worldMapViewState.dragged = true;
    if (worldMapViewState.dragged) {
      worldMapViewState.x = drag.x + deltaX;
      worldMapViewState.y = drag.y + deltaY;
      applyAdminWorldMapView();
    }
  };
  const finishPan = (event) => {
    if (worldMapViewState.drag?.pointerId !== event.pointerId) return;
    worldMapViewState.drag = null;
    stage.classList.remove('is-panning');
  };
  stage.onpointerup = finishPan;
  stage.onpointercancel = finishPan;
  applyAdminWorldMapView();
}

const WORLD_STATE_REFRESH_MS = 15000;
const worldStateWeatherIcons = { CLEAR: '🌤', SUNNY: '☀', RAIN: '🌧', HEAVYRAIN: '⛈', STORM: '🌩', FOG: '🌫', SANDSTORM: '🌪', SNOW: '❄' };
const worldStateSlotIcons = { MORNING: '🌅', AFTERNOON: '☀', EVENING: '🌆', NIGHT: '🌙' };

function stopWorldStateRefresh() {
  clearInterval(state.worldStateTimer);
  clearInterval(state.worldStateClockTimer);
  state.worldStateTimer = null;
  state.worldStateClockTimer = null;
}

async function loadWorldState() {
  try {
    state.worldState = await api('/api/admin/world-state');
    state.worldState.loadedAt = Date.now();
    renderWorldState();
    if (!state.worldStateTimer) state.worldStateTimer = setInterval(() => { if (state.model === 'world_state' && !document.hidden) loadWorldState(); }, WORLD_STATE_REFRESH_MS);
    if (!state.worldStateClockTimer) state.worldStateClockTimer = setInterval(updateWorldStateClocks, 1000);
  } catch (error) {
    if (error.status === 401) location.href = '/login.html';
    else if (error.status === 403) location.href = '/game.html';
    else show(error.message, true);
  }
}

function worldStateRemaining(isoTime) {
  const data = state.worldState;
  if (!data || !isoTime) return '—';
  const serverNow = new Date(data.gameTime.serverTime).getTime() + (Date.now() - data.loadedAt);
  const seconds = Math.max(0, Math.ceil((new Date(isoTime).getTime() - serverNow) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateWorldStateClocks() {
  if (state.model !== 'world_state') return;
  document.querySelectorAll('[data-countdown]').forEach((element) => { element.textContent = worldStateRemaining(element.dataset.countdown); });
  const data = state.worldState;
  if (data && worldStateRemaining(data.gameTime.endsAt) === '0:00' && Date.now() - data.loadedAt > 3000) loadWorldState();
}

function renderWorldStateAmbience(place) {
  const amb = place.ambience;
  if (!place.templateCount) return '<span class="muted">No templates</span>';
  if (!amb) return '<span class="muted">Not rolled yet</span>';
  if (!amb.ambienceId) return `<span class="muted">No template matched ${esc(amb.timeSlot)} / ${esc(amb.weather || 'any weather')}</span>${amb.stale ? ' <span class="pill-tag pill-danger">Stale</span>' : ''}`;
  const figures = amb.figures.length ? amb.figures.map((figure) => `<li>${esc(figure)}</li>`).join('') : '<li class="muted">No figures</li>';
  return `
    <div><strong>${esc(amb.title)}</strong> <span class="badge">${esc(amb.crowdLevel)}</span>${amb.stale ? ' <span class="pill-tag pill-danger" title="Rolled for an earlier time slot; it will re-roll on the next read or slot change">Stale</span>' : ''}</div>
    <div class="muted" style="font-size:12px; margin:4px 0;" title="${esc(amb.description || '')}">${esc((amb.description || '').slice(0, 140))}${(amb.description?.length || 0) > 140 ? '…' : ''}</div>
    <ul style="margin:0; padding-left:18px; font-size:12px;">${figures}</ul>`;
}

function renderWorldStateRow(place, weather, isSublocation) {
  const weatherCell = isSublocation
    ? `<span class="muted">${place.isSheltered ? '🏠 Sheltered' : 'Exposed'} · follows ${esc(place.locationName)}</span>`
    : weather
      ? `<div>${worldStateWeatherIcons[weather.weather] || ''} <strong>${esc(weather.label)}</strong> <span class="muted">(${esc(weather.weather)})</span></div><div class="muted" style="font-size:12px;">ends in <span data-countdown="${esc(weather.endsAt)}">${worldStateRemaining(weather.endsAt)}</span></div>`
      : '<span class="muted">Not initialized</span>';
  const placeCell = isSublocation
    ? `<span style="padding-left:18px;">↳ 🏠 ${esc(place.name)}</span> <span class="muted">${esc(place.type || '')} · #${place.sublocationId}</span>`
    : `<strong>📍 ${esc(place.name)}</strong> <span class="muted">${esc(place.type || '')} · #${place.locationId}</span>`;
  const actions = [
    `<button class="ghost" type="button" data-world-action="ambience" data-location-id="${place.locationId}" data-sublocation-id="${place.sublocationId || ''}" ${place.templateCount ? '' : 'disabled'}>Re-roll ambience</button>`,
    isSublocation ? '' : `<button class="ghost" type="button" data-world-action="weather" data-location-id="${place.locationId}">Re-roll weather</button>`
  ].join('');
  return `<tr>
    <td>${placeCell}</td>
    <td>${weatherCell}</td>
    <td>${renderWorldStateAmbience(place)}</td>
    <td><span class="pill-tag">${place.templateCount}</span></td>
    <td class="actionsCell">${actions}</td>
  </tr>`;
}

function renderWorldState() {
  $('#worldMapEditor').hidden = true;
  $('#table').hidden = false;
  $('#userFilters').hidden = true;
  $('#modelFilters').hidden = true;
  $('#genericCreate').hidden = true;
  $('#genericPaging').hidden = true;
  $('#characterActions').hidden = true;
  $('#title').textContent = models.world_state.label;
  const data = state.worldState;
  if (!data) {
    $('#count').textContent = 'Loading live world state…';
    $('#table').innerHTML = '<div class="empty">Loading…</div>';
    return;
  }
  const time = data.gameTime;
  const placeCount = data.locations.reduce((count, location) => count + 1 + location.sublocations.length, 0);
  $('#count').innerHTML = `${worldStateSlotIcons[time.slot] || ''} <strong>${esc(time.label)}</strong> · next ${esc(time.nextLabel)} in <span data-countdown="${esc(time.endsAt)}">${worldStateRemaining(time.endsAt)}</span> · ${placeCount} places · auto-refresh every ${WORLD_STATE_REFRESH_MS / 1000}s <button id="worldStateRefresh" class="ghost" type="button" style="margin-left:8px; padding:2px 10px;">Refresh</button>`;
  const rows = data.locations.map((location) => [
    renderWorldStateRow(location, location.weather, false),
    ...location.sublocations.map((sublocation) => renderWorldStateRow(sublocation, location.weather, true))
  ].join('')).join('');
  $('#table').innerHTML = rows
    ? `<div class="tableWrap"><table><thead><tr><th>Place</th><th>Weather</th><th>Current ambience & figures</th><th>Templates</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<div class="empty">No locations found.</div>';
  $('#worldStateRefresh').onclick = () => loadWorldState();
  $('#table').onclick = async (event) => {
    const button = event.target.closest('[data-world-action]');
    if (!button) return;
    const action = button.dataset.worldAction;
    const label = action === 'weather' ? 'weather' : 'ambience';
    if (!confirm(`Re-roll the ${label} now? Players in this place will see the new ${label} on their next turn (no story notice is sent).`)) return;
    button.disabled = true;
    try {
      await api('/api/admin/world-state/reroll', {
        method: 'POST',
        body: JSON.stringify({ action, location_id: Number(button.dataset.locationId), sublocation_id: Number(button.dataset.sublocationId) || null })
      });
      show(`${label.charAt(0).toUpperCase()}${label.slice(1)} re-rolled.`);
      await loadWorldState();
    } catch (error) {
      show(error.message, true);
      button.disabled = false;
    }
  };
}

function renderWorldMapEditor() {
  const editor = $('#worldMapEditor');
  const table = $('#table');
  if (!editor || !table) return;
  editor.hidden = false;
  table.hidden = true;
  $('#userFilters').hidden = true;
  $('#modelFilters').hidden = true;
  $('#genericCreate').hidden = true;
  $('#genericPaging').hidden = true;
  $('#characterActions').hidden = true;
  $('#title').textContent = models.world_map.label;
  const locations = state.data.locations || [];
  const pinnedLocations = locations.filter((location) => location.map_x !== null && location.map_y !== null);
  const routes = state.data.locationRoutes || [];
  const selected = locations.find((location) => Number(location.id) === Number(state.worldMapSelectedLocationId));
  if (!selected && state.worldMapSelectedLocationId !== null) state.worldMapSelectedLocationId = null;
  $('#count').textContent = `${pinnedLocations.length} pinned location${pinnedLocations.length === 1 ? '' : 's'} · ${routes.length} connected route${routes.length === 1 ? '' : 's'}`;
  $('#worldMapPinLocation').innerHTML = `<option value="">Choose a location to pin</option>${locations.map((location) => `<option value="${location.id}">${esc(location.name)}${location.map_x !== null && location.map_y !== null ? ' · pinned' : ''}</option>`).join('')}`;
  $('#worldMapPinLocation').value = state.worldMapSelectedLocationId || '';
  $('#worldMapRemovePin').disabled = !selected || selected.map_x === null || selected.map_y === null;
  const routeOptions = `<option value="">Choose a pinned location</option>${pinnedLocations.map((location) => `<option value="${location.id}">${esc(location.name)}</option>`).join('')}`;
  $('#worldMapRouteFrom').innerHTML = routeOptions;
  $('#worldMapRouteTo').innerHTML = routeOptions;
  $('#worldMapRouteFrom').value = pinnedLocations.some((location) => location.id === Number($('#worldMapRouteFrom').value)) ? $('#worldMapRouteFrom').value : '';
  $('#worldMapRouteTo').value = pinnedLocations.some((location) => location.id === Number($('#worldMapRouteTo').value)) ? $('#worldMapRouteTo').value : '';
  const lineSvg = $('#worldMapRouteLines');
  lineSvg.innerHTML = routes.map((route) => {
    const from = pinnedLocations.find((location) => location.id === route.location_a_id);
    const to = pinnedLocations.find((location) => location.id === route.location_b_id);
    return from && to ? `<line x1="${from.map_x}" y1="${from.map_y}" x2="${to.map_x}" y2="${to.map_y}"></line>` : '';
  }).join('');
  const pins = $('#worldMapPins');
  pins.innerHTML = pinnedLocations.map((location) => `<button type="button" class="worldMapPin${location.id === state.worldMapSelectedLocationId ? ' is-selected' : ''}" data-world-map-pin="${location.id}" data-map-x="${location.map_x}" data-map-y="${location.map_y}" title="${esc(location.name)}" aria-label="Select ${esc(location.name)}"><span class="worldMapPinLabel">${esc(location.name)}</span></button>`).join('');
  $('#worldMapRouteList').innerHTML = routes.length ? routes.map((route) => `
    <form class="worldMapRoute" data-world-map-route="${route.id}">
      <div class="worldMapRouteTitle"><strong>${esc(route.location_a.name)} ↔ ${esc(route.location_b.name)}</strong><button class="danger worldMapRouteDelete" type="button" data-route-delete="${route.id}">Remove</button></div>
      <div class="worldMapCosts">
        <label>Energy<input name="energy_cost" type="number" min="0" step="1" value="${route.energy_cost}" required></label>
        <label>Food<input name="food_cost" type="number" min="0" step="1" value="${route.food_cost}" required></label>
        <label>Water<input name="water_cost" type="number" min="0" step="1" value="${route.water_cost}" required></label>
      </div>
      <button class="ghost" type="submit">Save route costs</button>
    </form>
  `).join('') : '<p class="muted worldMapNoRoutes">No connected routes yet.</p>';
  setupAdminWorldMapView();

  $('#worldMapPinLocation').onchange = (event) => {
    state.worldMapSelectedLocationId = event.target.value ? Number(event.target.value) : null;
    renderWorldMapEditor();
  };
  pins.onclick = async (event) => {
    const pin = event.target.closest('[data-world-map-pin]');
    if (!pin) return;
    state.worldMapSelectedLocationId = Number(pin.dataset.worldMapPin);
    renderWorldMapEditor();
  };
  $('#worldMapStage').onclick = async (event) => {
    if (worldMapViewState.dragged) {
      worldMapViewState.dragged = false;
      return;
    }
    if (event.target.closest('[data-world-map-pin]')) return;
    const locationId = Number($('#worldMapPinLocation').value);
    if (!locationId) {
      show('Choose a location before placing a pin.', true);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const content = $('#worldMapTransform');
    const localX = event.clientX - bounds.left - event.currentTarget.clientLeft - worldMapViewState.x;
    const localY = event.clientY - bounds.top - event.currentTarget.clientTop - worldMapViewState.y;
    const mapX = Math.max(0, Math.min(100, localX / content.offsetWidth * 100));
    const mapY = Math.max(0, Math.min(100, localY / content.offsetHeight * 100));
    try {
      await api(`/api/admin/locations/${locationId}`, { method: 'PATCH', body: JSON.stringify({ map_x: mapX, map_y: mapY }) });
      state.worldMapSelectedLocationId = locationId;
      show('Map pin saved.');
      await load();
    } catch (error) {
      show(error.message, true);
    }
  };
  $('#worldMapRemovePin').onclick = async () => {
    if (!selected) return;
    try {
      await api(`/api/admin/locations/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ map_x: null, map_y: null }) });
      show(`Removed ${selected.name} from the map.`);
      await load();
    } catch (error) {
      show(error.message, true);
    }
  };
  $('#worldMapConnect').onclick = async () => {
    const from = Number($('#worldMapRouteFrom').value);
    const to = Number($('#worldMapRouteTo').value);
    if (!from || !to || from === to) {
      show('Choose two different pinned locations.', true);
      return;
    }
    try {
      await api('/api/admin/location_routes', { method: 'POST', body: JSON.stringify({ location_a_id: from, location_b_id: to }) });
      show('Connected locations with default costs of 5 energy, food, and water.');
      await load();
    } catch (error) {
      show(error.message, true);
    }
  };
  $('#worldMapRouteList').onsubmit = async (event) => {
    const form = event.target.closest('[data-world-map-route]');
    if (!form) return;
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      await api(`/api/admin/location_routes/${form.dataset.worldMapRoute}`, { method: 'PATCH', body: JSON.stringify(body) });
      show('Route costs saved.');
      await load();
    } catch (error) {
      show(error.message, true);
    }
  };
  $('#worldMapRouteList').onclick = async (event) => {
    const button = event.target.closest('[data-route-delete]');
    if (!button) return;
    try {
      await api(`/api/admin/location_routes/${button.dataset.routeDelete}`, { method: 'DELETE' });
      show('Route removed.');
      await load();
    } catch (error) {
      show(error.message, true);
    }
  };
}

function readValue(key, record) {
  if (key === 'npc_is_attackable') return record?.npc?.is_attackable ?? true;
  if (key === 'npc_is_speakable') return record?.npc?.is_speakable ?? false;
  if (key === 'npc_is_recruitable') return record?.npc?.is_recruitable ?? false;
  if (key === 'is_monster') return Boolean(record?.npc?.npc_monsters && record.npc.npc_monsters.deleted !== true);
  if (key === 'experience_reward') return record?.npc?.npc_monsters?.deleted === true ? 0 : record?.npc?.npc_monsters?.experience_reward ?? 0;
  if (key === 'gold') return record?.player?.gold ?? (record?.id ? 0 : 1000);
  if (key === 'current_point_spend') return record?.player?.current_point_spend ?? (record?.id ? 0 : 45);
  if (key === 'verified') return Boolean(record?.player?.verified);
  if (key === 'is_nsfw') return Boolean(record?.player ? record.player.is_nsfw : record?.is_nsfw);
  if (key.startsWith('stats.')) {
    const field = key.slice(6);
    const stats = record?.character_stat;
    return stats && Object.prototype.hasOwnProperty.call(stats, field) ? stats[field] ?? '' : (record?.id ? '' : statDefaults[field]);
  }
  if (key === 'is_updated_by_user') return Boolean(record?.is_updated_by_user);
  if (key === 'sublocation_id') return record?.sublocation_id ?? '';
  if (key === 'respawn_location_id') return record?.respawn_location_id ?? '';
  if (key === 'weapon_type') return record?.weapon_type ?? 'SWORD';
  if (key === 'cure_effect_type') return record?.cure_effect_type ?? 'NONE';
  if (key === 'is_safe_zone') return Boolean(record?.is_safe_zone);
  if (key === 'location_type') return record?.location_type ?? 'VILLAGE';
  if (key === 'skill_target_rule') return record?.skill_target_rule ?? 'ON_SELECTED_ENEMY';
  if (key === 'skill_damage_type') return record?.skill_damage_type ?? 'PHYSICAL';
  if (key === 'attack_amplifier') return record?.attack_amplifier ?? 1.0;
  if (key === 'magical_attack_amplifier') return record?.magical_attack_amplifier ?? 1.0;
  if (key === 'armor_amplifier') return record?.armor_amplifier ?? 1.0;
  if (key === 'magical_armor_amplifier') return record?.magical_armor_amplifier ?? 1.0;
  if (key === 'energy_consume_cost') return record?.energy_consume_cost ?? 1;
  if (key === 'duration') return record?.duration ?? 0;
  if (key === 'effect.cure_effect_type') return record?.item_bonus?.cure_effect_type ?? 'NONE';
  if (key === 'effect.item_trigger_type') return record?.item_bonus?.item_trigger_type ?? 'NONE';
  if (key === 'effect.consume_bonus_mode') return record?.item_bonus?.consume_bonus_mode ?? 'NONE';
  if (key.startsWith('effect.')) return record?.item_bonus?.[key.slice(7)] ?? '';
  if (jsonFields.has(key)) {
    let value = record?.[key];
    if (key === 'spellpoints') value = record?.character_spellpoints;
    if (key === 'memories') value = record?.character_memories;
    if (key === 'lifeskills') value = record.character_lifeskills?.map((item) => ({ lifeskill_id: item.lifeskill_id, current_level: item.current_level, current_exp: item.current_exp }));
    if (key === 'skills') value = record.skills?.map((item) => item.skill_id) || [];
    if (key === 'effects') value = record.effects?.map((item) => ({ effect_id: item.effect_id, duration_turn: item.duration_turn })) || [];
    if (key === 'inventory') {
      const carried = (record?.character_items || [])
        .filter((item) => item.location === 'BACKPACK' || (item.location === 'EQUIPPED' && item.equip_slot))
        .sort((a, b) => Number(b.location === 'EQUIPPED') - Number(a.location === 'EQUIPPED'));
      value = record?.character_inventory || carried.length ? {
        max_slots: record?.character_inventory?.max_slots ?? 40,
        items: carried.map((item) => ({ id: item.id, item_id: item.item_id, quantity: item.quantity, current_level_upgraded: item.current_level_upgraded, prefix_id: item.prefix_id, suffix_id: item.suffix_id, equip_slot: item.location === 'EQUIPPED' ? item.equip_slot : null }))
      } : null;
    }
    if (key === 'equipment') {
      const equippedItems = (record.character_items || []).filter((item) => item.location === 'EQUIPPED' && item.equip_slot);
      value = Object.fromEntries(['helmet_id', 'armor_id', 'gloves_id', 'shoes_id', 'left_hand_id', 'right_hand_id', 'left_earring_id', 'right_earring_id', 'left_ring_id', 'right_ring_id', 'necklace_id', 'belt_id'].map((field) => {
        const slot = field.replace(/_id$/, '').toUpperCase();
        return [field, equippedItems.find((item) => item.equip_slot === slot)?.item_id || null];
      }));
    }
    return value ? JSON.stringify(value, null, 2) : '';
  }
  return record?.[key] ?? '';
}

async function remove(id) {
  if (!confirm('Are you sure you want to delete this record?')) return;
  try {
    const result = await api(`/api/admin/${state.model}/${id}`, { method: 'DELETE' });
    show(result.message);
    await load();
  } catch (error) {
    show(error.message, true);
  }
}

async function load() {
  if (state.model === 'world_state') {
    await loadWorldState();
    return;
  }
  stopWorldStateRefresh();
  try {
    const params = new URLSearchParams();
    if (state.model === 'users') {
      params.set('userSearch', state.userFilter);
      params.set('userStatus', state.userStatus);
      params.set('userSort', state.userSort);
      params.set('userDirection', state.userSortDirection);
      params.set('userPage', state.userPage);
      params.set('userPageSize', state.userPageSize);
    }
    state.data = await api(`/api/admin${params.toString() ? `?${params}` : ''}`);
    renderModelFilters();
    renderTable();
  } catch (error) {
    if (error.status === 401) location.href = '/login.html';
    else if (error.status === 403) location.href = '/game.html';
    else show(error.message, true);
  }
}

// Relation Data Cache
let relationData = {};

function initRelationData(record) {
  relationData = {};
  jsonFields.forEach((key) => {
    const raw = readValue(key, record);
    try {
      relationData[key] = raw ? JSON.parse(raw) : (key === 'inventory' ? { max_slots: 40, items: [] } : key === 'equipment' ? {} : []);
    } catch {
      relationData[key] = key === 'inventory' ? { max_slots: 40, items: [] } : key === 'equipment' ? {} : [];
    }
  });
  relationData.itemEffects = (record?.item_bonus?.itembonus_effects || []).map((item) => ({ effect_id: item.effect_id }));
  relationData.itemSkills = (record?.skills_in_items || []).map((rel) => rel.skill_id || rel.skill?.id).filter(Boolean);
  relationData.skillWeaponTypes = (record?.for_weapon_types || []).map((entry) => entry.weapon_type);
  relationData.skillEffects = (record?.skill_effects || []).map((item) => ({
    effect_id: item.effect_id,
    duration: item.duration ?? 1,
    healing_current_hp: item.healing_current_hp ?? 0,
    is_cure_all: Boolean(item.is_cure_all),
    is_stun_cure: Boolean(item.is_stun_cure),
    is_daze_cure: Boolean(item.is_daze_cure),
    is_weak_cure: Boolean(item.is_weak_cure),
    is_blind_cure: Boolean(item.is_blind_cure),
    is_poison_cure: Boolean(item.is_poison_cure)
  }));
  relationData.vault = {
    max_slots: record?.vault?.max_slots ?? 60,
    tier: record?.vault?.tier ?? 1,
    stored_gold: record?.vault?.stored_gold ?? 0,
    items: (record?.character_items || [])
      .filter((item) => item.location === 'VAULT')
      .map((item) => ({ item_id: item.item_id, quantity: item.quantity || 1, current_level_upgraded: item.current_level_upgraded, prefix_id: item.prefix_id, suffix_id: item.suffix_id }))
  };
  relationData.lootItems = (record?.items || []).map((item) => ({ item_id: item.item_id, chance_pct: item.chance_pct, min_quantity: item.min_quantity, max_quantity: item.max_quantity }));
  relationData.lootMonsters = (record?.npcmonsters_lootgroups || []).map((item) => item.npc_monster_id);
  relationData.lootLocations = (record?.locations_lootgroups || []).map((item) => item.location_id);
  relationData.lootLocationChances = Object.fromEntries((record?.locations_lootgroups || []).map((item) => [item.location_id, item.chance_pct ?? 100]));
  relationData.sublocationItems = (record?.sublocations_items || []).map((item) => ({ item_id: item.item_id }));
  relationData.recipeIngredients = (record?.ingredients || []).map((item) => ({ item_id: item.item_id, quantity: item.quantity ?? 1 }));
  relationData.playerNpcRelationships = record?.character_type === 'PLAYER'
    ? (record?.player?.player_npc_relationships || []).map((item) => ({
      npc_character_id: item.npc_character_id,
      affinity: item.affinity ?? 0,
      status: relationshipStatusFromAffinity(item.affinity),
      is_player_name_revealed: Boolean(item.is_player_name_revealed),
      interaction_notes: item.interaction_notes || ''
    }))
    : (record?.npc?.player_npc_relationships || []).map((item) => ({
      player_character_id: item.player_character_id,
      affinity: item.affinity ?? 0,
      status: relationshipStatusFromAffinity(item.affinity),
      is_player_name_revealed: Boolean(item.is_player_name_revealed),
      interaction_notes: item.interaction_notes || ''
    }));
  relationData.npcRelationships = (record?.npc?.npc_relationships_as_source || []).map((item) => ({
    target_npc_id: item.target_npc_id,
    relationship_type: item.relationship_type || 'ACQUAINTANCE',
    context_note: item.context_note || '',
    is_nsfw: Boolean(item.is_nsfw)
  }));
  relationData.npcKnownLocations = (record?.npc?.npc_known_locations || []).map((item) => ({
    location_id: item.location_id,
    sublocation_id: item.sublocation_id,
    location_knowledge_type: item.location_knowledge_type || 'LOCAL_LANDMARK',
    location_semantic_memory: item.location_semantic_memory || ''
  }));
  relationData.npcAppearances = (record?.npc?.npcs_in_locations_or_sublocations || []).map((item) => ({
    location_id: item.location_id,
    sublocation_id: item.sublocation_id
  }));
}

// Helper Select Dropdowns
function renderUserOptions(selectedUserId) {
  const users = state.data.userOptions || state.data.users || [];
  let html = '<option value="">-- No owner / Unassigned --</option>';
  let found = false;
  users.forEach((u) => {
    const selected = String(u.user_id) === String(selectedUserId);
    if (selected) found = true;
    html += `<option value="${esc(u.user_id)}" ${selected ? 'selected' : ''}>👤 ${esc(u.username)} (${esc(u.user_id.slice(0, 8))}…)</option>`;
  });
  if (selectedUserId && !found) {
    html += `<option value="${esc(selectedUserId)}" selected>👤 Unknown User (${esc(selectedUserId)})</option>`;
  }
  return html;
}

function renderRegionOptions(selectedRegionId) {
  const regions = state.data.regions || [];
  let html = '<option value="">-- Select Region --</option>';
  regions.forEach((r) => {
    const sel = Number(r.id) === Number(selectedRegionId);
    html += `<option value="${r.id}" ${sel ? 'selected' : ''}>🌍 ${esc(r.name)} (#${r.id})</option>`;
  });
  return html;
}

function renderLocationOptions(selectedLocationId) {
  const regions = state.data.regions || [];
  const locations = state.data.locations || [];
  let html = '<option value="">-- Select Location --</option>';
  
  if (!regions.length) {
    locations.forEach((loc) => {
      const selected = Number(loc.id) === Number(selectedLocationId);
      html += `<option value="${loc.id}" ${selected ? 'selected' : ''}>📍 ${esc(loc.name)} (#${loc.id})</option>`;
    });
    return html;
  }

  regions.forEach((region) => {
    const regionLocs = locations.filter((l) => l.region_id === region.id);
    if (regionLocs.length) {
      html += `<optgroup label="🌍 ${esc(region.name)}">`;
      regionLocs.forEach((loc) => {
        const selected = Number(loc.id) === Number(selectedLocationId);
        html += `<option value="${loc.id}" ${selected ? 'selected' : ''}>📍 ${esc(loc.name)} (#${loc.id})</option>`;
      });
      html += '</optgroup>';
    }
  });

  const orphanLocs = locations.filter((l) => !regions.some((r) => r.id === l.region_id));
  if (orphanLocs.length) {
    html += '<optgroup label="Other Locations">';
    orphanLocs.forEach((loc) => {
      const selected = Number(loc.id) === Number(selectedLocationId);
      html += `<option value="${loc.id}" ${selected ? 'selected' : ''}>📍 ${esc(loc.name)} (#${loc.id})</option>`;
    });
    html += '</optgroup>';
  }

  return html;
}

function renderItemOptions(selectedItemId, allowedTypes = null) {
  const items = state.data.items || [];
  let html = '<option value="">-- None / Empty --</option>';
  
  let primary = items;
  let secondary = [];
  if (allowedTypes && allowedTypes.length) {
    primary = items.filter((i) => allowedTypes.includes(i.type));
    secondary = items.filter((i) => !allowedTypes.includes(i.type));
  }

  if (secondary.length) {
    html += '<optgroup label="Matching Slot Items">';
    primary.forEach((i) => {
      const sel = Number(i.id) === Number(selectedItemId);
      html += `<option value="${i.id}" ${sel ? 'selected' : ''}>[${i.rarity}] ${esc(i.name || `Item #${i.id}`)} (${i.type})</option>`;
    });
    html += '</optgroup><optgroup label="All Other Items">';
    secondary.forEach((i) => {
      const sel = Number(i.id) === Number(selectedItemId);
      html += `<option value="${i.id}" ${sel ? 'selected' : ''}>[${i.rarity}] ${esc(i.name || `Item #${i.id}`)} (${i.type})</option>`;
    });
    html += '</optgroup>';
  } else {
    items.forEach((i) => {
      const sel = Number(i.id) === Number(selectedItemId);
      html += `<option value="${i.id}" ${sel ? 'selected' : ''}>[${i.rarity}] ${esc(i.name || `Item #${i.id}`)} (${i.type})</option>`;
    });
  }

  return html;
}

function lootItemMatches(item, search, type, rarity) {
  const query = String(search || '').trim().toLowerCase();
  return (!query || `${item.name || ''} ${item.id} ${item.type} ${item.rarity}`.toLowerCase().includes(query))
    && (!type || item.type === type)
    && (!rarity || item.rarity === rarity);
}

function renderLootItemOptions(selectedItemId, filters = {}) {
  const items = state.data.items || [];
  const visible = items.filter((item) => lootItemMatches(item, filters.search, filters.type, filters.rarity));
  const selected = items.find((item) => Number(item.id) === Number(selectedItemId));
  let html = '<option value="">-- Select item --</option>';
  if (selected && !visible.some((item) => item.id === selected.id)) html += `<option value="${selected.id}" selected>Current: [${selected.rarity}] ${esc(selected.name || `Item #${selected.id}`)} (${selected.type})</option>`;
  html += visible.map((item) => {
    const isSelected = Number(item.id) === Number(selectedItemId);
    return `<option value="${item.id}" ${isSelected ? 'selected' : ''}>[${item.rarity}] ${esc(item.name || `Item #${item.id}`)} (#${item.id}, ${item.type})</option>`;
  }).join('');
  return html;
}

function lootItemFilters() {
  return { search: $('#lootItemSearch')?.value || '', type: $('#lootItemType')?.value || '', rarity: $('#lootItemRarity')?.value || '' };
}

function refreshLootItemOptions() {
  const filters = lootItemFilters();
  document.querySelectorAll('#lootItemRows .lootItemSelect').forEach((select) => {
    const selectedId = select.value;
    select.innerHTML = renderLootItemOptions(selectedId, filters);
    select.value = selectedId;
  });
  const count = (state.data.items || []).filter((item) => lootItemMatches(item, filters.search, filters.type, filters.rarity)).length;
  if ($('#lootItemResultCount')) $('#lootItemResultCount').textContent = `${count} matching item${count === 1 ? '' : 's'}`;
}

function refreshLootMonsterCards() {
  const query = String($('#lootMonsterSearch')?.value || '').trim().toLowerCase();
  let count = 0;
  document.querySelectorAll('#lootMonsterCards .lootMonsterCard').forEach((card) => {
    const matches = !query || card.dataset.search.includes(query);
    card.hidden = !matches;
    if (matches) count += 1;
  });
  if ($('#lootMonsterResultCount')) $('#lootMonsterResultCount').textContent = `${count} matching monster${count === 1 ? '' : 's'}`;
}

function renderLifeskillOptions(selectedId) {
  const lifeskills = state.data.lifeskills || [];
  let html = '<option value="">-- Select Lifeskill --</option>';
  lifeskills.forEach((ls) => {
    const sel = Number(ls.id) === Number(selectedId);
    html += `<option value="${ls.id}" ${sel ? 'selected' : ''}>🛠️ ${esc(ls.name || `Lifeskill #${ls.id}`)}</option>`;
  });
  return html;
}

function renderEffectOptions(selectedId) {
  const effects = state.data.effects || [];
  let html = '<option value="">-- Select Effect --</option>';
  effects.forEach((ef) => {
    const sel = Number(ef.id) === Number(selectedId);
    html += `<option value="${ef.id}" ${sel ? 'selected' : ''}>✨ [${ef.effect_type}] ${esc(ef.name || `Effect #${ef.id}`)}</option>`;
  });
  return html;
}

function renderSublocationOptions(selectedSublocationId, locationId = null) {
  const sublocations = state.data.sublocations || [];
  let list = sublocations;
  if (locationId) {
    list = sublocations.filter((s) => Number(s.location_id) === Number(locationId));
  }
  let html = '<option value="">-- No SubLocation / None --</option>';
  list.forEach((s) => {
    const sel = Number(s.id) === Number(selectedSublocationId);
    html += `<option value="${s.id}" ${sel ? 'selected' : ''}>🏠 ${esc(s.name)} [${esc(s.sublocation_type || 'DEFAULT')}] (#${s.id})</option>`;
  });
  return html;
}

function renderPrefixOptions(selectedPrefixId) {
  const prefixes = state.data.prefixes || [];
  let html = '<option value="">-- No Prefix --</option>';
  prefixes.forEach((p) => {
    const sel = Number(p.id) === Number(selectedPrefixId);
    html += `<option value="${p.id}" ${sel ? 'selected' : ''}>[${esc(p.tier || 'TIER_1')}] ${esc(p.name)} (${esc(p.rarity)})</option>`;
  });
  return html;
}

function renderSuffixOptions(selectedSuffixId) {
  const suffixes = state.data.suffixes || [];
  let html = '<option value="">-- No Suffix --</option>';
  suffixes.forEach((s) => {
    const sel = Number(s.id) === Number(selectedSuffixId);
    html += `<option value="${s.id}" ${sel ? 'selected' : ''}>[${esc(s.tier || 'TIER_1')}] ${esc(s.name)} (${esc(s.rarity)})</option>`;
  });
  return html;
}

function renderSkillOptions(selectedSkillId) {
  const skills = state.data.skills || [];
  let html = '<option value="">-- Select Skill --</option>';
  skills.forEach((sk) => {
    const sel = Number(sk.id) === Number(selectedSkillId);
    html += `<option value="${sk.id}" ${sel ? 'selected' : ''}>🔮 [${esc(sk.rarity)}] ${esc(sk.name)} (${esc(sk.type)})</option>`;
  });
  return html;
}

function renderCharacterOptions(selectedCharacterId) {
  const characters = state.data.characters || [];
  let html = '<option value="">-- Select Character --</option>';
  characters.forEach((c) => {
    const sel = Number(c.id) === Number(selectedCharacterId);
    html += `<option value="${c.id}" ${sel ? 'selected' : ''}>${c.character_type === 'PLAYER' ? '👤' : '🧙'} ${esc(c.name || 'Unnamed')} (#${c.id}) [Lvl ${c.level || 1}]</option>`;
  });
  return html;
}

function activeNpcCharacters(excludeId = null) {
  return (state.data.characters || []).filter((character) => (
    character.character_type === 'NPC'
    && !character.deleted
    && (!character.npc?.npc_monsters || character.npc.npc_monsters.deleted === true)
    && Number(character.id) !== Number(excludeId)
  ));
}

function activePlayerCharacters() {
  return (state.data.characters || []).filter((character) => character.character_type === 'PLAYER' && !character.deleted);
}

function renderNpcRelationOptions(selectedId, excludeId = null) {
  let html = '<option value="">-- Select NPC --</option>';
  activeNpcCharacters(excludeId).forEach((character) => {
    const selected = Number(character.id) === Number(selectedId);
    html += `<option value="${character.id}" ${selected ? 'selected' : ''}>🧙 ${esc(character.name || 'Unnamed NPC')} (#${character.id})</option>`;
  });
  return html;
}

function renderPlayerRelationOptions(selectedId) {
  let html = '<option value="">-- Select Player --</option>';
  activePlayerCharacters().forEach((character) => {
    const selected = Number(character.id) === Number(selectedId);
    html += `<option value="${character.id}" ${selected ? 'selected' : ''}>👤 ${esc(character.name || 'Unnamed Player')} (#${character.id})</option>`;
  });
  return html;
}

function renderRelationshipStatusOptions(selected) {
  return ['HOSTILE', 'DISGUSTED', 'HATEFUL', 'WARY', 'DISLIKE', 'STRANGER', 'NEUTRAL', 'FRIENDLY', 'CONFIDANT', 'DEVOTED']
    .map((value) => `<option value="${value}" ${value === (selected || 'STRANGER') ? 'selected' : ''}>${value}</option>`)
    .join('');
}

function relationshipStatusFromAffinity(value) {
  const affinity = Math.max(-200, Math.min(200, Math.trunc(Number(value) || 0)));
  if (affinity <= -200) return 'HOSTILE';
  if (affinity <= -101) return 'DISGUSTED';
  if (affinity <= -51) return 'HATEFUL';
  if (affinity <= -21) return 'WARY';
  if (affinity < 0) return 'DISLIKE';
  if (affinity <= 20) return 'STRANGER';
  if (affinity <= 50) return 'NEUTRAL';
  if (affinity <= 100) return 'FRIENDLY';
  if (affinity <= 150) return 'CONFIDANT';
  return 'DEVOTED';
}

function renderMemoryTypeOptions(selected) {
  return ['SHORT_TERM', 'LONG_TERM', 'SEMANTIC', 'EPISODIC', 'SECRET']
    .map((value) => `<option value="${value}" ${value === (selected || 'SEMANTIC') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`)
    .join('');
}

function renderNpcRelationshipTypeOptions(selected) {
  return ['FRIEND', 'RIVAL', 'ENEMY', 'FAMILY', 'MASTER_DISCIPLE', 'MASTER_SERVANT', 'STRANGER', 'ACQUAINTANCE', 'SUPERIOR_SUBORDINATE', 'BUSINESS_PARTNER', 'CLOSE_FRIEND', 'VASSAL', 'NTR', 'SLAVE']
    .map((value) => `<option value="${value}" ${value === (selected || 'ACQUAINTANCE') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`)
    .join('');
}

function renderNpcKnowledgeTypeOptions(selected) {
  return ['LOCAL_LANDMARK', 'SECRET_PASSAGE', 'DANGER_ZONE', 'FREQUENT_HAUNT']
    .map((value) => `<option value="${value}" ${value === (selected || 'LOCAL_LANDMARK') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`)
    .join('');
}

// Character Modal Sub-Tabs Renderer
function renderCharacterModal(record, createType) {
  const isCreate = !state.editing;
  const charType = record.character_type || createType || 'PLAYER';
  const isPlayer = charType === 'PLAYER';
  const isMonster = Boolean(readValue('is_monster', record));

  // Reset modal fields class
  $('#fields').className = 'modalBody';

  // Modal Header Badge
  const badgeClass = isPlayer ? 'badge-player' : (isMonster ? 'badge-monster' : 'badge-npc');
  const badgeText = isPlayer ? '👤 PLAYER' : (isMonster ? '🐉 MONSTER' : '🧙 NPC');
  $('#formBadge').className = `badge ${badgeClass}`;
  $('#formBadge').textContent = badgeText;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} ${isPlayer ? 'Player Character' : (isMonster ? 'Monster' : 'NPC')}${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Character' : 'Save Changes';

  // Modal Tabs
  $('#modalTabs').hidden = false;
  $('#modalTabs').innerHTML = `
    <button type="button" class="modalNavBtn active" data-tab="identity">📋 Identity & Bio</button>
    <button type="button" class="modalNavBtn" data-tab="stats">⚔️ Attributes & Stats</button>
    <button type="button" class="modalNavBtn" data-tab="equipment_inventory" ${isMonster ? 'hidden' : ''}>🎒 Equipment & Bag</button>
    <button type="button" class="modalNavBtn" data-tab="skills_spells">🔮 Skills & Magic</button>
    <button type="button" class="modalNavBtn" data-tab="lore_status">📜 Lifeskills & Lore</button>
    ${charType === 'NPC' ? `<button type="button" class="modalNavBtn" data-tab="relationships" ${isMonster ? 'hidden' : ''}>🤝 Relationships & Knowledge</button>` : ''}
  `;

  // Hidden Character Type Input
  const hiddenTypeInput = `<input type="hidden" name="character_type" value="${charType}">`;

  // 1. Identity Tab HTML
  const identityHtml = `
    <div class="tabPanel" id="tab-identity">
      ${hiddenTypeInput}
      
      <!-- Basic Details Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">Identity & Background</span>
        </div>
        <div class="cardGrid3">
          <label>Character Name
            <input name="name" type="text" placeholder="e.g. Eldrin Stormcaller" value="${esc(readValue('name', record))}">
          </label>
          <label>Race
            <input name="race" type="text" placeholder="e.g. Human, Elf, Undead" value="${esc(readValue('race', record))}">
          </label>
          <label>Class / Job
            <input name="job" type="text" placeholder="e.g. Mage, Warrior, Assassin" value="${esc(readValue('job', record))}">
          </label>
        </div>
        <div class="cardGrid4">
          <label>Sex
            <select name="sex">
              ${['MALE', 'FEMALE', 'OTHER'].map((s) => `<option value="${s}" ${(String(readValue('sex', record) || 'MALE').toUpperCase() === s) ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </label>
          <label>Alignment
            <select name="alignment">
              ${['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned'].map((a) => `<option ${readValue('alignment', record) === a ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
          </label>
          <label>Age
            <input name="age" type="number" min="0" value="${esc(readValue('age', record))}">
          </label>
          <label>Level
            <input name="level" type="number" min="1" value="${esc(readValue('level', record) || 1)}">
          </label>
        </div>
        <div class="cardGrid3">
          <label>Current EXP
            <input name="current_exp" type="number" min="0" value="${esc(readValue('current_exp', record) || 0)}">
          </label>
          <label>Current Location
            <select name="location_id" id="charLocationSelect">${renderLocationOptions(readValue('location_id', record))}</select>
          </label>
          <label>Current SubLocation
            <select name="sublocation_id" id="charSublocationSelect">${renderSublocationOptions(readValue('sublocation_id', record), readValue('location_id', record))}</select>
          </label>
        </div>
        <div class="cardGrid2">
          <label>Respawn Location (Bind Point)
            <select name="respawn_location_id">${renderLocationOptions(readValue('respawn_location_id', record))}</select>
          </label>
          <div style="display:flex; align-items:center;">
            ${isPlayer ? `
              <label class="switchLabel" style="margin-top:16px;">
                <input type="checkbox" name="is_updated_by_user" ${readValue('is_updated_by_user', record) ? 'checked' : ''}>
                <span><b>Customized by User</b><small>Character was modified in player portal</small></span>
              </label>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Archetype & Ownership Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">${isPlayer ? 'Player Account & Economy' : 'NPC / Monster Behavior'}</span>
        </div>
        ${isPlayer ? `
          <div class="cardGrid2">
            <label>Owner User Account
              <select name="user_id">${renderUserOptions(readValue('user_id', record))}</select>
            </label>
            <div class="cardGrid2">
              <label>Gold (Coins)
                <input name="gold" type="number" min="0" value="${esc(readValue('gold', record))}">
              </label>
              <label>Stat Point Spend
                <input name="current_point_spend" type="number" min="0" value="${esc(readValue('current_point_spend', record))}">
              </label>
            </div>
          </div>
          <div class="cardGrid2">
            <label class="switchLabel">
              <input type="checkbox" name="verified" ${readValue('verified', record) ? 'checked' : ''}>
              <span><b>Verified Character</b><small>Allow character full system interactions</small></span>
            </label>
            <label class="switchLabel">
              <input type="checkbox" name="is_nsfw" ${readValue('is_nsfw', record) ? 'checked' : ''}>
              <span><b>NSFW Permitted</b><small>Enable mature story themes for this character</small></span>
            </label>
          </div>
        ` : `
          <div class="cardGrid3">
            <label class="switchLabel">
              <input type="checkbox" name="npc_is_attackable" ${readValue('npc_is_attackable', record) ? 'checked' : ''}>
              <span><b>Attackable</b><small>Targetable in combat</small></span>
            </label>
            <label class="switchLabel">
              <input type="checkbox" name="npc_is_speakable" ${readValue('npc_is_speakable', record) ? 'checked' : ''}>
              <span><b>Speakable</b><small>Can initiate dialogues</small></span>
            </label>
            <label class="switchLabel">
              <input type="checkbox" name="npc_is_recruitable" ${readValue('npc_is_recruitable', record) ? 'checked' : ''} ${isMonster ? 'disabled' : ''}>
              <span><b>Recruitable</b><small>Can join a player's party</small></span>
            </label>
            <label class="switchLabel">
              <input type="checkbox" name="is_monster" id="toggleMonsterCheck" ${isMonster ? 'checked' : ''}>
              <span><b>Monster / Creature</b><small>Hostile encounter flag</small></span>
            </label>
          </div>
          <div id="monsterFieldsWrap" ${!isMonster ? 'style="display:none;"' : ''}>
            <label>Monster Experience Reward
              <input name="experience_reward" type="number" min="0" value="${esc(readValue('experience_reward', record))}">
            </label>
          </div>
        `}
      </div>

      <!-- Lore & Appearance Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">Visual Appearance & Backstory</span>
        </div>
        <div class="cardGrid2">
          <label>Avatar Image
            <input name="avatar_file" id="characterAvatarFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp">
            <input name="image_data" id="characterImageData" type="hidden" value="${esc(readValue('image_data', record))}">
            <img id="characterAvatarPreview" src="${esc(readValue('image_data', record) || '')}" alt="Avatar preview" ${readValue('image_data', record) ? '' : 'hidden'} style="max-width:96px; max-height:96px; object-fit:cover;">
          </label>
          <label class="full">Visual Appearance
            <textarea name="appearance" placeholder="Physical features, height, hair, clothing, signature traits...">${esc(readValue('appearance', record))}</textarea>
          </label>
          <label class="full">Description & Backstory
            <textarea name="description" placeholder="Origin story, personal goals, personality, historical notes...">${esc(readValue('description', record))}</textarea>
          </label>
        </div>
      </div>
    </div>
  `;

  // 2. Attributes & Stats Tab HTML
  const statsHtml = `
    <div class="tabPanel" id="tab-stats" hidden>
      <div class="statsLayout">
        <!-- Core Stats -->
        <div class="statCard">
          <div class="statCardTitle">🛡️ Core Attributes</div>
          <div class="statCardGrid">
            ${[
              ['proficiency', 'Proficiency (Base)', 'profBadge'],
              ['strength', 'Strength (STR)'],
              ['dexterity', 'Dexterity (DEX)'],
              ['intelligent', 'Intelligence (INT)'],
              ['constitution', 'Constitution (CON)'],
              ['wisdom', 'Wisdom (WIS)'],
              ['charisma', 'Charisma (CHA)']
            ].map(([f, label, badge]) => `
              <div class="statInputGroup">
                <label>${label} ${badge ? '<span class="pill-tag pill-gold" style="font-size:9px;">CORE</span>' : ''}</label>
                <input name="stats.${f}" type="number" value="${esc(readValue(`stats.${f}`, record))}">
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Vital Resources -->
        <div class="statCard">
          <div class="statCardTitle">❤️ Vital Resources & Pools</div>
          <div class="statCardGrid">
            ${[
              ['max_hp', 'Max HP', 'current_hp', 'Current HP'],
              ['max_energy', 'Max Energy (AP)', 'current_energy', 'Current Energy'],
              ['max_food', 'Max Food', 'current_food', 'Current Food'],
              ['max_water', 'Max Water', 'current_water', 'Current Water']
            ].map(([mf, mLabel, cf, cLabel]) => `
              <div class="statInputGroup">
                <label>${mLabel}</label>
                <input name="stats.${mf}" type="number" value="${esc(readValue(`stats.${mf}`, record))}">
              </div>
              <div class="statInputGroup">
                <label>${cLabel}</label>
                <input name="stats.${cf}" type="number" value="${esc(readValue(`stats.${cf}`, record))}">
              </div>
            `).join('')}
          </div>
          <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--line);">
            <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Base Defenses</div>
            <div class="statCardGrid" style="margin-top:4px;">
              <div class="statInputGroup">
                <label>Physical Armor</label>
                <input name="stats.armor" type="number" value="${esc(readValue('stats.armor', record))}">
              </div>
              <div class="statInputGroup">
                <label>Magic Armor</label>
                <input name="stats.magic_armor" type="number" value="${esc(readValue('stats.magic_armor', record))}">
              </div>
            </div>
          </div>
        </div>

        <!-- Resistances (Full Width) -->
        <div class="statCard" style="grid-column: 1 / -1;">
          <div class="statCardTitle">🧪 Elemental & Status Resistances</div>
          <div class="statCardGrid4">
            ${[
              ['fire_element_resistant', 'Fire Resistance', 'res-fire', '🔥'],
              ['ice_element_resistant', 'Ice Resistance', 'res-ice', '❄️'],
              ['earth_element_resistant', 'Earth Resistance', 'res-earth', '🌿'],
              ['lightning_element_resistant', 'Lightning Resistance', 'res-lightning', '⚡'],
              ['wind_element_resistant', 'Wind Resistance', 'res-wind', '💨'],
              ['holy_element_resistant', 'Holy Resistance', 'res-holy', '✨'],
              ['dark_element_resistant', 'Dark Resistance', 'res-dark', '🌑'],
              ['status_resistant', 'Status Resistance', 'res-status', '🛡️'],
              ['accuracy', 'Base Accuracy (%)', 'res-status', '🎯'],
              ['base_crit_chance', 'Base Crit Chance (%)', 'res-status', '💥'],
              ['base_crit_damage', 'Base Crit Damage (%)', 'res-status', '💥']
            ].map(([f, label, resClass, icon]) => `
              <div class="statInputGroup">
                <label><span class="resBadge ${resClass}">${icon} ${label}</span></label>
                <input name="stats.${f}" type="number" value="${esc(readValue(`stats.${f}`, record))}">
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // 3. Equipment & Inventory Tab HTML
  const inv = relationData.inventory || { max_slots: 40, items: [] };
  const vault = relationData.vault || { max_slots: 60, tier: 1, stored_gold: 0, items: [] };
  

  const equipHtml = `
    <div class="tabPanel" id="tab-equipment_inventory" hidden>
      <!-- Equipment Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🛡️ Equipped Items</span>
          <small class="muted">Equip or unequip from the bag below with the Slot column.</small>
        </div>
        <div class="equipSections">
          ${ADMIN_EQUIP_SLOT_GROUPS.map((grp) => `
            <div style="display:grid; gap:10px;">
              <div style="font-size:12px; font-weight:700; color:var(--gold); border-bottom:1px solid var(--line); padding-bottom:4px;">${grp.zone}</div>
              ${grp.slots.map(([slot, label]) => `
                <div class="equipSlotCard">
                  <div class="equipSlotHeader">
                    <span>${label}</span>
                  </div>
                  <div class="equipOverviewValue" data-slot="${slot}">— empty —</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Inventory Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🎒 Bag & Inventory Storage</span>
          <button type="button" class="ghost" id="btnAddInvRow">＋ Add Item</button>
        </div>
        <div class="invHeaderBar">
          <label style="display:flex; align-items:center; gap:8px; margin:0;">
            <b>Bag Capacity (Max Slots):</b>
            <input type="number" id="invMaxSlots" name="inv_max_slots" min="1" style="width:90px;" value="${inv.max_slots || 40}">
          </label>
          <span id="invCountBadge" class="badge badge-count">${(inv.items || []).length} items</span>
        </div>
        <div class="invList" id="invListRows">
          ${(inv.items || []).map((item) => renderInvRow(item)).join('')}
        </div>
      </div>

      <!-- Player Vault Section -->
      ${isPlayer ? `
        <div class="cardSection" style="margin-top:16px;">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">🏦 Character Vault (Safe Storage)</span>
            <button type="button" class="ghost" id="btnAddVaultRow">＋ Add Vault Item</button>
          </div>
          <div class="invHeaderBar">
            <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
              <label style="display:flex; align-items:center; gap:8px; margin:0;">
                <b>Vault Capacity:</b>
                <input type="number" id="vaultMaxSlots" min="1" style="width:80px;" value="${vault.max_slots || 60}">
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:0;">
                <b>Tier:</b>
                <input type="number" id="vaultTier" min="1" style="width:70px;" value="${vault.tier || 1}">
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:0;">
                <b>Stored Gold:</b>
                <input type="number" id="vaultGold" min="0" style="width:110px;" value="${vault.stored_gold || 0}">
              </label>
            </div>
            <span id="vaultCountBadge" class="badge badge-count">${(vault.items || []).length} items stored</span>
          </div>
          <div class="invList" id="vaultListRows">
            ${(vault.items || []).map((vItem) => `
              <div class="vaultRow">
                <select class="vaultItemSelect">${renderItemOptions(vItem.item_id)}</select>
                <input type="number" class="vaultQty" placeholder="Qty" min="1" value="${vItem.quantity || 1}">
                <button type="button" class="btn-remove-row" title="Remove Item" onclick="this.closest('.vaultRow').remove(); updateVaultBadge();">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // 4. Skills & Magic Tab HTML
  const allSkills = state.data.skills || [];
  const selectedSkills = new Set(relationData.skills || []);
  const spList = relationData.spellpoints || [];

  const skillsHtml = `
    <div class="tabPanel" id="tab-skills_spells" hidden>
      <!-- Skills Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">⚔️ Character Skills</span>
          <span class="badge badge-count" id="skillSelectedCount">${selectedSkills.size} skills selected</span>
        </div>
        <div class="skillsToolbar">
          <input type="search" id="skillSearchInput" placeholder="Search skills by name...">
          <select id="skillTypeFilter" class="skillFilterSelect">
            <option value="">All Types</option>
            <option value="ATTACK">Attack</option>
            <option value="MAGIC_ATTACK">Magic Attack</option>
            <option value="DEFEND">Defend</option>
            <option value="SPELL">Spell</option>
          </select>
          <select id="skillRarityFilter" class="skillFilterSelect">
            <option value="">All Rarities</option>
            ${['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'].map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="relationGrid" id="skillGridCards">
          ${allSkills.map((sk) => {
            const isSel = selectedSkills.has(sk.id);
            const rClass = (sk.rarity || 'NORMAL').toLowerCase();
            return `
              <div class="relationCard ${isSel ? 'selected' : ''}" data-id="${sk.id}" data-name="${esc((sk.name || '').toLowerCase())}" data-type="${esc(sk.type || '')}" data-rarity="${esc(sk.rarity || '')}">
                <input type="checkbox" class="skillCheckInput" value="${sk.id}" ${isSel ? 'checked' : ''}>
                <div class="relationCardBody">
                  <div class="relationCardTitle">${esc(sk.name || 'Unnamed')}</div>
                  <div class="relationCardBadges">
                    <span class="badge badge-rarity-${rClass}">${esc(sk.rarity)}</span>
                    <span class="pill-tag">${esc(sk.type)}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Spellpoints Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🔮 Spell Slot Tiers (Spellpoints)</span>
          <button type="button" class="ghost" id="btnAddSpRow">＋ Add Spell Tier</button>
        </div>
        <div class="spGrid" id="spGridRows">
          ${spList.map((sp) => `
            <div class="spRow">
              <label>Tier / Level<input type="number" class="spLevel" min="1" max="9" placeholder="Level" value="${sp.level ?? 1}"></label>
              <label>Max Spell Slots<input type="number" class="spMax" min="0" placeholder="Max" value="${sp.max_current ?? 4}"></label>
              <label>Current Available Slots<input type="number" class="spCur" min="0" placeholder="Current" value="${sp.current ?? 4}"></label>
              <button type="button" class="btn-remove-row" title="Remove Tier" onclick="this.closest('.spRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // 5. Relationships & Knowledge Tab HTML
  const playerNpcRelations = relationData.playerNpcRelationships || [];
  const npcRelations = relationData.npcRelationships || [];
  const npcKnownLocations = relationData.npcKnownLocations || [];
  const npcAppearances = relationData.npcAppearances || [];
  const relationshipHtml = charType === 'PLAYER' || charType === 'NPC' ? `
    <div class="tabPanel" id="tab-relationships" hidden>
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🤝 ${isPlayer ? 'NPC Relationships' : 'Player Relationships'}</span>
          <button type="button" class="ghost" id="btnAddPlayerNpcRelation">＋ Add Relationship</button>
        </div>
        <div id="playerNpcRelationRows">
          ${playerNpcRelations.map((relation) => `
            <div class="multiItemRow playerNpcRelationRow">
              <select class="relationTargetSelect">${isPlayer ? renderNpcRelationOptions(relation.npc_character_id) : renderPlayerRelationOptions(relation.player_character_id)}</select>
              <input class="relationAffinity" type="number" min="-200" max="200" placeholder="Affinity" value="${relation.affinity ?? 0}">
              <select class="relationStatus" disabled>${renderRelationshipStatusOptions(relation.status)}</select>
              <label><input class="relationNameRevealed" type="checkbox" ${relation.is_player_name_revealed ? 'checked' : ''}> Name revealed</label>
              <textarea class="relationNotes" rows="2" maxlength="500" placeholder="Interaction notes">${esc(relation.interaction_notes || '')}</textarea>
              <button type="button" class="btn-remove-row" title="Remove relationship" onclick="this.closest('.playerNpcRelationRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
        <div class="muted" style="font-size:11px; margin-top:8px;">${isPlayer ? 'Only non-monster NPCs can be selected.' : 'Manage player affinity toward this NPC.'}</div>
      </div>
      ${!isPlayer ? `
        <div class="cardSection">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">🧭 NPC-to-NPC Relationships</span>
            <button type="button" class="ghost" id="btnAddNpcRelation">＋ Add Relationship</button>
          </div>
          <div id="npcRelationRows">
            ${npcRelations.map((relation) => `
              <div class="multiItemRow npcRelationRow">
                <select class="npcRelationTarget">${renderNpcRelationOptions(relation.target_npc_id, record.id)}</select>
                <select class="npcRelationType">${renderNpcRelationshipTypeOptions(relation.relationship_type)}</select>
                <textarea class="npcRelationNote" rows="2" maxlength="500" placeholder="Context note">${esc(relation.context_note || '')}</textarea>
                <label><input class="npcRelationNsfw" type="checkbox" ${relation.is_nsfw ? 'checked' : ''}> NSFW</label>
                <button type="button" class="btn-remove-row" title="Remove relationship" onclick="this.closest('.npcRelationRow').remove();">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="muted" style="font-size:11px; margin-top:8px;">Monster characters are excluded from NPC relationships.</div>
        </div>
        <div class="cardSection">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">🗺️ Known Locations</span>
            <button type="button" class="ghost" id="btnAddNpcKnownLocation">＋ Add Location</button>
          </div>
          <div id="npcKnownLocationRows">
            ${npcKnownLocations.map((entry) => `
              <div class="multiItemRow npcKnownLocationRow">
                <select class="knownLocationSelect">${renderLocationOptions(entry.location_id)}</select>
                <select class="knownSublocationSelect">${renderSublocationOptions(entry.sublocation_id, entry.location_id)}</select>
                <select class="knownLocationType">${renderNpcKnowledgeTypeOptions(entry.location_knowledge_type)}</select>
                <input class="knownLocationNote" type="text" maxlength="500" placeholder="Knowledge or facts" value="${esc(entry.location_semantic_memory || '')}">
                <button type="button" class="btn-remove-row" title="Remove known location" onclick="this.closest('.npcKnownLocationRow').remove();">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="muted" style="font-size:11px; margin-top:8px;">Choose a location and optional sublocation, then describe what the NPC knows.</div>
        </div>
        <div class="cardSection">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">📍 NPC Presence</span>
            <button type="button" class="ghost" id="btnAddNpcAppearance">＋ Add Appearance</button>
          </div>
          <div id="npcAppearanceRows">
            ${npcAppearances.map((entry) => `
              <div class="multiItemRow npcAppearanceRow">
                <select class="appearanceLocationSelect">${renderLocationOptions(entry.location_id)}</select>
                <select class="appearanceSublocationSelect">${renderSublocationOptions(entry.sublocation_id, entry.location_id)}</select>
                <button type="button" class="btn-remove-row" title="Remove appearance" onclick="this.closest('.npcAppearanceRow').remove();">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="muted" style="font-size:11px; margin-top:8px;">Set either a location or a sublocation where this non-monster NPC can appear.</div>
        </div>
      ` : ''}
    </div>
  ` : '';

  // 6. Lore & Status Tab HTML
  const lsList = relationData.lifeskills || [];
  const efList = relationData.effects || [];
  const memList = relationData.memories || [];

  const loreHtml = `
    <div class="tabPanel" id="tab-lore_status" hidden>
      ${record?.story ? `
        <!-- Story Narrative Preview Section -->
        <div class="cardSection">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">📖 Active Story Narrative</span>
          </div>
          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--line); border-radius:6px; padding:12px; font-size:13px; line-height:1.5;">
            <div style="color:var(--muted); font-size:11px; margin-bottom:6px;">LATEST NARRATIVE (Full CRUD available under Stories tab)</div>
            <div style="max-height:120px; overflow-y:auto; white-space:pre-wrap;">${esc(record.story.story || '(No story narrative recorded)')}</div>
            ${record.story.action_from_player ? `<div style="margin-top:8px; font-style:italic; color:var(--gold);"><b>Last player action:</b> ${esc(record.story.action_from_player)}</div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Lifeskills Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🛠️ Character Lifeskills (Crafting & Gathering)</span>
          <button type="button" class="ghost" id="btnAddLifeskillRow">＋ Add Lifeskill</button>
        </div>
        <div id="lifeskillRowsWrap">
          ${lsList.map((ls) => `
            <div class="multiItemRow">
              <select class="lsSelect">${renderLifeskillOptions(ls.lifeskill_id)}</select>
              <input type="number" class="lsLevel" placeholder="Level" min="1" value="${ls.current_level || 1}">
              <input type="number" class="lsExp" placeholder="EXP" min="0" value="${ls.current_exp || 0}">
              <button type="button" class="btn-remove-row" title="Remove" onclick="this.closest('.multiItemRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Active Effects Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">✨ Active Buffs & Debuffs</span>
          <button type="button" class="ghost" id="btnAddEffectRow">＋ Add Effect</button>
        </div>
        <div id="effectRowsWrap">
          ${efList.map((ef) => `
            <div class="effectItemRow">
              <select class="efSelect">${renderEffectOptions(ef.effect_id)}</select>
              <input type="number" class="efDuration" placeholder="Duration (Turns)" min="0" value="${ef.duration_turn ?? 0}">
              <button type="button" class="btn-remove-row" title="Remove" onclick="this.closest('.effectItemRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Memories Section -->
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📜 Key Memories & Lore Triggers</span>
          <button type="button" class="ghost" id="btnAddMemoryRow">＋ Add Memory</button>
        </div>
        <div id="memoryRowsWrap">
          ${memList.map((m) => `
            <div class="memoryItemCard">
              <textarea class="memText" placeholder="Enter character memory or lore note...">${esc(m.content || m.memory)}</textarea>
              <select class="memType">${renderMemoryTypeOptions(m.memory_type)}</select>
              <select class="memTarget">${renderCharacterOptions(m.target_character_id)}</select>
              <label><input class="memSecret" type="checkbox" ${m.is_secret ? 'checked' : ''}> Secret</label>
              <label><input class="memNsfw" type="checkbox" ${m.is_nsfw ? 'checked' : ''}> NSFW</label>
              <button type="button" class="btn-remove-row" title="Remove Memory" onclick="this.closest('.memoryItemCard').remove();">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Render everything into #fields
  $('#fields').innerHTML = identityHtml + statsHtml + equipHtml + skillsHtml + relationshipHtml + loreHtml;

  // Bind Dynamic Events inside Character Modal
  setupCharacterModalEvents();
}

const ADMIN_EQUIP_SLOT_GROUPS = [
  { zone: 'Armour', slots: [['HELMET', 'Helmet / Headgear'], ['ARMOR', 'Chest Armor'], ['GLOVES', 'Gloves / Gauntlets'], ['SHOES', 'Boots / Shoes']] },
  { zone: 'Weapons', slots: [['LEFT_HAND', 'Left Hand (Main)'], ['RIGHT_HAND', 'Right Hand (Off)']] },
  { zone: 'Accessories', slots: [['LEFT_RING', 'Left Ring'], ['RIGHT_RING', 'Right Ring'], ['LEFT_EARRING', 'Left Earring'], ['RIGHT_EARRING', 'Right Earring'], ['NECKLACE', 'Necklace / Amulet'], ['BELT', 'Belt / Waist']] }
];
const ADMIN_EQUIP_SLOTS = ADMIN_EQUIP_SLOT_GROUPS.flatMap((grp) => grp.slots);

function renderEquipSlotOptions(selectedSlot) {
  return `<option value="">🎒 In bag</option>${ADMIN_EQUIP_SLOTS.map(([slot, label]) => `<option value="${slot}" ${slot === selectedSlot ? 'selected' : ''}>🛡️ ${label}</option>`).join('')}`;
}

function renderInvRow(item = {}) {
  return `
    <div class="invRow${item.equip_slot ? ' isEquipped' : ''}" data-row-id="${item.id || ''}">
      <select class="invItemSelect" title="Item">${renderItemOptions(item.item_id || '')}</select>
      <input type="number" class="invQty" placeholder="Qty" min="1" title="Quantity" value="${item.quantity || 1}">
      <input type="number" class="invLevel" placeholder="+Lv" min="0" max="10" title="Upgrade Level (+0..+10)" value="${item.current_level_upgraded || 0}">
      <select class="invPrefix" title="Prefix Affix">${renderPrefixOptions(item.prefix_id || '')}</select>
      <select class="invSuffix" title="Suffix Affix">${renderSuffixOptions(item.suffix_id || '')}</select>
      <select class="invSlot" title="Equip Slot">${renderEquipSlotOptions(item.equip_slot || '')}</select>
      <button type="button" class="btn-remove-row" title="Remove Item" onclick="this.closest('.invRow').remove(); updateInvBadge();">✕</button>
    </div>
  `;
}

function refreshEquipOverview() {
  const rows = [...document.querySelectorAll('#invListRows .invRow')];
  const items = state.data.items || [];
  rows.forEach((row) => row.classList.toggle('isEquipped', Boolean(row.querySelector('.invSlot')?.value)));
  document.querySelectorAll('.equipOverviewValue[data-slot]').forEach((cell) => {
    const row = rows.find((r) => r.querySelector('.invSlot')?.value === cell.dataset.slot);
    const item = row ? items.find((i) => Number(i.id) === Number(row.querySelector('.invItemSelect')?.value)) : null;
    const level = Number(row?.querySelector('.invLevel')?.value || 0);
    cell.textContent = item ? `${item.name || `Item #${item.id}`}${level ? ` +${level}` : ''}` : '— empty —';
    cell.classList.toggle('isFilled', Boolean(item));
  });
}

function updateInvBadge() {
  const rows = [...document.querySelectorAll('#invListRows .invRow')];
  const equipped = rows.filter((row) => row.querySelector('.invSlot')?.value).length;
  const inBag = rows.length - equipped;
  const badge = $('#invCountBadge');
  if (badge) badge.textContent = `${inBag} item${inBag === 1 ? '' : 's'} in bag · ${equipped} equipped`;
  refreshEquipOverview();
}

function updateVaultBadge() {
  const count = document.querySelectorAll('#vaultListRows .vaultRow').length;
  const badge = $('#vaultCountBadge');
  if (badge) badge.textContent = `${count} item${count === 1 ? '' : 's'} stored`;
}

function updateSkillCountBadge() {
  const count = document.querySelectorAll('#skillGridCards .skillCheckInput:checked').length;
  const badge = $('#skillSelectedCount');
  if (badge) badge.textContent = `${count} skill${count === 1 ? '' : 's'} selected`;
}

window.updateInvBadge = updateInvBadge;
window.updateVaultBadge = updateVaultBadge;
window.updateSkillCountBadge = updateSkillCountBadge;

function setupCharacterModalEvents() {
  // 1. Sub-Tab Switching
  $('#modalTabs').onclick = (event) => {
    const tabBtn = event.target.closest('[data-tab]');
    if (!tabBtn) return;
    const tabName = tabBtn.dataset.tab;
    document.querySelectorAll('#modalTabs .modalNavBtn').forEach((btn) => btn.classList.toggle('active', btn === tabBtn));
    document.querySelectorAll('#fields .tabPanel').forEach((panel) => {
      panel.hidden = panel.id !== `tab-${tabName}`;
    });
  };

  // Dynamic Sublocation options filtered by location selection
  const locSelect = document.querySelector('#charLocationSelect');
  const subSelect = document.querySelector('#charSublocationSelect');
  if (locSelect && subSelect) {
    locSelect.onchange = () => {
      const curSub = subSelect.value;
      subSelect.innerHTML = renderSublocationOptions(curSub, locSelect.value);
    };
  }

  // 2. Monster Toggle
  const monsterCheck = $('#toggleMonsterCheck');
  if (monsterCheck) {
    monsterCheck.onchange = () => {
      const isMon = monsterCheck.checked;
      const wrap = $('#monsterFieldsWrap');
      if (wrap) wrap.style.display = isMon ? 'block' : 'none';
      const recruitCheck = document.querySelector('[name="npc_is_recruitable"]');
      if (recruitCheck) {
        recruitCheck.disabled = isMon;
        if (isMon) recruitCheck.checked = false;
      }
      $('#formBadge').className = `badge ${isMon ? 'badge-monster' : 'badge-npc'}`;
      $('#formBadge').textContent = isMon ? '🐉 MONSTER' : '🧙 NPC';
      const equipTabBtn = document.querySelector('#modalTabs [data-tab="equipment_inventory"]');
      if (equipTabBtn) {
        equipTabBtn.hidden = isMon;
        if (isMon && equipTabBtn.classList.contains('active')) {
          document.querySelector('#modalTabs [data-tab="identity"]')?.click();
        }
      }
      const relationTabBtn = document.querySelector('#modalTabs [data-tab="relationships"]');
      if (relationTabBtn) {
        relationTabBtn.hidden = isMon;
        if (isMon && relationTabBtn.classList.contains('active')) {
          document.querySelector('#modalTabs [data-tab="identity"]')?.click();
        }
      }
    };
  }

  const addPlayerNpcRelation = $('#btnAddPlayerNpcRelation');
  if (addPlayerNpcRelation) {
    const isPlayer = document.querySelector('[name="character_type"]')?.value === 'PLAYER';
    addPlayerNpcRelation.onclick = () => {
      $('#playerNpcRelationRows').insertAdjacentHTML('beforeend', `
        <div class="multiItemRow playerNpcRelationRow">
          <select class="relationTargetSelect">${isPlayer ? renderNpcRelationOptions('') : renderPlayerRelationOptions('')}</select>
          <input class="relationAffinity" type="number" min="-200" max="200" placeholder="Affinity" value="0">
          <select class="relationStatus" disabled>${renderRelationshipStatusOptions('STRANGER')}</select>
          <label><input class="relationNameRevealed" type="checkbox"> Name revealed</label>
          <textarea class="relationNotes" rows="2" maxlength="500" placeholder="Interaction notes"></textarea>
          <button type="button" class="btn-remove-row" title="Remove relationship" onclick="this.closest('.playerNpcRelationRow').remove();">✕</button>
        </div>
      `);
    };
  }

  const addNpcRelation = $('#btnAddNpcRelation');
  if (addNpcRelation) {
    addNpcRelation.onclick = () => {
      const currentId = Number(document.querySelector('[name="character_type"]')?.value === 'NPC' ? state.editing : 0);
      $('#npcRelationRows').insertAdjacentHTML('beforeend', `
        <div class="multiItemRow npcRelationRow">
          <select class="npcRelationTarget">${renderNpcRelationOptions('', currentId)}</select>
          <select class="npcRelationType">${renderNpcRelationshipTypeOptions('ACQUAINTANCE')}</select>
          <textarea class="npcRelationNote" rows="2" maxlength="500" placeholder="Context note"></textarea>
          <label><input class="npcRelationNsfw" type="checkbox"> NSFW</label>
          <button type="button" class="btn-remove-row" title="Remove relationship" onclick="this.closest('.npcRelationRow').remove();">✕</button>
        </div>
      `);
    };
  }

  const addNpcKnownLocation = $('#btnAddNpcKnownLocation');
  if (addNpcKnownLocation) {
    addNpcKnownLocation.onclick = () => {
      $('#npcKnownLocationRows').insertAdjacentHTML('beforeend', `
        <div class="multiItemRow npcKnownLocationRow">
          <select class="knownLocationSelect">${renderLocationOptions('')}</select>
          <select class="knownSublocationSelect">${renderSublocationOptions('', '')}</select>
          <select class="knownLocationType">${renderNpcKnowledgeTypeOptions('LOCAL_LANDMARK')}</select>
          <input class="knownLocationNote" type="text" maxlength="500" placeholder="Knowledge or facts">
          <button type="button" class="btn-remove-row" title="Remove known location" onclick="this.closest('.npcKnownLocationRow').remove();">✕</button>
        </div>
      `);
    };
  }

  const relationRows = $('#playerNpcRelationRows');
  if (relationRows) relationRows.onchange = (event) => {
    if (!event.target.classList.contains('relationTargetSelect')) return;
  };

  const knownRows = $('#npcKnownLocationRows');
  if (knownRows) knownRows.onchange = (event) => {
    if (!event.target.classList.contains('knownLocationSelect')) return;
    const row = event.target.closest('.npcKnownLocationRow');
    const sublocation = row?.querySelector('.knownSublocationSelect');
    if (sublocation) {
      const current = sublocation.value;
      sublocation.innerHTML = renderSublocationOptions(current, event.target.value);
    }
  };

  const addNpcAppearance = $('#btnAddNpcAppearance');
  if (addNpcAppearance) {
    addNpcAppearance.onclick = () => {
      $('#npcAppearanceRows').insertAdjacentHTML('beforeend', `
        <div class="multiItemRow npcAppearanceRow">
          <select class="appearanceLocationSelect">${renderLocationOptions('')}</select>
          <select class="appearanceSublocationSelect">${renderSublocationOptions('', '')}</select>
          <button type="button" class="btn-remove-row" title="Remove appearance" onclick="this.closest('.npcAppearanceRow').remove();">✕</button>
        </div>
      `);
    };
  }

  const appearanceRows = $('#npcAppearanceRows');
  if (appearanceRows) appearanceRows.onchange = (event) => {
    const row = event.target.closest('.npcAppearanceRow');
    if (!row) return;
    const location = row.querySelector('.appearanceLocationSelect');
    const sublocation = row.querySelector('.appearanceSublocationSelect');
    if (event.target === location) {
      if (location.value) sublocation.value = '';
      sublocation.innerHTML = renderSublocationOptions(sublocation.value, location.value);
    } else if (event.target === sublocation && sublocation.value) {
      location.value = '';
    }
  };

  // 3. Add Inventory Row
  const btnAddInv = $('#btnAddInvRow');
  if (btnAddInv) {
    btnAddInv.onclick = () => {
      $('#invListRows').insertAdjacentHTML('beforeend', renderInvRow());
      updateInvBadge();
    };
  }
  const invListRows = $('#invListRows');
  if (invListRows) {
    invListRows.onchange = () => updateInvBadge();
    invListRows.oninput = () => updateInvBadge();
    updateInvBadge();
  }

  // 3b. Add Vault Row
  const btnAddVault = $('#btnAddVaultRow');
  if (btnAddVault) {
    btnAddVault.onclick = () => {
      $('#vaultListRows').insertAdjacentHTML('beforeend', `
        <div class="vaultRow">
          <select class="vaultItemSelect">${renderItemOptions('')}</select>
          <input type="number" class="vaultQty" placeholder="Qty" min="1" value="1">
          <button type="button" class="btn-remove-row" title="Remove Item" onclick="this.closest('.vaultRow').remove(); updateVaultBadge();">✕</button>
        </div>
      `);
      updateVaultBadge();
    };
  }

  // 4. Skills Filter & Card Selection
  const filterSkills = () => {
    const query = ($('#skillSearchInput')?.value || '').toLowerCase().trim();
    const type = $('#skillTypeFilter')?.value || '';
    const rarity = $('#skillRarityFilter')?.value || '';
    document.querySelectorAll('#skillGridCards .relationCard').forEach((card) => {
      const matchQuery = !query || card.dataset.name.includes(query);
      const matchType = !type || card.dataset.type === type;
      const matchRarity = !rarity || card.dataset.rarity === rarity;
      card.style.display = (matchQuery && matchType && matchRarity) ? 'flex' : 'none';
    });
  };

  if ($('#skillSearchInput')) $('#skillSearchInput').oninput = filterSkills;
  if ($('#skillTypeFilter')) $('#skillTypeFilter').onchange = filterSkills;
  if ($('#skillRarityFilter')) $('#skillRarityFilter').onchange = filterSkills;

  if ($('#skillGridCards')) {
    $('#skillGridCards').onclick = (e) => {
      const card = e.target.closest('.relationCard');
      if (!card) return;
      if (e.target.type !== 'checkbox') {
        const check = card.querySelector('.skillCheckInput');
        if (check) {
          check.checked = !check.checked;
          card.classList.toggle('selected', check.checked);
        }
      } else {
        card.classList.toggle('selected', e.target.checked);
      }
      updateSkillCountBadge();
    };
  }

  // 5. Add Spellpoint Row
  const btnAddSp = $('#btnAddSpRow');
  if (btnAddSp) {
    btnAddSp.onclick = () => {
      const currentRows = document.querySelectorAll('#spGridRows .spRow').length;
      $('#spGridRows').insertAdjacentHTML('beforeend', `
        <div class="spRow">
          <label>Tier / Level<input type="number" class="spLevel" min="1" max="9" placeholder="Level" value="${currentRows + 1}"></label>
          <label>Max Spell Slots<input type="number" class="spMax" min="0" placeholder="Max" value="4"></label>
          <label>Current Available Slots<input type="number" class="spCur" min="0" placeholder="Current" value="4"></label>
          <button type="button" class="btn-remove-row" title="Remove Tier" onclick="this.closest('.spRow').remove();">✕</button>
        </div>
      `);
    };
  }

  // 6. Add Lifeskill Row
  const btnAddLs = $('#btnAddLifeskillRow');
  if (btnAddLs) {
    btnAddLs.onclick = () => {
      $('#lifeskillRowsWrap').insertAdjacentHTML('beforeend', `
        <div class="multiItemRow">
          <select class="lsSelect">${renderLifeskillOptions('')}</select>
          <input type="number" class="lsLevel" placeholder="Level" min="1" value="1">
          <input type="number" class="lsExp" placeholder="EXP" min="0" value="0">
          <button type="button" class="btn-remove-row" title="Remove" onclick="this.closest('.multiItemRow').remove();">✕</button>
        </div>
      `);
    };
  }

  // 7. Add Effect Row
  const btnAddEf = $('#btnAddEffectRow');
  if (btnAddEf) {
    btnAddEf.onclick = () => {
      $('#effectRowsWrap').insertAdjacentHTML('beforeend', `
        <div class="effectItemRow">
          <select class="efSelect">${renderEffectOptions('')}</select>
          <input type="number" class="efDuration" placeholder="Duration (Turns)" min="0" value="3">
          <button type="button" class="btn-remove-row" title="Remove" onclick="this.closest('.effectItemRow').remove();">✕</button>
        </div>
      `);
    };
  }

  // 8. Add Memory Row
  const btnAddMem = $('#btnAddMemoryRow');
  if (btnAddMem) {
    btnAddMem.onclick = () => {
      $('#memoryRowsWrap').insertAdjacentHTML('beforeend', `
        <div class="memoryItemCard">
          <textarea class="memText" placeholder="Enter character memory or lore note..."></textarea>
          <select class="memType">${renderMemoryTypeOptions('SEMANTIC')}</select>
          <select class="memTarget">${renderCharacterOptions('')}</select>
          <label><input class="memSecret" type="checkbox"> Secret</label>
          <label><input class="memNsfw" type="checkbox"> NSFW</label>
          <button type="button" class="btn-remove-row" title="Remove Memory" onclick="this.closest('.memoryItemCard').remove();">✕</button>
        </div>
      `);
    };
  }
}

// Standalone Child Relation Dialog Handler
function ensureRelationDialog() {
  if ($('#relationEditor')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="relationEditor">
      <form method="dialog" id="relationForm">
        <div class="modalHead">
          <div class="modalHeadTitle">
            <span class="eyebrow">RELATION EDITOR</span>
            <h2 id="relationTitle"></h2>
          </div>
          <button id="relationClose" type="button" class="close" title="Close" formnovalidate>✕</button>
        </div>
        <div id="relationFields" class="modalBody"></div>
        <div class="actions">
          <button id="relationCancel" type="button" class="ghost" formnovalidate>Cancel</button>
          <button id="relationApply" type="submit" value="default" class="primary">Apply</button>
        </div>
      </form>
    </dialog>
  `);

  const closeRelation = () => {
    $('#relationEditor')?.close();
  };

  $('#relationClose').onclick = (e) => {
    e.preventDefault();
    closeRelation();
  };
  $('#relationCancel').onclick = (e) => {
    e.preventDefault();
    closeRelation();
  };

  $('#relationEditor').addEventListener('click', (event) => {
    if (event.target === $('#relationEditor')) {
      closeRelation();
    }
  });

  $('#relationForm').onsubmit = (event) => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel' || event.submitter?.id === 'relationCancel' || event.submitter?.id === 'relationClose') {
      closeRelation();
      return;
    }
    const relation = $('#relationEditor').dataset.relation;
    relationData[relation] = relationFormValue(relation);
    state.appliedRelations.add(relation);
    closeRelation();
  };
}

function relationFormValue(type) {
  const form = new FormData($('#relationForm'));
  if (type === 'memories') {
    return [...document.querySelectorAll('#relationFields .memoryItemCard')].map((row) => ({
      content: row.querySelector('.memText')?.value.trim() || '',
      memory_type: row.querySelector('.memType')?.value || 'SEMANTIC',
      target_character_id: row.querySelector('.memTarget')?.value ? Number(row.querySelector('.memTarget').value) : null,
      is_secret: Boolean(row.querySelector('.memSecret')?.checked),
      is_nsfw: Boolean(row.querySelector('.memNsfw')?.checked)
    })).filter((memory) => memory.content);
  }
  if (type === 'equipment') {
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, v ? Number(v) : null]));
  }
  if (type === 'inventory') {
    const max_slots = Number(form.get('max_slots') || 40);
    const items = [...document.querySelectorAll('#relationFields .invRow')].map((row) => ({
      item_id: Number(row.querySelector('.invItemSelect').value),
      quantity: Number(row.querySelector('.invQty').value || 1),
      current_level_upgraded: Number(row.querySelector('.invLevel')?.value || 0),
      prefix_id: row.querySelector('.invPrefix')?.value ? Number(row.querySelector('.invPrefix').value) : null,
      suffix_id: row.querySelector('.invSuffix')?.value ? Number(row.querySelector('.invSuffix').value) : null
    })).filter((i) => i.item_id);
    return { max_slots, items };
  }
  if (type === 'skills') {
    return [...document.querySelectorAll('#relationFields .skillCheckInput:checked')].map((input) => Number(input.value));
  }
  if (type === 'effects') {
    return [...document.querySelectorAll('#relationFields .effectItemRow')].map((row) => ({
      effect_id: Number(row.querySelector('.efSelect').value),
      duration_turn: Number(row.querySelector('.efDuration').value || 0)
    })).filter((e) => e.effect_id);
  }
  if (type === 'itemEffects' || type === 'skillEffects') {
    return [...document.querySelectorAll('#relationFields .effectItemRow')].map((row) => ({
      effect_id: Number(row.querySelector('.efSelect').value),
      ...(type === 'skillEffects' ? { duration: Number(row.querySelector('.efDuration').value || 1) } : {})
    })).filter((effect) => effect.effect_id);
  }
  if (type === 'lootItems') {
    return [...document.querySelectorAll('#relationFields .lootItemRow')].map((row) => ({
      item_id: Number(row.querySelector('.lootItemSelect').value),
      chance_pct: Number(row.querySelector('.lootChance').value || 0),
      min_quantity: Number(row.querySelector('.lootMin').value || 1),
      max_quantity: Number(row.querySelector('.lootMax').value || 1)
    })).filter((item) => item.item_id);
  }
  if (type === 'lootMonsters') return [...document.querySelectorAll('#relationFields .lootMonsterCheck:checked')].map((input) => Number(input.value));
  if (type === 'spellpoints') {
    return [...document.querySelectorAll('#relationFields .spRow')].map((row) => ({
      level: Number(row.querySelector('.spLevel').value || 1),
      max_current: Number(row.querySelector('.spMax').value || 0),
      current: Number(row.querySelector('.spCur').value || 0)
    })).filter((s) => s.level);
  }
  if (type === 'lifeskills') {
    return [...document.querySelectorAll('#relationFields .multiItemRow')].map((row) => ({
      lifeskill_id: Number(row.querySelector('.lsSelect').value),
      current_level: Number(row.querySelector('.lsLevel').value || 1),
      current_exp: Number(row.querySelector('.lsExp').value || 0)
    })).filter((l) => l.lifeskill_id);
  }
  return [];
}

function relationEditor(type) {
  ensureRelationDialog();
  const data = relationData[type] || [];
  const fields = $('#relationFields');
  $('#relationEditor').dataset.relation = type;
  $('#relationTitle').textContent = type === 'inventory' ? 'Inventory Items' : type === 'equipment' ? 'Equipment Slots' : type[0].toUpperCase() + type.slice(1);

  if (type === 'equipment') {
    const groups = [
      ['Armour', [['helmet_id', 'Helmet', ['HELMET']], ['armor_id', 'Armor', ['ARMOR']], ['gloves_id', 'Gloves', ['GLOVES']], ['shoes_id', 'Shoes', ['SHOES']]]],
      ['Accessories', [['left_ring_id', 'Left Ring', ['RING']], ['right_ring_id', 'Right Ring', ['RING']], ['left_earring_id', 'Left Earring', ['EARRING']], ['right_earring_id', 'Right Earring', ['EARRING']], ['necklace_id', 'Necklace', ['NECKLACE']], ['belt_id', 'Belt', ['BELT']]]],
      ['Weapons', [['left_hand_id', 'Left Hand', ['MAIN_HAND', 'TWO_HAND']], ['right_hand_id', 'Right Hand', ['MAIN_HAND']]]]
    ];
    fields.innerHTML = `<div class="equipSections">${groups.map(([grp, slots]) => `
      <div style="display:grid; gap:10px;">
        <div style="font-size:12px; font-weight:700; color:var(--gold); border-bottom:1px solid var(--line); padding-bottom:4px;">${grp}</div>
        ${slots.map(([slot, label, types]) => `
          <div class="equipSlotCard">
            <div class="equipSlotHeader"><span>${label}</span></div>
            <div class="equipSlotSelectWrap">
              <select name="${slot}">${renderItemOptions(data[slot], types)}</select>
              <button type="button" class="btn-icon-clear" onclick="this.previousElementSibling.value='';">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}</div>`;
  } else if (type === 'inventory') {
    fields.innerHTML = `
      <div class="invHeaderBar">
        <label style="display:flex; align-items:center; gap:8px;">
          <b>Max Slots:</b>
          <input type="number" name="max_slots" value="${data.max_slots || 40}" style="width:90px;">
        </label>
        <button type="button" class="ghost" id="btnAddDialogInv">＋ Add Item</button>
      </div>
      <div class="invList" id="dialogInvRows">
        ${(data.items || []).map((item) => `
            <div class="invRow">
              <select class="invItemSelect">${renderItemOptions(item.item_id)}</select>
              <input type="number" class="invQty" placeholder="Qty" value="${item.quantity || 1}">
              <input type="number" class="invLevel" placeholder="+Lv" min="0" value="${item.current_level_upgraded || 0}">
              <select class="invPrefix">${renderPrefixOptions(item.prefix_id)}</select>
              <select class="invSuffix">${renderSuffixOptions(item.suffix_id)}</select>
              <button type="button" class="btn-remove-row" onclick="this.closest('.invRow').remove();">✕</button>
          </div>
        `).join('')}
      </div>
    `;
    $('#btnAddDialogInv').onclick = () => {
      $('#dialogInvRows').insertAdjacentHTML('beforeend', `
        <div class="invRow">
          <select class="invItemSelect">${renderItemOptions('')}</select>
          <input type="number" class="invQty" placeholder="Qty" value="1">
          <input type="number" class="invLevel" placeholder="+Lv" min="0" value="0">
          <select class="invPrefix">${renderPrefixOptions('')}</select>
          <select class="invSuffix">${renderSuffixOptions('')}</select>
          <button type="button" class="btn-remove-row" onclick="this.closest('.invRow').remove();">✕</button>
        </div>
      `);
    };
  } else if (type === 'skills') {
    const selected = new Set(data || []);
    fields.innerHTML = `
      <div class="relationGrid">${(state.data.skills || []).map((sk) => `
        <label class="relationCard ${selected.has(sk.id) ? 'selected' : ''}">
          <input type="checkbox" class="skillCheckInput" name="skill_id" value="${sk.id}" ${selected.has(sk.id) ? 'checked' : ''}>
          <span>
            <b>${esc(sk.name || `Skill #${sk.id}`)}</b>
            <small><span class="rarity-${sk.rarity}">${sk.rarity}</span> · ${sk.type}</small>
          </span>
        </label>
      `).join('')}</div>
    `;
  } else if (type === 'effects' || type === 'itemEffects' || type === 'skillEffects') {
    const withDuration = type !== 'itemEffects';
    fields.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button type="button" class="ghost" id="btnAddDialogEf">＋ Add Effect</button></div>
      <div id="dialogEfRows">${(data || []).map((ef) => `
        <div class="effectItemRow">
          <select class="efSelect">${renderEffectOptions(ef.effect_id)}</select>
          ${withDuration ? `<input type="number" class="efDuration" min="1" placeholder="Duration (Turns)" value="${ef.duration ?? 1}">` : ''}
          <button type="button" class="btn-remove-row" onclick="this.closest('.effectItemRow').remove();">✕</button>
        </div>
      `).join('')}</div>
    `;
    $('#btnAddDialogEf').onclick = () => {
      $('#dialogEfRows').insertAdjacentHTML('beforeend', `
        <div class="effectItemRow">
          <select class="efSelect">${renderEffectOptions('')}</select>
          ${withDuration ? '<input type="number" class="efDuration" min="1" placeholder="Duration (Turns)" value="1">' : ''}
          <button type="button" class="btn-remove-row" onclick="this.closest('.effectItemRow').remove();">✕</button>
        </div>
      `);
    };
  } else if (type === 'memories') {
    fields.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button type="button" class="ghost" id="btnAddDialogMem">＋ Add Memory</button></div>
      <div id="dialogMemRows">${(data || []).map((m) => `
        <div class="memoryItemCard">
          <textarea class="memText" placeholder="Enter memory note...">${esc(m.content || m.memory)}</textarea>
          <select class="memType">${renderMemoryTypeOptions(m.memory_type)}</select>
          <select class="memTarget">${renderCharacterOptions(m.target_character_id)}</select>
          <label><input class="memSecret" type="checkbox" ${m.is_secret ? 'checked' : ''}> Secret</label>
              <label><input class="memNsfw" type="checkbox" ${m.is_nsfw ? 'checked' : ''}> NSFW</label>
          <button type="button" class="btn-remove-row" onclick="this.closest('.memoryItemCard').remove();">✕</button>
        </div>
      `).join('')}</div>
    `;
    $('#btnAddDialogMem').onclick = () => {
      $('#dialogMemRows').insertAdjacentHTML('beforeend', `
        <div class="memoryItemCard">
          <textarea class="memText" placeholder="Enter memory note..."></textarea>
          <select class="memType">${renderMemoryTypeOptions('SEMANTIC')}</select>
          <select class="memTarget">${renderCharacterOptions('')}</select>
          <label><input class="memSecret" type="checkbox"> Secret</label>
          <label><input class="memNsfw" type="checkbox"> NSFW</label>
          <button type="button" class="btn-remove-row" onclick="this.closest('.memoryItemCard').remove();">✕</button>
        </div>
      `);
    };
  } else if (type === 'spellpoints') {
    fields.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button type="button" class="ghost" id="btnAddDialogSp">＋ Add Spell Tier</button></div>
      <div class="spGrid" id="dialogSpRows">${(data || []).map((sp) => `
        <div class="spRow">
          <label>Level<input type="number" class="spLevel" min="1" value="${sp.level ?? 1}"></label>
          <label>Max Slots<input type="number" class="spMax" min="0" value="${sp.max_current ?? 4}"></label>
          <label>Current Slots<input type="number" class="spCur" min="0" value="${sp.current ?? 4}"></label>
          <button type="button" class="btn-remove-row" onclick="this.closest('.spRow').remove();">✕</button>
        </div>
      `).join('')}</div>
    `;
    $('#btnAddDialogSp').onclick = () => {
      $('#dialogSpRows').insertAdjacentHTML('beforeend', `
        <div class="spRow">
          <label>Level<input type="number" class="spLevel" min="1" value="1"></label>
          <label>Max Slots<input type="number" class="spMax" min="0" value="4"></label>
          <label>Current Slots<input type="number" class="spCur" min="0" value="4"></label>
          <button type="button" class="btn-remove-row" onclick="this.closest('.spRow').remove();">✕</button>
        </div>
      `);
    };
  } else if (type === 'lifeskills') {
    fields.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button type="button" class="ghost" id="btnAddDialogLs">＋ Add Lifeskill</button></div>
      <div id="dialogLsRows">${(data || []).map((ls) => `
        <div class="multiItemRow">
          <select class="lsSelect">${renderLifeskillOptions(ls.lifeskill_id)}</select>
          <input type="number" class="lsLevel" placeholder="Level" value="${ls.current_level || 1}">
          <input type="number" class="lsExp" placeholder="EXP" value="${ls.current_exp || 0}">
          <button type="button" class="btn-remove-row" onclick="this.closest('.multiItemRow').remove();">✕</button>
        </div>
      `).join('')}</div>
    `;
    $('#btnAddDialogLs').onclick = () => {
      $('#dialogLsRows').insertAdjacentHTML('beforeend', `
        <div class="multiItemRow">
          <select class="lsSelect">${renderLifeskillOptions('')}</select>
          <input type="number" class="lsLevel" placeholder="Level" value="1">
          <input type="number" class="lsExp" placeholder="EXP" value="0">
          <button type="button" class="btn-remove-row" onclick="this.closest('.multiItemRow').remove();">✕</button>
        </div>
      `);
    };
  } else if (type === 'lootItems') {
    const itemTypes = [...new Set((state.data.items || []).map((item) => item.type).filter(Boolean))].sort();
    const itemRarities = [...new Set((state.data.items || []).map((item) => item.rarity).filter(Boolean))].sort();
    fields.innerHTML = `
      <div class="lootItemToolbar">
        <label class="lootSearchField">Find item
          <input id="lootItemSearch" type="search" placeholder="Search by name, ID, type, or rarity">
        </label>
        <label>Type
          <select id="lootItemType"><option value="">All types</option>${itemTypes.map((typeName) => `<option value="${esc(typeName)}">${esc(typeName)}</option>`).join('')}</select>
        </label>
        <label>Rarity
          <select id="lootItemRarity"><option value="">All rarities</option>${itemRarities.map((rarity) => `<option value="${esc(rarity)}">${esc(rarity)}</option>`).join('')}</select>
        </label>
        <button type="button" class="primary" id="btnAddLootItem">＋ Add Item</button>
        <small id="lootItemResultCount" class="muted"></small>
      </div>
      <div class="lootItemHint">Each item rolls independently. Set a chance from 0–100% and the quantity range awarded when it drops.</div>
      <div id="lootItemRows">${(data || []).map((item) => `
        <div class="lootItemRow">
          <label class="lootItemField lootItemChoice">Item<select class="lootItemSelect">${renderLootItemOptions(item.item_id)}</select></label>
          <label class="lootItemField">Loot chance (%)<input class="lootChance" type="number" min="0" max="100" step="0.01" placeholder="e.g. 25" value="${item.chance_pct ?? 0}"></label>
          <label class="lootItemField">Min quantity<input class="lootMin" type="number" min="1" placeholder="e.g. 1" value="${item.min_quantity ?? 1}"></label>
          <label class="lootItemField">Max quantity<input class="lootMax" type="number" min="1" placeholder="e.g. 1" value="${item.max_quantity ?? 1}"></label>
          <button type="button" class="btn-remove-row lootRemove" title="Remove item" onclick="this.closest('.lootItemRow').remove();">✕</button>
        </div>
      `).join('')}</div>`;
    const addLootItemRow = () => $('#lootItemRows').insertAdjacentHTML('beforeend', `
      <div class="lootItemRow">
        <label class="lootItemField lootItemChoice">Item<select class="lootItemSelect">${renderLootItemOptions('', lootItemFilters())}</select></label>
        <label class="lootItemField">Loot chance (%)<input class="lootChance" type="number" min="0" max="100" step="0.01" placeholder="e.g. 25" value="0"></label>
        <label class="lootItemField">Min quantity<input class="lootMin" type="number" min="1" placeholder="e.g. 1" value="1"></label>
        <label class="lootItemField">Max quantity<input class="lootMax" type="number" min="1" placeholder="e.g. 1" value="1"></label>
        <button type="button" class="btn-remove-row lootRemove" title="Remove item" onclick="this.closest('.lootItemRow').remove();">✕</button>
      </div>`);
    $('#btnAddLootItem').onclick = addLootItemRow;
    $('#lootItemSearch').oninput = refreshLootItemOptions;
    $('#lootItemType').onchange = refreshLootItemOptions;
    $('#lootItemRarity').onchange = refreshLootItemOptions;
    refreshLootItemOptions();
  } else if (type === 'lootMonsters') {
    const selected = new Set(data || []);
    fields.innerHTML = `
      <div class="lootMonsterToolbar">
        <label>Find monster
          <input id="lootMonsterSearch" type="search" placeholder="Search by monster name or ID">
        </label>
        <small id="lootMonsterResultCount" class="muted"></small>
      </div>
      <div class="relationGrid" id="lootMonsterCards">${(state.data.monsters || []).map((monster) => {
        const name = monster.npc?.character?.name || `Monster #${monster.character_id}`;
        const level = monster.npc?.character?.level || 1;
        const searchText = `${name} ${monster.character_id} ${level}`.toLowerCase();
        return `<label class="relationCard lootMonsterCard" data-search="${esc(searchText)}"><input class="lootMonsterCheck" type="checkbox" value="${monster.character_id}" ${selected.has(monster.character_id) ? 'checked' : ''}>
          <span><b>${esc(name)}</b><small>Level ${level} · #${monster.character_id}</small></span>
        </label>`;
      }).join('') || '<div class="empty">No active monster characters available.</div>'}</div>`;
    $('#lootMonsterSearch').oninput = refreshLootMonsterCards;
    refreshLootMonsterCards();
  }
  $('#relationEditor').showModal();
}

function renderItemModal(record) {
  const isCreate = !state.editing;
  const rarity = readValue('rarity', record) || 'NORMAL';
  const itemType = readValue('type', record) || 'HELMET';
  const weaponType = readValue('weapon_type', record) || 'SWORD';
  const triggerType = readValue('effect.item_trigger_type', record) || 'NONE';
  const cureType = readValue('effect.cure_effect_type', record) || 'NONE';

  $('#formBadge').className = `badge badge-rarity-${rarity.toLowerCase()}`;
  $('#formBadge').textContent = `${rarity} · ${itemType}`;
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Item${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Item' : 'Save Changes';

  $('#fields').className = 'modalBody';
  
  const types = ['HELMET', 'ARMOR', 'SHOES', 'GLOVES', 'EARRING', 'RING', 'NECKLACE', 'BELT', 'MAIN_HAND', 'TWO_HAND', 'QUEST_ITEMS', 'MISCS', 'FOOD', 'FISH', 'POTION', 'SKILL_SCROLL'];
  const weaponTypes = ['SWORD', 'BOW', 'STAFF', 'QUARTERSTAFF', 'AXE', 'SPEAR', 'GREATSWORD', 'SHORTSWORD', 'CLUB', 'KNIFE'];
  const rarities = ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'];
  const triggers = ['NONE', 'ON_START_OF_TURN', 'ON_END_OF_TURN', 'AT_TURN_NUMBER', 'EVERY_TURN'];
  const cures = ['NONE', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON'];

  const isWeapon = itemType === 'MAIN_HAND' || itemType === 'TWO_HAND';

  const attrStats = [
    ['max_hp_bonus', 'Max HP Bonus'],
    ['healing_current_hp', 'Healing current HP'],
    ['current_food_bonus', 'Food Recovery Bonus (Hunger)'],
    ['current_water_bonus', 'Water Recovery Bonus (Thirst)'],
    ['current_energy_bonus', 'Energy Recovery Bonus'],
    ['proficiency_bonus', 'Proficiency Bonus'],
    ['strength_bonus', 'Strength (STR) Bonus'],
    ['dexterity_bonus', 'Dexterity (DEX) Bonus'],
    ['intelligent_bonus', 'Intelligence (INT) Bonus'],
    ['constitution_bonus', 'Constitution (CON) Bonus'],
    ['wisdom_bonus', 'Wisdom (WIS) Bonus'],
    ['charisma_bonus', 'Charisma (CHA) Bonus']
  ];

  const combatStats = [
    ['physical_attack_bonus', 'Phys Attack Bonus'],
    ['magical_attack_bonus', 'Magic Attack Bonus'],
    ['armor_bonus', 'Armor Bonus'],
    ['magical_armor_bonus', 'Magic Armor Bonus'],
    ['effect_resistant_bonus', 'Effect Resist Bonus'],
    ['crit_chance_bonus', 'Crit Chance Bonus (%)'],
    ['crit_damage_bonus', 'Crit Damage Bonus (%)'],
    ['evade_chance_bonus', 'Evade Chance (%)'],
    ['accuracy_bonus', 'Accuracy (%)']
  ];

  const elemStats = [
    ['fire_element_resistant', 'Fire Resist', 'res-fire'],
    ['ice_element_resistant', 'Ice Resist', 'res-ice'],
    ['earth_element_resistant', 'Earth Resist', 'res-earth'],
    ['lightning_element_resistant', 'Lightning Resist', 'res-lightning'],
    ['wind_element_resistant', 'Wind Resist', 'res-wind'],
    ['holy_element_resistant', 'Holy Resist', 'res-holy'],
    ['dark_element_resistant', 'Dark Resist', 'res-dark']
  ];

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📦 Item Identity & Economics</span>
        </div>
        <div class="cardGrid3">
          <label>Item Name
            <input name="name" type="text" placeholder="e.g. Iron Longsword" value="${esc(readValue('name', record))}">
          </label>
          <label>Item Type
            <select name="type" id="itemModalType">
              ${types.map((t) => `<option value="${t}" ${itemType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          <label id="itemModalWeaponTypeWrap" ${isWeapon ? '' : 'style="opacity:0.5;"'}>Weapon Type
            <select name="weapon_type" id="itemModalWeaponType">
              ${weaponTypes.map((w) => `<option value="${w}" ${weaponType === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="cardGrid4">
          <label>Rarity
            <select name="rarity">
              ${rarities.map((r) => `<option value="${r}" ${rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>
          <label>Price (Gold)
            <input name="price" type="number" min="0" value="${esc(readValue('price', record) || 0)}">
          </label>
          <label>Item Size (Slots)
            <input name="size" type="number" min="1" value="${esc(readValue('size', record) || 1)}">
          </label>
          <label>Max Upgrade Level
            <input name="max_upgrade_level" type="number" min="0" value="${esc(readValue('max_upgrade_level', record) || 0)}">
          </label>
        </div>
        <div class="cardGrid3">
          <label class="switchLabel">
            <input name="is_stackable" type="checkbox" id="itemModalStackable" ${readValue('is_stackable', record) ? 'checked' : ''}>
            <span><b>Stackable</b><small>Allows multiple in one bag slot</small></span>
          </label>
          <label id="itemModalMaxStackWrap" ${readValue('is_stackable', record) ? '' : 'style="opacity:0.5;"'}>Max Stack Size
            <input name="max_stack" type="number" min="1" value="${esc(readValue('max_stack', record) || 1)}">
          </label>
          <label class="switchLabel">
            <input name="is_buyable" type="checkbox" ${readValue('is_buyable', record) ? 'checked' : ''}>
            <span><b>Buyable in Shop</b><small>Available at merchants</small></span>
          </label>
          <label class="switchLabel">
            <input name="is_consumable" type="checkbox" ${readValue('is_consumable', record) ? 'checked' : ''}>
            <span><b>Consumable</b><small>Can be used from the backpack or in combat</small></span>
          </label>
          <label class="switchLabel">
            <input name="is_material" type="checkbox" ${readValue('is_material', record) ? 'checked' : ''}>
            <span><b>Material</b><small>Usable as a crafting or upgrade material</small></span>
          </label>
          <label class="switchLabel">
            <input name="is_nsfw" type="checkbox" ${readValue('is_nsfw', record) ? 'checked' : ''}>
            <span><b>NSFW</b><small>Hidden from players without NSFW access</small></span>
          </label>
        </div>
        <label class="full">Description
          <textarea name="description" placeholder="Description and lore of the item...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">⚡ Combat Triggers & Effect Removal</span>
        </div>
        <div class="cardGrid2">
          <label>Item Trigger Timing
            <select name="effect.item_trigger_type">
              ${triggers.map((tr) => `<option value="${tr}" ${triggerType === tr ? 'selected' : ''}>${tr}</option>`).join('')}
            </select>
          </label>
          <label>Cure Effect Type
            <select name="effect.cure_effect_type">
              ${cures.map((c) => `<option value="${c}" ${cureType === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">♻️ Stat Bonus When Used</span>
        </div>
        <div class="cardGrid2">
          <label>Bonus Mode (consumables)
            <select name="effect.consume_bonus_mode">
              ${[['NONE', 'NONE · instant effects only'], ['TEMPORARY', 'TEMPORARY · stats for a limited time'], ['PERMANENT_ONCE', 'PERMANENT_ONCE · stats forever, first use only']].map(([mode, text]) => `<option value="${mode}" ${(readValue('effect.consume_bonus_mode', record) || 'NONE') === mode ? 'selected' : ''}>${text}</option>`).join('')}
            </select>
          </label>
          <label>Buff Duration (minutes, TEMPORARY only)
            <input name="effect.buff_duration_minutes" type="number" min="0" value="${esc(readValue('effect.buff_duration_minutes', record) || 0)}">
          </label>
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🛡️ Stat & Resistance Bonuses</span>
        </div>
        <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase;">Core Attributes & Vitals</div>
        <div class="cardGrid3">
          ${attrStats.map(([key, label]) => `
            <label>${label}
              <input name="effect.${key}" type="number" value="${esc(readValue(`effect.${key}`, record))}">
            </label>
          `).join('')}
        </div>
        <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-top:8px;">Combat Scaling</div>
        <div class="cardGrid4">
          ${combatStats.map(([key, label]) => `
            <label>${label}
              <input name="effect.${key}" type="number" step="0.1" value="${esc(readValue(`effect.${key}`, record))}">
            </label>
          `).join('')}
        </div>
        <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-top:8px;">Elemental Resistances</div>
        <div class="cardGrid4">
          ${elemStats.map(([key, label, colorClass]) => `
            <label><span class="resBadge ${colorClass}">${label}</span>
              <input name="effect.${key}" type="number" value="${esc(readValue(`effect.${key}`, record))}">
            </label>
          `).join('')}
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🎯 Granted Skills (skills_in_items)</span>
          <button type="button" class="ghost" id="btnAddItemSkill" style="padding:4px 10px; font-size:12px;">+ Add Skill</button>
        </div>
        <div id="itemModalSkillList" class="inlineRelationList">
          ${(relationData.itemSkills || []).map((skId) => `
            <div class="effectItemRow">
              <select class="itemSkillSelect">${renderSkillOptions(skId)}</select>
              <div></div>
              <button type="button" class="btn-remove-row" onclick="this.closest('.effectItemRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
        <div id="itemModalNoSkills" class="empty" style="padding:15px; ${(relationData.itemSkills || []).length ? 'display:none;' : ''}">No skills granted by this item.</div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">✨ Linked Status Effects</span>
          <button type="button" class="ghost" id="btnAddItemEffect" style="padding:4px 10px; font-size:12px;">+ Add Effect</button>
        </div>
        <div id="itemModalEffectList" class="inlineRelationList">
          ${(relationData.itemEffects || []).map((ef) => `
            <div class="effectItemRow">
              <select class="efSelect">${renderEffectOptions(ef.effect_id)}</select>
              <div></div>
              <button type="button" class="btn-remove-row" onclick="this.closest('.effectItemRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
        <div id="itemModalNoEffects" class="empty" style="padding:15px; ${(relationData.itemEffects || []).length ? 'display:none;' : ''}">No bonus status effects linked.</div>
      </div>
    </div>
  `;

  $('#itemModalType').onchange = (e) => {
    const isW = e.target.value === 'MAIN_HAND' || e.target.value === 'TWO_HAND';
    $('#itemModalWeaponTypeWrap').style.opacity = isW ? '1' : '0.5';
  };
  $('#itemModalStackable').onchange = (e) => {
    $('#itemModalMaxStackWrap').style.opacity = e.target.checked ? '1' : '0.5';
  };
  $('#btnAddItemSkill').onclick = () => {
    $('#itemModalNoSkills').style.display = 'none';
    $('#itemModalSkillList').insertAdjacentHTML('beforeend', `
      <div class="effectItemRow">
        <select class="itemSkillSelect">${renderSkillOptions('')}</select>
        <div></div>
        <button type="button" class="btn-remove-row" onclick="this.closest('.effectItemRow').remove();">✕</button>
      </div>
    `);
  };
  $('#btnAddItemEffect').onclick = () => {
    $('#itemModalNoEffects').style.display = 'none';
    $('#itemModalEffectList').insertAdjacentHTML('beforeend', `
      <div class="effectItemRow">
        <select class="efSelect">${renderEffectOptions('')}</select>
        <div></div>
        <button type="button" class="btn-remove-row" onclick="this.closest('.effectItemRow').remove();">✕</button>
      </div>
    `);
  };
}

function renderSkillModal(record) {
  const isCreate = !state.editing;
  const rarity = readValue('rarity', record) || 'NORMAL';
  const skillType = readValue('type', record) || 'ATTACK';
  const targetRule = readValue('skill_target_rule', record) || 'ON_SELECTED_ENEMY';
  const damageType = readValue('skill_damage_type', record) || 'PHYSICAL';
  const cureType = readValue('cure_effect_type', record) || 'NONE';

  $('#formBadge').className = `badge badge-rarity-${rarity.toLowerCase()}`;
  $('#formBadge').textContent = `${rarity} · ${skillType}`;
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Skill${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Skill' : 'Save Changes';

  $('#fields').className = 'modalBody';

  const types = ['ATTACK', 'MAGIC_ATTACK', 'DEFEND', 'SPELL'];
  const rarities = ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'];
  const targetRules = ['SELF_ONLY', 'ALL_PARTY_MEMBERS', 'ON_SELECTED_ALLY', 'ON_SELECTED_ENEMY', 'ALL_ENEMIES', 'TO_ALL'];
  const damageTypes = ['PHYSICAL', 'MAGICAL', 'HYBRID'];
  const cures = ['NONE', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON'];

  const elems = [
    ['fire_damage', 'Fire Damage', 'res-fire'],
    ['ice_damage', 'Ice Damage', 'res-ice'],
    ['earth_damage', 'Earth Damage', 'res-earth'],
    ['lightning_damage', 'Lightning Damage', 'res-lightning'],
    ['wind_damage', 'Wind Damage', 'res-wind'],
    ['holy_damage', 'Holy Damage', 'res-holy'],
    ['dark_damage', 'Dark Damage', 'res-dark']
  ];

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🔮 Skill Identity & Targeting</span>
        </div>
        <div class="cardGrid3">
          <label>Skill Name
            <input name="name" type="text" placeholder="e.g. Arcane Blast" value="${esc(readValue('name', record))}">
          </label>
          <label>Skill Menu Type
            <select name="type">
              ${types.map((t) => `<option value="${t}" ${skillType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          <label>Rarity
            <select name="rarity">
              ${rarities.map((r) => `<option value="${r}" ${rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="cardGrid4">
          <label>Target Rule
            <select name="skill_target_rule">
              ${targetRules.map((tr) => `<option value="${tr}" ${targetRule === tr ? 'selected' : ''}>${tr}</option>`).join('')}
            </select>
          </label>
          <label>Damage Type
            <select name="skill_damage_type">
              ${damageTypes.map((dt) => `<option value="${dt}" ${damageType === dt ? 'selected' : ''}>${dt}</option>`).join('')}
            </select>
          </label>
          <label>Energy / AP Cost
            <input name="energy_consume_cost" type="number" min="0" value="${esc(readValue('energy_consume_cost', record) ?? 1)}">
          </label>
          <label>Duration (Turns)
            <input name="duration" type="number" min="0" value="${esc(readValue('duration', record) ?? 0)}">
          </label>
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">⚔️ Combat Amplifiers & Recovery</span>
        </div>
        <div class="cardGrid4">
          <label>Attack Amplifier
            <input name="attack_amplifier" type="number" step="0.05" value="${esc(readValue('attack_amplifier', record) ?? 1.0)}">
          </label>
          <label>Magic Attack Amp
            <input name="magical_attack_amplifier" type="number" step="0.05" value="${esc(readValue('magical_attack_amplifier', record) ?? 1.0)}">
          </label>
          <label>Armor Amplifier
            <input name="armor_amplifier" type="number" step="0.05" value="${esc(readValue('armor_amplifier', record) ?? 1.0)}">
          </label>
          <label>Magic Armor Amp
            <input name="magical_armor_amplifier" type="number" step="0.05" value="${esc(readValue('magical_armor_amplifier', record) ?? 1.0)}">
          </label>
        </div>
        <div class="cardGrid2">
          <label>Healing Current HP
            <input name="healing_current_hp" type="number" min="0" value="${esc(readValue('healing_current_hp', record) || 0)}">
          </label>
          <label>Cure Effect Type
            <select name="cure_effect_type">
              ${cures.map((c) => `<option value="${c}" ${cureType === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🔥 Elemental Damage Ratings</span>
        </div>
        <div class="cardGrid4">
          ${elems.map(([key, label, colorClass]) => `
            <label><span class="resBadge ${colorClass}">${label}</span>
              <input name="${key}" type="number" min="0" value="${esc(readValue(key, record) || 0)}">
            </label>
          `).join('')}
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🗡️ Weapon Restriction</span>
        </div>
        <div id="skillModalWeaponTypes" class="cardGrid4">
          ${skillWeaponTypes.map((w) => `<label class="check"><input type="checkbox" class="skillWeaponTypeCheck" value="${w}" ${(relationData.skillWeaponTypes || []).includes(w) ? 'checked' : ''}> ${w === 'NONE' ? 'UNARMED (both hands empty)' : w === 'ANY_WEAPON' ? 'ANY WEAPON (not unarmed)' : w}</label>`).join('')}
        </div>
        <small class="muted">None checked = usable anytime, armed or unarmed (e.g. spells).</small>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">✨ Linked Status Effects</span>
          <button type="button" class="ghost" id="btnAddSkillEffect" style="padding:4px 10px; font-size:12px;">+ Add Effect</button>
        </div>
        <div id="skillModalEffectList" class="inlineRelationList">
          ${(relationData.skillEffects || []).map((ef) => `
            <div class="skillEffectRow">
              <select class="efSelect">${renderEffectOptions(ef.effect_id)}</select>
              <label>Turns: <input type="number" class="efDuration" min="1" placeholder="Turns" value="${ef.duration || 1}" style="width:65px;"></label>
              <label>Heal: <input type="number" class="efHealing" min="0" placeholder="HP" value="${ef.healing_current_hp || 0}" style="width:75px;"></label>
              <label class="check" title="Cure All Debuffs"><input type="checkbox" class="efCureAll" ${ef.is_cure_all ? 'checked' : ''}> All</label>
              <label class="check" title="Cure Poison"><input type="checkbox" class="efPoisonCure" ${ef.is_poison_cure ? 'checked' : ''}> Poison</label>
              <label class="check" title="Cure Stun"><input type="checkbox" class="efStunCure" ${ef.is_stun_cure ? 'checked' : ''}> Stun</label>
              <label class="check" title="Cure Daze"><input type="checkbox" class="efDazeCure" ${ef.is_daze_cure ? 'checked' : ''}> Daze</label>
              <label class="check" title="Cure Weak"><input type="checkbox" class="efWeakCure" ${ef.is_weak_cure ? 'checked' : ''}> Weak</label>
              <label class="check" title="Cure Blind"><input type="checkbox" class="efBlindCure" ${ef.is_blind_cure ? 'checked' : ''}> Blind</label>
              <button type="button" class="btn-remove-row" onclick="this.closest('.skillEffectRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
        <div id="skillModalNoEffects" class="empty" style="padding:15px; ${(relationData.skillEffects || []).length ? 'display:none;' : ''}">No effects applied on cast.</div>
      </div>
    </div>
  `;

  $('#btnAddSkillEffect').onclick = () => {
    $('#skillModalNoEffects').style.display = 'none';
    $('#skillModalEffectList').insertAdjacentHTML('beforeend', `
      <div class="skillEffectRow">
        <select class="efSelect">${renderEffectOptions('')}</select>
        <label>Turns: <input type="number" class="efDuration" min="1" placeholder="Turns" value="1" style="width:65px;"></label>
        <label>Heal: <input type="number" class="efHealing" min="0" placeholder="HP" value="0" style="width:75px;"></label>
        <label class="check" title="Cure All Debuffs"><input type="checkbox" class="efCureAll"> All</label>
        <label class="check" title="Cure Poison"><input type="checkbox" class="efPoisonCure"> Poison</label>
        <label class="check" title="Cure Stun"><input type="checkbox" class="efStunCure"> Stun</label>
        <label class="check" title="Cure Daze"><input type="checkbox" class="efDazeCure"> Daze</label>
        <label class="check" title="Cure Weak"><input type="checkbox" class="efWeakCure"> Weak</label>
        <label class="check" title="Cure Blind"><input type="checkbox" class="efBlindCure"> Blind</label>
        <button type="button" class="btn-remove-row" onclick="this.closest('.skillEffectRow').remove();">✕</button>
      </div>
    `);
  };
}

function renderLocationModal(record) {
  const isCreate = !state.editing;
  const locType = readValue('location_type', record) || 'VILLAGE';
  const isSafe = Boolean(readValue('is_safe_zone', record));

  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '📍 LOCATION';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Location${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Location' : 'Save Changes';

  $('#fields').className = 'modalBody';

  const locationTypes = ['VILLAGE', 'TOWN', 'CAPITAL', 'FORTRESS', 'STRONGHOLD', 'DANGER_FIELD', 'HUNTING_FIELD', 'DUNGEON'];

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📍 Location Properties & Safety</span>
        </div>
        <div class="cardGrid3">
          <label>Location Name
            <input name="name" type="text" placeholder="e.g. Riverwood Settlement" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Region
            <select name="region_id" required>
              ${renderRegionOptions(readValue('region_id', record))}
            </select>
          </label>
          <label>Location Type
            <select name="location_type">
              ${locationTypes.map((t) => `<option value="${t}" ${locType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="cardGrid2">
          <label class="switchLabel">
            <input name="is_safe_zone" type="checkbox" ${isSafe ? 'checked' : ''}>
            <span><b>🛡️ Safe Zone</b><small>Enables safe-zone vault storage and prevents hostile ambushes</small></span>
          </label>
        </div>
        <label class="full">Description
          <textarea name="description" placeholder="Description of the location...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📜 Local Lore & Culture</span>
        </div>
        <label class="full">Sub-geography
          <textarea name="subgeography" placeholder="Terrain, landmarks, climate...">${esc(readValue('subgeography', record))}</textarea>
        </label>
        <label class="full">Sub-politics
          <textarea name="subpolitics" placeholder="Local rulers, laws, factions...">${esc(readValue('subpolitics', record))}</textarea>
        </label>
        <label class="full">Sub-culture
          <textarea name="subculture" placeholder="Customs, beliefs, traditions...">${esc(readValue('subculture', record))}</textarea>
        </label>
      </div>
    </div>
  `;
}

function renderRegionModal(record) {
  const isCreate = !state.editing;
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '🌍 REGION';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Region${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Region' : 'Save Changes';

  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🌍 Region Overview</span>
        </div>
        <label class="full">Region Name
          <input name="name" type="text" placeholder="e.g. Northern Highlands" value="${esc(readValue('name', record))}" required>
        </label>
        <label class="full">Description
          <textarea name="description" placeholder="General overview of the region...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📜 World-Building & Lore</span>
        </div>
        <label class="full">Geography & Climate
          <textarea name="geography" placeholder="Mountain ranges, forests, weather patterns...">${esc(readValue('geography', record))}</textarea>
        </label>
        <label class="full">Politics & Governance
          <textarea name="politics" placeholder="Kingdoms, treaties, conflicts...">${esc(readValue('politics', record))}</textarea>
        </label>
        <label class="full">Culture & Society
          <textarea name="culture" placeholder="Demographics, religions, heritage...">${esc(readValue('culture', record))}</textarea>
        </label>
      </div>
    </div>
  `;
}

function renderEffectModal(record) {
  const isCreate = !state.editing;
  const efType = readValue('effect_type', record) || 'BUFF';
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '✨ EFFECT';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Effect${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Effect' : 'Save Changes';

  const effectTypes = ['NONE', 'BUFF', 'CURE', 'HEALING', 'RECOVERY', 'STUN', 'DAZE', 'WEAK', 'BLIND', 'POISON', 'HUNGRY', 'STARVING', 'STARVATION', 'THIRSTY', 'DEHYDRATED', 'SEVERE_DEHYDRATION'];

  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">✨ Status Effect Definition</span>
        </div>
        <div class="cardGrid2">
          <label>Effect Name
            <input name="name" type="text" placeholder="e.g. Burning Flame" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Effect Type
            <select name="effect_type">
              ${effectTypes.map((t) => `<option value="${t}" ${efType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="full">Description
          <textarea name="description" placeholder="Describe the gameplay and visual effect...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>
    </div>
  `;
}

function renderLifeskillModal(record) {
  const isCreate = !state.editing;
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '🛠️ LIFESKILL';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Lifeskill${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Lifeskill' : 'Save Changes';

  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🛠️ Lifeskill Definition</span>
        </div>
        <label class="full">Lifeskill Name
          <input name="name" type="text" placeholder="e.g. Blacksmithing, Alchemy, Mining" value="${esc(readValue('name', record))}" required>
        </label>
        <label class="full">Description
          <textarea name="description" placeholder="Describe this profession or gathering skill...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>
    </div>
  `;
}

function renderLootGroupModal(record) {
  const isCreate = !state.editing;
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '🎁 LOOT GROUP';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Loot Group${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Loot Group' : 'Save Changes';

  $('#fields').className = 'modalBody';

  const selectedMonsters = new Set(relationData.lootMonsters || []);
  const selectedLocations = new Set(relationData.lootLocations || []);

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🎁 Loot Group Details & Gold</span>
        </div>
        <div class="cardGrid4">
          <label>Loot Group Name
            <input name="name" type="text" placeholder="e.g. Goblin Hoard Drop" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Rarity
            <select name="loot_group_rarity">
              ${['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY', 'BOSS'].map((r) => `<option value="${r}" ${(readValue('loot_group_rarity', record) || 'COMMON') === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>
          <label>Minimum Gold Reward
            <input name="min_gold" type="number" min="0" value="${esc(readValue('min_gold', record) ?? 0)}">
          </label>
          <label>Maximum Gold Reward
            <input name="max_gold" type="number" min="0" value="${esc(readValue('max_gold', record) ?? 0)}">
          </label>
        </div>
        <label class="full">Description
          <textarea name="description" placeholder="Description of this drop pool...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📦 Droppable Items</span>
          <button type="button" class="ghost" id="btnAddModalLootItem" style="padding:4px 10px; font-size:12px;">+ Add Drop Item</button>
        </div>
        <div class="lootItemToolbar">
          <label class="lootSearchField">Filter Items
            <input id="modalLootItemSearch" type="search" placeholder="Search by name, ID, type...">
          </label>
          <label>Type
            <select id="modalLootItemType"><option value="">All types</option>${[...new Set((state.data.items || []).map((i) => i.type).filter(Boolean))].sort().map((t) => `<option value="${t}">${t}</option>`).join('')}</select>
          </label>
          <label>Rarity
            <select id="modalLootItemRarity"><option value="">All rarities</option>${[...new Set((state.data.items || []).map((i) => i.rarity).filter(Boolean))].sort().map((r) => `<option value="${r}">${r}</option>`).join('')}</select>
          </label>
          <small id="modalLootItemResultCount" class="muted"></small>
        </div>
        <div id="modalLootItemRows" class="inlineRelationList" style="max-height:260px;">
          ${(relationData.lootItems || []).map((item) => `
            <div class="lootItemRow">
              <label class="lootItemField lootItemChoice">Item<select class="lootItemSelect">${renderLootItemOptions(item.item_id)}</select></label>
              <label class="lootItemField">Chance (%)<input class="lootChance" type="number" min="0" max="100" step="0.01" value="${item.chance_pct ?? 0}"></label>
              <label class="lootItemField">Min Qty<input class="lootMin" type="number" min="1" value="${item.min_quantity ?? 1}"></label>
              <label class="lootItemField">Max Qty<input class="lootMax" type="number" min="1" value="${item.max_quantity ?? 1}"></label>
              <button type="button" class="btn-remove-row lootRemove" onclick="this.closest('.lootItemRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
        <div id="modalLootNoItems" class="empty" style="padding:15px; ${(relationData.lootItems || []).length ? 'display:none;' : ''}">No items linked to this drop group.</div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🐉 Assigned Monsters</span>
        </div>
        <div class="lootMonsterToolbar">
          <label>Filter Monsters
            <input id="modalLootMonsterSearch" type="search" placeholder="Search by monster name or ID...">
          </label>
          <small id="modalLootMonsterResultCount" class="muted"></small>
        </div>
        <div class="relationGrid" id="modalLootMonsterCards" style="max-height:220px;">
          ${(state.data.monsters || []).map((monster) => {
            const name = monster.npc?.character?.name || `Monster #${monster.character_id}`;
            const level = monster.npc?.character?.level || 1;
            const searchText = `${name} ${monster.character_id} ${level}`.toLowerCase();
            return `<label class="relationCard lootMonsterCard" data-search="${esc(searchText)}">
              <input class="lootMonsterCheck" type="checkbox" value="${monster.character_id}" ${selectedMonsters.has(monster.character_id) ? 'checked' : ''}>
              <span><b>${esc(name)}</b><small>Level ${level} · #${monster.character_id}</small></span>
            </label>`;
          }).join('') || '<div class="empty">No active monster characters available.</div>'}
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📍 Assigned Locations (Gathering / Zone Drops)</span>
        </div>
        <div class="relationGrid" id="modalLootLocationCards" style="max-height:180px;">
          ${(state.data.locations || []).map((loc) => {
            return `<label class="relationCard lootLocationCard">
              <input class="lootLocationCheck" type="checkbox" value="${loc.id}" ${selectedLocations.has(loc.id) ? 'checked' : ''}>
              <span><b>${esc(loc.name)}</b><small>ID #${loc.id} · ${esc(loc.location_type || 'VILLAGE')}</small></span>
              <span class="lootItemField">Drop chance (%)<input class="lootLocationChance" data-location-id="${loc.id}" type="number" min="0" max="100" step="0.01" value="${(relationData.lootLocationChances || {})[loc.id] ?? 100}"></span>
            </label>`;
          }).join('') || '<div class="empty">No locations available.</div>'}
        </div>
      </div>
    </div>
  `;

  const refreshModalLootOptions = () => {
    const filters = { search: $('#modalLootItemSearch')?.value || '', type: $('#modalLootItemType')?.value || '', rarity: $('#modalLootItemRarity')?.value || '' };
    document.querySelectorAll('#modalLootItemRows .lootItemSelect').forEach((select) => {
      const currentVal = select.value;
      select.innerHTML = renderLootItemOptions(currentVal, filters);
      select.value = currentVal;
    });
    const matchCount = (state.data.items || []).filter((i) => lootItemMatches(i, filters.search, filters.type, filters.rarity)).length;
    if ($('#modalLootItemResultCount')) $('#modalLootItemResultCount').textContent = `${matchCount} matching items`;
  };

  $('#btnAddModalLootItem').onclick = () => {
    $('#modalLootNoItems').style.display = 'none';
    $('#modalLootItemRows').insertAdjacentHTML('beforeend', `
      <div class="lootItemRow">
        <label class="lootItemField lootItemChoice">Item<select class="lootItemSelect">${renderLootItemOptions('', { search: $('#modalLootItemSearch')?.value || '', type: $('#modalLootItemType')?.value || '', rarity: $('#modalLootItemRarity')?.value || '' })}</select></label>
        <label class="lootItemField">Chance (%)<input class="lootChance" type="number" min="0" max="100" step="0.01" value="0"></label>
        <label class="lootItemField">Min Qty<input class="lootMin" type="number" min="1" value="1"></label>
        <label class="lootItemField">Max Qty<input class="lootMax" type="number" min="1" value="1"></label>
        <button type="button" class="btn-remove-row lootRemove" onclick="this.closest('.lootItemRow').remove();">✕</button>
      </div>
    `);
  };

  $('#modalLootItemSearch').oninput = refreshModalLootOptions;
  $('#modalLootItemType').onchange = refreshModalLootOptions;
  $('#modalLootItemRarity').onchange = refreshModalLootOptions;
  refreshModalLootOptions();

  $('#modalLootMonsterSearch').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    let c = 0;
    document.querySelectorAll('#modalLootMonsterCards .lootMonsterCard').forEach((card) => {
      const match = !q || card.dataset.search.includes(q);
      card.hidden = !match;
      if (match) c += 1;
    });
    if ($('#modalLootMonsterResultCount')) $('#modalLootMonsterResultCount').textContent = `${c} matching monsters`;
  };
}

function recipeIngredientRow(itemId = '', quantity = 1) {
  return `
    <div class="lootItemRow recipeIngredientRow">
      <label class="lootItemField lootItemChoice">Ingredient<select class="recipeIngredientSelect">${renderLootItemOptions(itemId)}</select></label>
      <label class="lootItemField">Quantity<input class="recipeIngredientQty" type="number" min="1" value="${esc(quantity ?? 1)}"></label>
      <button type="button" class="btn-remove-row" onclick="this.closest('.recipeIngredientRow').remove();">✕</button>
    </div>
  `;
}

function renderRecipeModal(record) {
  const isCreate = !state.editing;
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '📜 RECIPE';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Recipe${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Recipe' : 'Save Changes';

  $('#fields').className = 'modalBody';
  const value = (key, fallback) => {
    const current = readValue(key, record);
    return current === '' || current === null || current === undefined ? fallback : current;
  };
  const autoUnlocked = isCreate ? true : Boolean(record.is_auto_unlocked);

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📜 Recipe Details</span>
        </div>
        <div class="cardGrid3">
          <label>Recipe Name
            <input name="name" type="text" maxlength="50" placeholder="e.g. Grilled Fish Meat" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Life Skill
            <select name="lifeskill_id">
              <option value="">-- None --</option>
              ${(state.data.lifeskills || []).map((skill) => `<option value="${skill.id}" ${String(readValue('lifeskill_id', record)) === String(skill.id) ? 'selected' : ''}>${esc(skill.name)}</option>`).join('')}
            </select>
          </label>
          <label>Output Item
            <select name="output_item_id" required>${renderLootItemOptions(readValue('output_item_id', record))}</select>
          </label>
        </div>
        <div class="cardGrid4">
          <label>Min Output Qty
            <input name="output_quantity" type="number" min="1" value="${esc(value('output_quantity', 1))}">
          </label>
          <label>Max Output Qty
            <input name="max_output_quantity" type="number" min="1" value="${esc(value('max_output_quantity', 1))}">
          </label>
          <label>Required Level
            <input name="required_level" type="number" min="1" value="${esc(value('required_level', 1))}">
          </label>
          <label>EXP Reward
            <input name="exp_reward" type="number" min="0" value="${esc(value('exp_reward', 10))}">
          </label>
          <label>Energy Cost
            <input name="stamina_cost" type="number" min="0" value="${esc(value('stamina_cost', 1))}">
          </label>
          <label>Duration (seconds)
            <input name="duration_seconds" type="number" min="0" value="${esc(value('duration_seconds', 30))}">
          </label>
          <label>Success Rate (0 – 1)
            <input name="success_rate" type="number" min="0" max="1" step="0.01" value="${esc(value('success_rate', 1))}">
          </label>
          <label class="switchLabel">
            <input name="is_auto_unlocked" type="checkbox" ${autoUnlocked ? 'checked' : ''}>
            <span><b>Auto-unlocked</b><small>Available without learning</small></span>
          </label>
        </div>
        <label class="full">Description
          <textarea name="description" placeholder="What this recipe makes...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🧺 Ingredients</span>
          <button type="button" class="ghost" id="btnAddRecipeIngredient" style="padding:4px 10px; font-size:12px;">+ Add Ingredient</button>
        </div>
        <div id="modalRecipeIngredientRows" class="inlineRelationList" style="max-height:260px;">
          ${(relationData.recipeIngredients || []).map((item) => recipeIngredientRow(item.item_id, item.quantity)).join('')}
        </div>
        <div id="modalRecipeNoIngredients" class="empty" style="padding:15px; ${(relationData.recipeIngredients || []).length ? 'display:none;' : ''}">No ingredients. Add at least one ingredient.</div>
      </div>
    </div>
  `;

  $('#btnAddRecipeIngredient').onclick = () => {
    $('#modalRecipeNoIngredients').style.display = 'none';
    $('#modalRecipeIngredientRows').insertAdjacentHTML('beforeend', recipeIngredientRow());
  };
}

const questObjectiveTypes = ['COLLECT', 'ELIMINATE', 'CAPTURE'];

function questTargetName(quest) {
  if (quest?.objective_type === 'COLLECT') return quest.target_item?.name || (quest.target_item_id ? `Item #${quest.target_item_id}` : '—');
  return quest?.target_npc?.character?.name || (quest?.target_npc_character_id ? `NPC #${quest.target_npc_character_id}` : '—');
}

function questNpcOptions(selectedId, monstersFirst = false) {
  const monsterIds = new Set((state.data.monsters || []).map((monster) => Number(monster.character_id)));
  const npcs = (state.data.characters || [])
    .filter((character) => character.character_type === 'NPC' && !character.deleted && character.npc && character.npc.deleted !== true)
    .sort((a, b) => (monstersFirst ? Number(monsterIds.has(b.id)) - Number(monsterIds.has(a.id)) : 0) || (a.name || '').localeCompare(b.name || ''));
  return npcs.map((npc) => `<option value="${npc.id}" ${Number(selectedId) === Number(npc.id) ? 'selected' : ''}>${monsterIds.has(npc.id) ? '🐉' : '👤'} ${esc(npc.name || 'Unnamed')} (#${npc.id}, Lv ${npc.level ?? 1})</option>`).join('');
}

function renderQuestModal(record) {
  const isCreate = !state.editing;
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '📜 QUEST';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Quest${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Quest' : 'Save Changes';

  $('#fields').className = 'modalBody';
  const value = (key, fallback) => {
    const current = readValue(key, record);
    return current === '' || current === null || current === undefined ? fallback : current;
  };
  const objectiveType = value('objective_type', 'COLLECT');

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📜 Quest Details</span>
        </div>
        <div class="cardGrid3">
          <label>Quest Name
            <input name="name" type="text" maxlength="100" placeholder="e.g. Wolves at the Gate" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Quest Giver (NPC)
            <select name="source_npc_id" required>
              <option value="">-- Select NPC --</option>
              ${questNpcOptions(readValue('source_npc_id', record))}
            </select>
          </label>
          <label>Objective Type
            <select name="objective_type" id="questObjectiveType">
              ${questObjectiveTypes.map((t) => `<option value="${t}" ${objectiveType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="full">Description
          <textarea name="description" placeholder="What the quest giver asks for..." required>${esc(readValue('description', record))}</textarea>
        </label>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🎯 Objective</span>
        </div>
        <div class="cardGrid3">
          <label id="questTargetItemField" ${objectiveType === 'COLLECT' ? '' : 'hidden'}>Target Item
            <select name="target_item_id">${renderLootItemOptions(readValue('target_item_id', record))}</select>
          </label>
          <label id="questTargetNpcField" ${objectiveType === 'COLLECT' ? 'hidden' : ''}>Target NPC / Monster
            <select name="target_npc_character_id">
              <option value="">-- Select Target --</option>
              ${questNpcOptions(readValue('target_npc_character_id', record), true)}
            </select>
          </label>
          <label>Required Quantity
            <input name="required_quantity" type="number" min="1" value="${esc(value('required_quantity', 1))}">
          </label>
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">💰 Rewards</span>
        </div>
        <div class="cardGrid3">
          <label>Gold Reward
            <input name="gold_reward" type="number" min="0" value="${esc(value('gold_reward', 0))}">
          </label>
          <label>EXP Reward
            <input name="exp_reward" type="number" min="0" value="${esc(value('exp_reward', 0))}">
          </label>
          <label>Affinity Reward
            <input name="affinity_reward" type="number" min="-200" max="200" value="${esc(value('affinity_reward', 0))}">
          </label>
        </div>
        <div class="cardGrid3" style="margin-top: 10px;">
          <label class="switchLabel">
            <input name="repeatable" type="checkbox" ${readValue('repeatable', record) ? 'checked' : ''}>
            <span><b>Repeatable</b><small>Can be completed more than once</small></span>
          </label>
          <label class="switchLabel">
            <input name="is_nsfw" type="checkbox" ${readValue('is_nsfw', record) ? 'checked' : ''}>
            <span><b>NSFW</b><small>Hidden from players without NSFW access</small></span>
          </label>
        </div>
      </div>
    </div>
  `;

  $('#questObjectiveType').onchange = (e) => {
    const isCollect = e.target.value === 'COLLECT';
    $('#questTargetItemField').hidden = !isCollect;
    $('#questTargetNpcField').hidden = isCollect;
  };
}

function renderSublocationItemOptions(selectedItemId) {
  const items = (state.data.items || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  let html = '<option value="">-- Select Item --</option>';
  items.forEach((item) => {
    const sel = Number(item.id) === Number(selectedItemId);
    html += `<option value="${item.id}" ${sel ? 'selected' : ''}>${esc(item.name)} (${esc(item.type)}, 💰${Number(item.price || 0).toLocaleString()})</option>`;
  });
  return html;
}

function renderSublocationModal(record) {
  const isCreate = !state.editing;
  const subType = readValue('sublocation_type', record) || 'DEFAULT';
  const servicePriceValue = (key) => {
    const value = readValue(key, record);
    return value === '' || value === null || value === undefined || (subType !== 'INN' && Number(value) === 0) ? 350 : value;
  };

  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '🏠 SUBLOCATION';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} SubLocation${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create SubLocation' : 'Save Changes';

  $('#fields').className = 'modalBody';

  const subTypes = ['DEFAULT', 'SECRET_HIDEOUT', 'HOUSE', 'CASTLE', 'MANSION', 'GUILD_OFFICE', 'ALLEY', 'SQUARE', 'INN', 'SHOP'];
  const isShopOrInn = subType === 'INN' || subType === 'SHOP';

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🏠 SubLocation Details</span>
        </div>
        <div class="cardGrid3">
          <label>SubLocation Name
            <input name="name" type="text" placeholder="e.g. The Prancing Pony" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Location
            <select name="location_id" required>
              ${renderLocationOptions(readValue('location_id', record))}
            </select>
          </label>
          <label>SubLocation Type
            <select name="sublocation_type" id="sublocationTypeSelect">
              ${subTypes.map((t) => `<option value="${t}" ${subType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          <label>Owner character
            <select name="owner_id">${renderCharacterOptions(readValue('owner_id', record))}</select>
          </label>
        </div>
        <label class="full">Description (max 200 chars)
          <textarea name="description" maxlength="200" placeholder="Description of this sublocation...">${esc(readValue('description', record))}</textarea>
        </label>
      </div>

      <div class="cardSection" id="sublocationItemsSection" style="${isShopOrInn ? '' : 'display:none;'}">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🛍️ Shop / Inn Inventory Items</span>
          <button type="button" class="ghost" id="btnAddSublocationItem" style="padding:4px 10px; font-size:12px;">+ Add Item</button>
        </div>
        <div id="modalSublocationItemRows" class="inlineRelationList" style="max-height:260px;">
          ${(relationData.sublocationItems || []).map((item) => `
            <div class="sublocationItemRow" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <label style="flex:1; margin-bottom:0;">
                <select class="sublocationItemSelect" style="width:100%;">${renderSublocationItemOptions(item.item_id)}</select>
              </label>
              <button type="button" class="btn-remove-row" onclick="this.closest('.sublocationItemRow').remove();">✕</button>
            </div>
          `).join('')}
        </div>
        <div id="modalSublocationNoItems" class="empty" style="padding:15px; ${(relationData.sublocationItems || []).length ? 'display:none;' : ''}">No items configured for this shop/inn.</div>
      </div>
      <div class="cardSection" id="sublocationInnServices" style="${subType === 'INN' ? '' : 'display:none;'}">
        <div class="cardSectionHeader"><span class="cardSectionTitle">Inn Service Prices</span></div>
        <div class="cardGrid3">
          <label>Long rest base price<input name="long_rest_price" type="number" min="0" step="1" value="${esc(servicePriceValue('long_rest_price'))}"></label>
          <label>Food and water refill base price<input name="food_water_refill_price" type="number" min="0" step="1" value="${esc(servicePriceValue('food_water_refill_price'))}"></label>
        </div>
      </div>
    </div>
  `;

  $('#sublocationTypeSelect').onchange = (e) => {
    const val = e.target.value;
    const isNowShopOrInn = val === 'INN' || val === 'SHOP';
    $('#sublocationItemsSection').style.display = isNowShopOrInn ? '' : 'none';
    $('#sublocationInnServices').style.display = val === 'INN' ? '' : 'none';
  };

  $('#btnAddSublocationItem').onclick = () => {
    $('#modalSublocationNoItems').style.display = 'none';
    $('#modalSublocationItemRows').insertAdjacentHTML('beforeend', `
      <div class="sublocationItemRow" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <label style="flex:1; margin-bottom:0;">
          <select class="sublocationItemSelect" style="width:100%;">${renderSublocationItemOptions('')}</select>
        </label>
        <button type="button" class="btn-remove-row" onclick="this.closest('.sublocationItemRow').remove();">✕</button>
      </div>
    `);
  };
}

function renderUserModal(record) {
  const isCreate = !state.editing;
  const isAdmin = Boolean(readValue('is_admin', record));
  const isDeleted = Boolean(readValue('deleted', record));

  $('#formBadge').className = `badge ${isAdmin ? 'badge-role-admin' : 'badge-role-user'}`;
  $('#formBadge').textContent = isAdmin ? '👑 ADMIN' : '👤 USER';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} User Account${record.username ? `: ${record.username}` : ''}`;
  $('#save').textContent = isCreate ? 'Create User' : 'Save Changes';

  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">👤 Account Credentials</span>
        </div>
        <div class="cardGrid2">
          <label>Username
            <input name="username" type="text" maxlength="40" placeholder="e.g. heroic_adventurer" value="${esc(readValue('username', record))}" required>
          </label>
          <label>Password
            <input name="password" type="password" maxlength="60" placeholder="${isCreate ? 'Required for new user' : 'Leave blank to keep unchanged'}" ${isCreate ? 'required' : ''}>
          </label>
        </div>
        <div class="cardGrid2" style="margin-top:12px;">
          <label class="switchLabel">
            <input name="is_admin" type="checkbox" ${isAdmin ? 'checked' : ''}>
            <span><b>Administrator Privileges</b><small>Access to admin console and database management</small></span>
          </label>
          <label class="switchLabel">
            <input name="user_active" type="checkbox" ${!isDeleted ? 'checked' : ''}>
            <span><b>Account Active (Not Soft-Deleted)</b><small>Uncheck to disable/soft-delete this account</small></span>
          </label>
        </div>
      </div>
      ${!isCreate ? `
        <div class="cardSection">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">📊 Account Overview & Characters</span>
          </div>
          <div class="cardGrid3" style="font-size:12px; margin-bottom:10px;">
            <div><b>User UUID:</b> <span class="muted" style="word-break:break-all;">${esc(record.user_id || record.id)}</span></div>
            <div><b>Registered:</b> <span class="muted">${record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}</span></div>
            <div><b>Status:</b> ${isDeleted ? '<span class="pill-tag pill-danger">Soft-deleted</span>' : '<span class="pill-tag pill-safe">Active</span>'}</div>
          </div>
          ${record.character ? `
            <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">Linked Character</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge badge-player">👤 ${esc(record.character.name || 'Unnamed')}</span>
              <span class="pill-tag">Level ${record.character.level || 1}</span>
              <span class="pill-tag">${esc(record.character.job || 'Adventurer')}</span>
              <small class="muted">#${record.character.id}</small>
            </div>
          ` : '<div class="muted" style="font-size:12px;">No characters linked to this user.</div>'}
        </div>
      ` : ''}
    </div>
  `;
}

function renderAffixModal(record, affixType) {
  const isCreate = !state.editing;
  const isPrefix = affixType === 'PREFIX';
  const rarity = readValue('rarity', record) || 'NORMAL';
  const tier = readValue('tier', record) || 'TIER_1';
  const rClass = rarity.toLowerCase();

  $('#formBadge').className = `badge badge-rarity-${rClass}`;
  $('#formBadge').textContent = `${rarity} · ${tier.replace('_', ' ')} ${affixType}`;
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} ${isPrefix ? 'Prefix' : 'Suffix'}${record.name ? `: ${record.name}` : ''}`;
  $('#save').textContent = isCreate ? `Create ${isPrefix ? 'Prefix' : 'Suffix'}` : 'Save Changes';

  $('#fields').className = 'modalBody';

  const rarities = ['NORMAL', 'UNCOMMON', 'RARE', 'UNIQUE', 'MYSTIC', 'LEGENDARY', 'ANCIENT'];
  const tiers = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'];

  const attrStats = [
    ['max_hp_bonus', 'Max HP Bonus'],
    ['proficiency_bonus', 'Proficiency Bonus'],
    ['strength_bonus', 'Strength (STR) Bonus'],
    ['dexterity_bonus', 'Dexterity (DEX) Bonus'],
    ['intelligent_bonus', 'Intelligence (INT) Bonus'],
    ['constitution_bonus', 'Constitution (CON) Bonus'],
    ['wisdom_bonus', 'Wisdom (WIS) Bonus'],
    ['charisma_bonus', 'Charisma (CHA) Bonus']
  ];

  const combatStats = [
    ['physical_attack_bonus', 'Phys Attack Bonus'],
    ['magical_attack_bonus', 'Magic Attack Bonus'],
    ['armor_bonus', 'Armor Bonus'],
    ['magical_armor_bonus', 'Magic Armor Bonus'],
    ['effect_resistant_bonus', 'Effect Resist Bonus'],
    ['crit_chance', 'Crit Chance (%)', '0.1'],
    ['crit_damage', 'Crit Damage (%)', '0.1']
  ];

  const elemStats = [
    ['fire_element_resistant', 'Fire Resist', 'res-fire'],
    ['ice_element_resistant', 'Ice Resist', 'res-ice'],
    ['earth_element_resistant', 'Earth Resist', 'res-earth'],
    ['lightning_element_resistant', 'Lightning Resist', 'res-lightning'],
    ['wind_element_resistant', 'Wind Resist', 'res-wind'],
    ['holy_element_resistant', 'Holy Resist', 'res-holy'],
    ['dark_element_resistant', 'Dark Resist', 'res-dark']
  ];

  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">${isPrefix ? '🏷️ Prefix' : '🏷️ Suffix'} Identity & Quality</span>
        </div>
        <div class="cardGrid3">
          <label>${isPrefix ? 'Prefix' : 'Suffix'} Name
            <input name="name" type="text" maxlength="30" placeholder="${isPrefix ? 'e.g. Blazing' : 'e.g. of the Wolf'}" value="${esc(readValue('name', record))}" required>
          </label>
          <label>Rarity Quality
            <select name="rarity">
              ${rarities.map((r) => `<option value="${r}" ${rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>
          <label>Power Tier
            <select name="tier">
              ${tiers.map((t) => `<option value="${t}" ${tier === t ? 'selected' : ''}>${t.replace('_', ' ')}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🛡️ Core Attributes & Vital Bonuses</span>
        </div>
        <div class="cardGrid3">
          ${attrStats.map(([key, label]) => `
            <label>${label}
              <input name="${key}" type="number" value="${esc(readValue(key, record) ?? 0)}">
            </label>
          `).join('')}
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">⚔️ Combat Scaling & Critical Multipliers</span>
        </div>
        <div class="cardGrid4">
          ${combatStats.map(([key, label, step]) => `
            <label>${label}
              <input name="${key}" type="number" ${step ? `step="${step}"` : ''} value="${esc(readValue(key, record) ?? 0)}">
            </label>
          `).join('')}
        </div>
      </div>

      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">🔥 Elemental Resistances</span>
        </div>
        <div class="cardGrid4">
          ${elemStats.map(([key, label, colorClass]) => `
            <label><span class="resBadge ${colorClass}">${label}</span>
              <input name="${key}" type="number" value="${esc(readValue(key, record) ?? 0)}">
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

const ambienceTimeSlots = ['ANY', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
const ambienceWeathers = ['CLEAR', 'SUNNY', 'RAIN', 'HEAVYRAIN', 'STORM', 'FOG'];
const ambienceCrowdLevels = ['EMPTY', 'FEW', 'SOME', 'BUSY', 'PACKED'];

function ambienceFigureRowHtml(figure = {}) {
  return `
    <div class="lootItemRow">
      <label class="lootItemField lootItemChoice">Figure<input class="ambienceFigureLabel" type="text" maxlength="120" placeholder="e.g. a group of mercenaries" value="${esc(figure.label || '')}"></label>
      <label class="lootItemField">Weight<input class="ambienceFigureWeight" type="number" min="1" max="1000" value="${figure.weight ?? 10}"></label>
      <button type="button" class="btn-remove-row lootRemove" title="Remove figure" onclick="this.closest('.lootItemRow').remove();">✕</button>
    </div>`;
}

function renderAmbienceModal(record) {
  const isCreate = !state.editing;
  const locationId = readValue('location_id', record);
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '🌆 AMBIENCE';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Ambience${record.title ? `: ${record.title}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Ambience' : 'Save Changes';

  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📍 Place & Conditions</span>
        </div>
        <div class="cardGrid2">
          <label>Location
            <select name="location_id" id="ambienceLocationSelect" required>${renderLocationOptions(locationId)}</select>
          </label>
          <label>SubLocation (empty = outdoors / main area)
            <select name="sublocation_id" id="ambienceSublocationSelect">${renderSublocationOptions(readValue('sublocation_id', record), locationId || -1)}</select>
          </label>
          <label>Time of day
            <select name="time_slot">${ambienceTimeSlots.map((t) => `<option value="${t}" ${(readValue('time_slot', record) || 'ANY') === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </label>
          <label>Weather
            <select name="weather"><option value="">ANY WEATHER</option>${ambienceWeathers.map((w) => `<option value="${w}" ${readValue('weather', record) === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
          </label>
          <label>Crowd level
            <select name="crowd_level">${ambienceCrowdLevels.map((c) => `<option value="${c}" ${(readValue('crowd_level', record) || 'SOME') === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </label>
          <label>Weight (chance vs. other matching ambiences)
            <input name="weight" type="number" min="0" max="1000" value="${record.weight ?? 10}">
          </label>
        </div>
        <label class="switchLabel">
          <input type="checkbox" name="is_active" ${record.is_active === false ? '' : 'checked'}>
          <span><b>Active</b><small>Inactive ambiences are never rolled</small></span>
        </label>
      </div>
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📝 Scene</span>
        </div>
        <label class="full">Title (admin only)
          <input name="title" type="text" maxlength="120" required placeholder="e.g. Morning rush at the job board" value="${esc(readValue('title', record))}">
        </label>
        <label class="full">Scene description (sent to the AI DM and used in the time-change notice)
          <textarea name="description" required placeholder="Short and evocative, e.g. Adventurers crowd the job board while the clerk shouts names over the noise.">${esc(readValue('description', record))}</textarea>
        </label>
      </div>
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">👥 Background Figures (non-canonical)</span>
          <button type="button" class="ghost" id="btnAddAmbienceFigure" style="padding:4px 10px; font-size:12px;">+ Add Figure</button>
        </div>
        <div class="cardGrid2">
          <label>Minimum figures shown
            <input name="min_figures" type="number" min="0" max="10" value="${record.min_figures ?? 1}">
          </label>
          <label>Maximum figures shown
            <input name="max_figures" type="number" min="0" max="10" value="${record.max_figures ?? 3}">
          </label>
        </div>
        <small class="muted">Higher weight = more common. Use weight 1 for rare figures (e.g. a high priest from the capital).</small>
        <div id="ambienceFigureRows" class="inlineRelationList" style="max-height:260px;">
          ${(record.figures || []).map((figure) => ambienceFigureRowHtml(figure)).join('')}
        </div>
      </div>
    </div>
  `;

  $('#btnAddAmbienceFigure').onclick = () => $('#ambienceFigureRows').insertAdjacentHTML('beforeend', ambienceFigureRowHtml());
  $('#ambienceLocationSelect').onchange = (event) => {
    $('#ambienceSublocationSelect').innerHTML = renderSublocationOptions(null, event.target.value || -1);
  };
}

function renderStoryModal(record) {
  const isCreate = !state.editing;
  $('#formBadge').className = 'badge';
  $('#formBadge').textContent = '📖 STORY';
  $('#modalTabs').hidden = true;
  $('#formTitle').textContent = `${isCreate ? 'Create' : 'Edit'} Story Narrative${record.character?.name ? `: ${record.character.name}` : ''}`;
  $('#save').textContent = isCreate ? 'Create Story' : 'Save Changes';

  $('#fields').className = 'modalBody';
  $('#fields').innerHTML = `
    <div class="tabPanel">
      <div class="cardSection">
        <div class="cardSectionHeader">
          <span class="cardSectionTitle">📖 Story Narrative & Linkage</span>
        </div>
        <div class="cardGrid2">
          <label>Target Character
            <select name="character_id" id="storyCharSelect" required ${!isCreate ? 'disabled' : ''}>
              ${renderCharacterOptions(readValue('character_id', record))}
            </select>
            ${!isCreate ? `<input type="hidden" name="character_id" value="${record.character_id}">` : ''}
          </label>
          <label>Linked User ID (UUID)
            <input name="user_id" id="storyUserIdInput" type="text" placeholder="UUID of owner" value="${esc(readValue('user_id', record))}" ${!isCreate ? 'readonly' : ''}>
          </label>
        </div>
        <label class="full">Latest Player Action Prompt
          <textarea name="action_from_player" placeholder="Player's latest action prompt (e.g. 'I enter the dungeon and inspect the chest.')...">${esc(readValue('action_from_player', record))}</textarea>
        </label>
        <label class="full">Story Narrative (AI DM Output)
          <textarea name="story" style="min-height:160px;" placeholder="Full narrative or story log generated by AI..." required>${esc(readValue('story', record))}</textarea>
        </label>
      </div>
      ${!isCreate ? `
        <div class="cardSection">
          <div class="cardSectionHeader">
            <span class="cardSectionTitle">⏱️ Story Timestamps</span>
          </div>
          <div class="cardGrid2" style="font-size:12px;">
            <div><b>Created At:</b> <span class="muted">${record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}</span></div>
            <div><b>Last Updated:</b> <span class="muted">${record.updated_at ? new Date(record.updated_at).toLocaleString() : 'N/A'}</span></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  if (isCreate) {
    const charSelect = $('#storyCharSelect');
    if (charSelect) {
      charSelect.onchange = () => {
        const charId = Number(charSelect.value);
        const char = (state.data.characters || []).find((c) => c.id === charId);
        if (char && char.user_id) {
          const userInp = $('#storyUserIdInput');
          if (userInp) userInp.value = char.user_id;
        }
      };
    }
  }
}

function openEditor(id = null, createType = null) {
  state.editing = id;
  const record = id ? (state.data[state.model] || []).find((item) => item.id === id) : { character_type: createType || 'PLAYER' };
  initRelationData(record);

  if (state.model === 'characters') {
    renderCharacterModal(record, createType);
  } else if (state.model === 'items') {
    renderItemModal(record);
  } else if (state.model === 'skills') {
    renderSkillModal(record);
  } else if (state.model === 'locations') {
    renderLocationModal(record);
  } else if (state.model === 'regions') {
    renderRegionModal(record);
  } else if (state.model === 'effects') {
    renderEffectModal(record);
  } else if (state.model === 'lifeskills') {
    renderLifeskillModal(record);
  } else if (state.model === 'loot_groups') {
    renderLootGroupModal(record);
  } else if (state.model === 'crafting_recipes') {
    renderRecipeModal(record);
  } else if (state.model === 'quests') {
    renderQuestModal(record);
  } else if (state.model === 'sublocations') {
    renderSublocationModal(record);
  } else if (state.model === 'users') {
    renderUserModal(record);
  } else if (state.model === 'prefixes') {
    renderAffixModal(record, 'PREFIX');
  } else if (state.model === 'suffixes') {
    renderAffixModal(record, 'SUFFIX');
  } else if (state.model === 'stories') {
    renderStoryModal(record);
  } else if (state.model === 'ambiences') {
    renderAmbienceModal(record);
  } else if (state.model === 'character_scenes') {
    renderSceneModal(record);
  } else {
    // Standard fallback (e.g. unexpected model)
    $('#formBadge').className = '';
    $('#formBadge').textContent = '';
    $('#modalTabs').hidden = true;
    $('#formTitle').textContent = `${id ? 'Edit' : 'Create'} ${models[state.model]?.label?.slice(0, -1) || 'Record'}`;
    $('#save').textContent = id ? 'Save Changes' : 'Create';

    $('#fields').className = 'fields';
    $('#fields').innerHTML = (models[state.model]?.fields || []).map(([key, label, type, layout]) => {
      const full = layout === 'full' || type === 'textarea';
      let input;
      if (type?.startsWith('select:')) {
        const options = type.slice(7).split(',');
        input = `<select name="${key}">${options.map((val) => `<option ${readValue(key, record) === val ? 'selected' : ''}>${val}</option>`).join('')}</select>`;
      } else if (type === 'textarea') {
        input = `<textarea name="${key}">${esc(readValue(key, record))}</textarea>`;
      } else if (type === 'checkbox') {
        input = `<input name="${key}" type="checkbox" ${readValue(key, record) ? 'checked' : ''}>`;
      } else {
        input = `<input name="${key}" type="${type}" value="${esc(readValue(key, record))}">`;
      }
      return `<label class="${full ? 'full' : ''}">${label}${input}</label>`;
    }).join('');
  }

  $('#editor').showModal();
  const avatarFile = $('#characterAvatarFile');
  const avatarData = $('#characterImageData');
  const avatarPreview = $('#characterAvatarPreview');
  if (avatarFile) avatarFile._readPromise = Promise.resolve();
  avatarFile?.addEventListener('change', () => {
    const file = avatarFile.files?.[0];
    if (!file) { avatarFile._readPromise = Promise.resolve(); return; }
    avatarFile._readPromise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { avatarData.value = reader.result; avatarPreview.src = reader.result; avatarPreview.hidden = false; resolve(); };
      reader.onerror = () => reject(new Error('Unable to read that avatar image.'));
      reader.readAsDataURL(file);
    });
    avatarFile._readPromise.catch(() => {});
  });
}

function formDataEnhanced() {
  const output = {};
  const stats = {};
  const effect = {};

  if (state.model === 'characters') {
    // 1. Gather Basic Identity & Stats from active inputs
    new FormData($('#editorForm')).forEach((value, key) => {
      const element = document.querySelector(`[name="${key}"]`);
      if (key.startsWith('stats.')) {
        stats[key.slice(6)] = value;
      } else if (key.startsWith('eq_')) {
        // Equipment handled separately below
      } else if (element?.type === 'checkbox') {
        output[key] = element.checked;
      } else {
        output[key] = value;
      }
    });
    delete output.avatar_file;

    statFields.forEach((field) => {
      if (state.editing && stats[field] === '') delete stats[field];
    });
    if (Object.keys(stats).length) output.stats = stats;

    const type = output.character_type || 'PLAYER';
    const isMon = type !== 'PLAYER' && Boolean($('#toggleMonsterCheck')?.checked);
    if (type === 'PLAYER') {
      output.verified = Boolean($('[name="verified"]')?.checked);
      output.is_nsfw = Boolean($('[name="is_nsfw"]')?.checked);
      output.user_id = $('[name="user_id"]')?.value || null;
      const goldVal = $('[name="gold"]')?.value;
      output.gold = goldVal !== '' && goldVal !== undefined ? Number(goldVal) : (state.editing ? undefined : 1000);
      const pointVal = $('[name="current_point_spend"]')?.value;
      output.current_point_spend = pointVal !== '' && pointVal !== undefined ? Number(pointVal) : (state.editing ? undefined : 45);
    } else {
      output.npc = {
        is_attackable: Boolean($('[name="npc_is_attackable"]')?.checked),
        is_speakable: Boolean($('[name="npc_is_speakable"]')?.checked),
        is_recruitable: Boolean($('[name="npc_is_recruitable"]')?.checked),
        ...(isMon ? { npc_monster: { experience_reward: Number($('[name="experience_reward"]')?.value || 0) } } : {})
      };
    }

    delete output.npc_is_attackable;
    delete output.npc_is_speakable;
    delete output.npc_is_recruitable;
    delete output.is_monster;
    delete output.experience_reward;

    // 2. Gather Inventory (bag + equipped items)
    const invRows = document.querySelectorAll('#invListRows .invRow');
    if (invRows.length > 0 || $('#invMaxSlots')) {
      const max_slots = Number($('#invMaxSlots')?.value || 40);
      const items = [...invRows].map((row) => ({
        id: row.dataset.rowId ? Number(row.dataset.rowId) : null,
        item_id: Number(row.querySelector('.invItemSelect')?.value),
        quantity: Number(row.querySelector('.invQty')?.value || 1),
        current_level_upgraded: Number(row.querySelector('.invLevel')?.value || 0),
        prefix_id: row.querySelector('.invPrefix')?.value ? Number(row.querySelector('.invPrefix').value) : null,
        suffix_id: row.querySelector('.invSuffix')?.value ? Number(row.querySelector('.invSuffix').value) : null,
        equip_slot: row.querySelector('.invSlot')?.value || null
      })).filter((i) => i.item_id);
      const usedSlots = items.map((i) => i.equip_slot).filter(Boolean);
      const duplicateSlot = usedSlots.find((slot, index) => usedSlots.indexOf(slot) !== index);
      if (duplicateSlot) throw new Error(`Only one item can be equipped in slot ${duplicateSlot}.`);
      output.inventory = { max_slots, items, includes_equipped: true };
      delete output.equipment;
    } else {
      if (relationData.inventory) output.inventory = relationData.inventory;
      if (relationData.equipment) output.equipment = relationData.equipment;
    }

    // 3b. Gather Vault (only for PLAYER characters)
    if (type === 'PLAYER') {
      const vaultRows = document.querySelectorAll('#vaultListRows .vaultRow');
      if (vaultRows.length > 0 || $('#vaultMaxSlots')) {
        const max_slots = Number($('#vaultMaxSlots')?.value || 60);
        const tier = Number($('#vaultTier')?.value || 1);
        const stored_gold = Number($('#vaultGold')?.value || 0);
        const items = [...vaultRows].map((row) => ({
          item_id: Number(row.querySelector('.vaultItemSelect')?.value),
          quantity: Number(row.querySelector('.vaultQty')?.value || 1)
        })).filter((i) => i.item_id);
        output.vault = { max_slots, tier, stored_gold, items };
      } else if (relationData.vault) {
        output.vault = relationData.vault;
      }
    }

    // 4. Gather Skills
    const skillChecks = document.querySelectorAll('#skillGridCards .skillCheckInput:checked');
    if (skillChecks.length > 0 || document.querySelector('#skillGridCards')) {
      output.skills = [...skillChecks].map((chk) => Number(chk.value));
    } else if (relationData.skills) {
      output.skills = relationData.skills;
    }

    // 5. Gather Spellpoints
    const spRows = document.querySelectorAll('#spGridRows .spRow');
    if (spRows.length > 0 || document.querySelector('#spGridRows')) {
      output.spellpoints = [...spRows].map((row) => ({
        level: Number(row.querySelector('.spLevel')?.value || 1),
        max_current: Number(row.querySelector('.spMax')?.value || 0),
        current: Number(row.querySelector('.spCur')?.value || 0)
      })).filter((s) => s.level);
    } else if (relationData.spellpoints) {
      output.spellpoints = relationData.spellpoints;
    }

    // 6. Gather Lifeskills
    const lsRows = document.querySelectorAll('#lifeskillRowsWrap .multiItemRow');
    if (lsRows.length > 0 || document.querySelector('#lifeskillRowsWrap')) {
      output.lifeskills = [...lsRows].map((row) => ({
        lifeskill_id: Number(row.querySelector('.lsSelect')?.value),
        current_level: Number(row.querySelector('.lsLevel')?.value || 1),
        current_exp: Number(row.querySelector('.lsExp')?.value || 0)
      })).filter((l) => l.lifeskill_id);
    } else if (relationData.lifeskills) {
      output.lifeskills = relationData.lifeskills;
    }

    // 7. Gather Effects
    const efRows = document.querySelectorAll('#effectRowsWrap .effectItemRow');
    if (efRows.length > 0 || document.querySelector('#effectRowsWrap')) {
      output.effects = [...efRows].map((row) => ({
        effect_id: Number(row.querySelector('.efSelect')?.value),
        duration_turn: Number(row.querySelector('.efDuration')?.value || 0)
      })).filter((e) => e.effect_id);
    } else if (relationData.effects) {
      output.effects = relationData.effects;
    }

    const relationshipRows = document.querySelectorAll('#playerNpcRelationRows .playerNpcRelationRow');
    if (type === 'PLAYER') {
      output.player_npc_relationships = [...relationshipRows].map((row) => ({
        npc_character_id: Number(row.querySelector('.relationTargetSelect')?.value),
        affinity: Number(row.querySelector('.relationAffinity')?.value || 0),
        status: row.querySelector('.relationStatus')?.value || 'NEUTRAL',
        is_player_name_revealed: Boolean(row.querySelector('.relationNameRevealed')?.checked),
        interaction_notes: row.querySelector('.relationNotes')?.value?.trim() || null
      })).filter((relation) => relation.npc_character_id);
    } else if (!isMon) {
      output.player_npc_relationships = [...relationshipRows].map((row) => ({
        player_character_id: Number(row.querySelector('.relationTargetSelect')?.value),
        affinity: Number(row.querySelector('.relationAffinity')?.value || 0),
        status: row.querySelector('.relationStatus')?.value || 'NEUTRAL',
        is_player_name_revealed: Boolean(row.querySelector('.relationNameRevealed')?.checked),
        interaction_notes: row.querySelector('.relationNotes')?.value?.trim() || null
      })).filter((relation) => relation.player_character_id);

      const npcRelationRows = document.querySelectorAll('#npcRelationRows .npcRelationRow');
      output.npc_relationships = [...npcRelationRows].map((row) => ({
        target_npc_id: Number(row.querySelector('.npcRelationTarget')?.value),
        relationship_type: row.querySelector('.npcRelationType')?.value || 'ACQUAINTANCE',
        context_note: row.querySelector('.npcRelationNote')?.value?.trim() || null,
        is_nsfw: Boolean(row.querySelector('.npcRelationNsfw')?.checked)
      })).filter((relation) => relation.target_npc_id);

      const knownLocationRows = document.querySelectorAll('#npcKnownLocationRows .npcKnownLocationRow');
      output.npc_known_locations = [...knownLocationRows].map((row) => ({
        location_id: row.querySelector('.knownLocationSelect')?.value ? Number(row.querySelector('.knownLocationSelect').value) : null,
        sublocation_id: row.querySelector('.knownSublocationSelect')?.value ? Number(row.querySelector('.knownSublocationSelect').value) : null,
        location_knowledge_type: row.querySelector('.knownLocationType')?.value || 'LOCAL_LANDMARK',
        location_semantic_memory: row.querySelector('.knownLocationNote')?.value?.trim() || null
      })).filter((relation) => relation.location_id || relation.sublocation_id);

      const appearanceRows = document.querySelectorAll('#npcAppearanceRows .npcAppearanceRow');
      output.npc_appearances = [...appearanceRows].map((row) => ({
        location_id: row.querySelector('.appearanceLocationSelect')?.value ? Number(row.querySelector('.appearanceLocationSelect').value) : null,
        sublocation_id: row.querySelector('.appearanceSublocationSelect')?.value ? Number(row.querySelector('.appearanceSublocationSelect').value) : null
      })).filter((appearance) => (appearance.location_id && !appearance.sublocation_id) || (!appearance.location_id && appearance.sublocation_id));
    }

    // 8. Gather Memories
    const memRows = document.querySelectorAll('#memoryRowsWrap .memoryItemCard');
    if (memRows.length > 0 || document.querySelector('#memoryRowsWrap')) {
      output.memories = [...memRows].map((row) => ({
        content: row.querySelector('.memText')?.value?.trim() || '',
        memory_type: row.querySelector('.memType')?.value || 'SEMANTIC',
        target_character_id: row.querySelector('.memTarget')?.value ? Number(row.querySelector('.memTarget').value) : null,
        is_secret: Boolean(row.querySelector('.memSecret')?.checked),
      is_nsfw: Boolean(row.querySelector('.memNsfw')?.checked)
      })).filter((memory) => memory.content);
    } else if (relationData.memories) {
      output.memories = relationData.memories;
    }

    // Normalize IDs & types for character
    output.location_id = output.location_id ? Number(output.location_id) : null;
    output.sublocation_id = output.sublocation_id ? Number(output.sublocation_id) : null;
    output.respawn_location_id = output.respawn_location_id ? Number(output.respawn_location_id) : 1;
    output.level = output.level ? Number(output.level) : 1;
    output.current_exp = output.current_exp ? Number(output.current_exp) : 0;
    output.age = output.age ? Number(output.age) : null;
    output.is_updated_by_user = Boolean(document.querySelector('[name="is_updated_by_user"]')?.checked);

    return output;
  }

  // Generic models handling
  new FormData($('#editorForm')).forEach((value, key) => {
    const element = document.querySelector(`[name="${key}"]`);
    if (key.startsWith('effect.')) effect[key.slice(7)] = value;
    else if (element?.type === 'checkbox') output[key] = element.checked;
    else output[key] = value;
  });

  if (state.model === 'users') {
    output.username = document.querySelector('[name="username"]')?.value?.trim();
    const pw = document.querySelector('[name="password"]')?.value;
    if (pw) output.password = pw;
    output.is_admin = Boolean(document.querySelector('[name="is_admin"]')?.checked);
    const activeCheck = document.querySelector('[name="user_active"]');
    if (activeCheck) {
      output.deleted = !activeCheck.checked;
    }
  }

  if (state.model === 'items') {
    const itemEfRows = document.querySelectorAll('#itemModalEffectList .efSelect');
    if (itemEfRows.length > 0 || document.querySelector('#itemModalEffectList')) {
      output.item_effects = [...itemEfRows].map((sel) => ({ effect_id: Number(sel.value) })).filter((e) => e.effect_id);
    } else {
      output.item_effects = relationData.itemEffects || [];
    }
    const itemSkRows = document.querySelectorAll('#itemModalSkillList .itemSkillSelect');
    if (itemSkRows.length > 0 || document.querySelector('#itemModalSkillList')) {
      output.skills = [...itemSkRows].map((sel) => Number(sel.value)).filter(Boolean);
    } else {
      output.skills = relationData.itemSkills || [];
    }
    if (Object.keys(effect).length) {
      output.item_bonus = effect;
    }
  }

  if (state.model === 'skills') {
    output.weapon_types = document.querySelector('#skillModalWeaponTypes')
      ? [...document.querySelectorAll('#skillModalWeaponTypes .skillWeaponTypeCheck:checked')].map((box) => box.value)
      : relationData.skillWeaponTypes || [];
    const skillEfRows = document.querySelectorAll('#skillModalEffectList .skillEffectRow');
    if (skillEfRows.length > 0 || document.querySelector('#skillModalEffectList')) {
      output.skill_effects = [...skillEfRows].map((row) => ({
        effect_id: Number(row.querySelector('.efSelect')?.value),
        duration: Number(row.querySelector('.efDuration')?.value || 1),
        healing_current_hp: Number(row.querySelector('.efHealing')?.value || 0),
        is_cure_all: Boolean(row.querySelector('.efCureAll')?.checked),
        is_poison_cure: Boolean(row.querySelector('.efPoisonCure')?.checked),
        is_stun_cure: Boolean(row.querySelector('.efStunCure')?.checked),
        is_daze_cure: Boolean(row.querySelector('.efDazeCure')?.checked),
        is_weak_cure: Boolean(row.querySelector('.efWeakCure')?.checked),
        is_blind_cure: Boolean(row.querySelector('.efBlindCure')?.checked)
      })).filter((e) => e.effect_id);
    } else {
      output.skill_effects = relationData.skillEffects || [];
    }
  }

  if (state.model === 'prefixes' || state.model === 'suffixes') {
    output.name = document.querySelector('[name="name"]')?.value?.trim() || null;
    output.rarity = document.querySelector('[name="rarity"]')?.value || 'NORMAL';
    output.tier = document.querySelector('[name="tier"]')?.value || 'TIER_1';
    output.crit_chance = Number(document.querySelector('[name="crit_chance"]')?.value || 0);
    output.crit_damage = Number(document.querySelector('[name="crit_damage"]')?.value || 0);
    const numericFields = [
      'max_hp_bonus', 'proficiency_bonus', 'strength_bonus',
      'dexterity_bonus', 'intelligent_bonus', 'constitution_bonus', 'wisdom_bonus', 'charisma_bonus',
      'physical_attack_bonus', 'magical_attack_bonus', 'armor_bonus', 'magical_armor_bonus', 'effect_resistant_bonus',
      'fire_element_resistant', 'ice_element_resistant', 'earth_element_resistant',
      'lightning_element_resistant', 'wind_element_resistant', 'holy_element_resistant', 'dark_element_resistant'
    ];
    numericFields.forEach((field) => {
      const el = document.querySelector(`[name="${field}"]`);
      if (el) output[field] = Number(el.value || 0);
    });
  }

  if (state.model === 'ambiences') {
    output.location_id = Number(document.querySelector('[name="location_id"]')?.value) || null;
    output.sublocation_id = Number(document.querySelector('[name="sublocation_id"]')?.value) || null;
    output.weather = document.querySelector('[name="weather"]')?.value || null;
    output.weight = Number(document.querySelector('[name="weight"]')?.value || 0);
    output.min_figures = Number(document.querySelector('[name="min_figures"]')?.value || 0);
    output.max_figures = Number(document.querySelector('[name="max_figures"]')?.value || 0);
    output.is_active = Boolean(document.querySelector('[name="is_active"]')?.checked);
    output.figures = [...document.querySelectorAll('#ambienceFigureRows .lootItemRow')].map((row) => ({
      label: row.querySelector('.ambienceFigureLabel')?.value?.trim() || '',
      weight: Number(row.querySelector('.ambienceFigureWeight')?.value || 1)
    })).filter((figure) => figure.label);
    if (!output.location_id) throw new Error('Choose a location for the ambience.');
    if (output.min_figures > output.max_figures) throw new Error('Minimum figures cannot be greater than maximum figures.');
  }

  if (state.model === 'character_scenes') {
    const value = (name) => document.querySelector(`#fields [name="${name}"]`)?.value ?? '';
    const idOrNull = (name) => (value(name) ? Number(value(name)) : null);
    return {
      character_id: idOrNull('character_id'),
      party_id: idOrNull('party_id'),
      npc_character_id: idOrNull('npc_character_id'),
      location_id: idOrNull('location_id'),
      sublocation_id: idOrNull('sublocation_id'),
      scene_goal: value('scene_goal').trim(),
      scene_notes: value('scene_notes').trim(),
      scene_stage: value('scene_stage') || 'on_going',
      chaos_factor: Number(value('chaos_factor') || 5),
      is_secret: Boolean(document.querySelector('#fields [name="is_secret"]')?.checked),
      is_nsfw: Boolean(document.querySelector('#fields [name="is_nsfw"]')?.checked)
    };
  }

  if (state.model === 'stories') {
    output.character_id = Number(document.querySelector('[name="character_id"]')?.value);
    output.user_id = document.querySelector('[name="user_id"]')?.value || '';
    output.story = document.querySelector('[name="story"]')?.value || '';
    output.action_from_player = document.querySelector('[name="action_from_player"]')?.value || '';
  }

  if (state.model === 'crafting_recipes') {
    ['output_item_id', 'output_quantity', 'max_output_quantity', 'required_level', 'exp_reward', 'stamina_cost', 'duration_seconds', 'success_rate'].forEach((field) => {
      const el = document.querySelector(`[name="${field}"]`);
      if (el) output[field] = Number(el.value || 0);
    });
    output.lifeskill_id = document.querySelector('[name="lifeskill_id"]')?.value ? Number(document.querySelector('[name="lifeskill_id"]').value) : null;
    output.is_auto_unlocked = Boolean(document.querySelector('[name="is_auto_unlocked"]')?.checked);
    const ingredientRows = document.querySelectorAll('#modalRecipeIngredientRows .recipeIngredientRow');
    if (ingredientRows.length > 0 || document.querySelector('#modalRecipeIngredientRows')) {
      output.ingredients = [...ingredientRows].map((row) => ({
        item_id: Number(row.querySelector('.recipeIngredientSelect')?.value),
        quantity: Number(row.querySelector('.recipeIngredientQty')?.value || 1)
      })).filter((i) => i.item_id);
    } else {
      output.ingredients = relationData.recipeIngredients || [];
    }
  }

  if (state.model === 'quests') {
    output.source_npc_id = Number(output.source_npc_id) || null;
    const isCollect = output.objective_type === 'COLLECT';
    output.target_item_id = isCollect ? (Number(output.target_item_id) || null) : null;
    output.target_npc_character_id = isCollect ? null : (Number(output.target_npc_character_id) || null);
    output.required_quantity = Number(output.required_quantity || 1);
    output.gold_reward = Number(output.gold_reward || 0);
    output.exp_reward = Number(output.exp_reward || 0);
    output.affinity_reward = Number(output.affinity_reward || 0);
    output.repeatable = Boolean(document.querySelector('[name="repeatable"]')?.checked);
    output.is_nsfw = Boolean(document.querySelector('[name="is_nsfw"]')?.checked);
  }

  if (state.model === 'loot_groups') {
    const lootItemRows = document.querySelectorAll('#modalLootItemRows .lootItemRow');
    if (lootItemRows.length > 0 || document.querySelector('#modalLootItemRows')) {
      output.loot_items = [...lootItemRows].map((row) => ({
        item_id: Number(row.querySelector('.lootItemSelect')?.value),
        chance_pct: Number(row.querySelector('.lootChance')?.value || 0),
        min_quantity: Number(row.querySelector('.lootMin')?.value || 1),
        max_quantity: Number(row.querySelector('.lootMax')?.value || 1)
      })).filter((i) => i.item_id);
    } else {
      output.loot_items = relationData.lootItems || [];
    }
    const monsterChecks = document.querySelectorAll('#modalLootMonsterCards .lootMonsterCheck:checked');
    if (monsterChecks.length > 0 || document.querySelector('#modalLootMonsterCards')) {
      output.monster_ids = [...monsterChecks].map((chk) => Number(chk.value));
    } else {
      output.monster_ids = relationData.lootMonsters || [];
    }
    const locationChecks = document.querySelectorAll('#modalLootLocationCards .lootLocationCheck:checked');
    if (locationChecks.length > 0 || document.querySelector('#modalLootLocationCards')) {
      output.location_ids = [...locationChecks].map((chk) => Number(chk.value));
      output.location_links = [...locationChecks].map((chk) => {
        const chanceInput = document.querySelector(`#modalLootLocationCards .lootLocationChance[data-location-id="${chk.value}"]`);
        return { location_id: Number(chk.value), chance_pct: Number(chanceInput?.value ?? 100) };
      });
    } else {
      output.location_ids = relationData.lootLocations || [];
      output.location_links = output.location_ids.map((id) => ({ location_id: id, chance_pct: (relationData.lootLocationChances || {})[id] ?? 100 }));
    }
  }

  if (state.model === 'locations') {
    output.region_id = Number(output.region_id);
    output.is_safe_zone = Boolean(document.querySelector('[name="is_safe_zone"]')?.checked);
    output.location_type = document.querySelector('[name="location_type"]')?.value || 'VILLAGE';
  }

  if (state.model === 'sublocations') {
    output.location_id = Number(output.location_id);
    output.owner_id = output.owner_id ? Number(output.owner_id) : null;
    output.sublocation_type = document.querySelector('[name="sublocation_type"]')?.value || 'DEFAULT';
    output.long_rest_price = output.sublocation_type === 'INN' ? Math.max(0, Number(output.long_rest_price || 0)) : 0;
    output.food_water_refill_price = output.sublocation_type === 'INN' ? Math.max(0, Number(output.food_water_refill_price || 0)) : 0;
    const itemSelects = document.querySelectorAll('#modalSublocationItemRows .sublocationItemSelect');
    if (itemSelects.length > 0 || document.querySelector('#modalSublocationItemRows')) {
      output.items = [...itemSelects].map((sel) => Number(sel.value)).filter(Boolean);
    } else {
      output.items = (relationData.sublocationItems || []).map((rel) => Number(rel.item_id)).filter(Boolean);
    }
  }

  if (state.model === 'items' && Object.keys(effect).length) {
    output.item_bonus = effect;
  }

  return output;
}

// Global Event Listeners
$('#genericCreate').onclick = () => { state.appliedRelations.clear(); openEditor(); };
$('#create').onclick = () => { state.appliedRelations.clear(); openEditor(null, 'PLAYER'); };
$('#createNpc').onclick = () => { state.appliedRelations.clear(); openEditor(null, 'NPC'); };

$('#openGame').onclick = () => window.open('/game.html', '_blank', 'noopener');

$('#logout').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
};

function closeEditor() {
  state.appliedRelations.clear();
  const editor = $('#editor');
  if (editor && typeof editor.close === 'function' && editor.open) {
    editor.close();
  }
}

if ($('#editorClose')) $('#editorClose').onclick = (e) => { e.preventDefault(); closeEditor(); };
if ($('#editorCancel')) $('#editorCancel').onclick = (e) => { e.preventDefault(); closeEditor(); };

$('#editor')?.addEventListener('cancel', () => {
  state.appliedRelations.clear();
});

$('#editor')?.addEventListener('click', (event) => {
  if (event.target === $('#editor')) {
    closeEditor();
    return;
  }
  const btn = event.target.closest('button');
  if (btn && (btn.id === 'editorClose' || btn.id === 'editorCancel' || btn.classList.contains('close') || btn.value === 'cancel')) {
    event.preventDefault();
    closeEditor();
  }
});

$('#editorForm').onsubmit = async (event) => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel' || event.submitter?.id === 'editorCancel' || event.submitter?.id === 'editorClose') {
    closeEditor();
    return;
  }
  try {
    await document.querySelector('#characterAvatarFile')?._readPromise;
    const body = formDataEnhanced();
    const url = `/api/admin/${state.model}${state.editing ? `/${state.editing}` : ''}`;
    const result = await api(url, {
      method: state.editing ? 'PATCH' : 'POST',
      body: JSON.stringify(body)
    });
    closeEditor();
    show(result.message);
    await load();
  } catch (error) {
    show(error.message, true);
  }
};

$('#userFilter').oninput = (event) => {
  state.userFilter = event.target.value;
  state.userPage = 1;
  clearTimeout(state.userLoadTimer);
  state.userLoadTimer = setTimeout(load, 250);
};

$('#userStatus').onchange = (event) => {
  state.userStatus = event.target.value;
  state.userPage = 1;
  load();
};

$('#userPrev').onclick = () => {
  if (state.userPage > 1) {
    state.userPage -= 1;
    load();
  }
};

$('#userNext').onclick = () => {
  if (state.userPage < (state.data.userMeta?.pages || 1)) {
    state.userPage += 1;
    load();
  }
};

$('#genericPrev').onclick = () => {
  if (state.page > 1) {
    state.page -= 1;
    renderTable();
  }
};

$('#genericNext').onclick = () => {
  const filtered = getFilteredRecords();
  const pages = Math.ceil(filtered.length / state.pageSize);
  if (state.page < pages) {
    state.page += 1;
    renderTable();
  }
};

renderTabs();
load();
