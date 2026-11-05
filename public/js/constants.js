const freeze = Object.freeze;

export const PAGES = freeze({
  LOGIN: './login.html',
  GAME: './game.html',
  COMBAT: './combat.html',
  SHOP: './shop.html',
  ADMIN: './admin.html',
});

export const HTTP_METHOD = freeze({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
});

export const BYTES_PER_MB = 1024 * 1024;
export const JSON_BODY_LIMIT_BYTES = 10 * BYTES_PER_MB;
export const JSON_CHUNK_BYTES = BYTES_PER_MB;
export const JSON_CHUNK_MODES = freeze({ APPEND: 'append', COMMIT: 'commit' });
export const JSON_CHUNK_HEADERS = freeze({
  id: 'X-Stervian-JSON-Chunk-ID',
  index: 'X-Stervian-JSON-Chunk-Index',
  total: 'X-Stervian-JSON-Chunk-Total',
  mode: 'X-Stervian-JSON-Chunk-Mode',
});

export const MCP_ENDPOINT = 'http://localhost:3001/mcp';
export const MCP_PROTOCOL_VERSION = '2026-07-28';

export const WEBSOCKET_PATH = '/ws';
export const WEBSOCKET_STORY_CHANNEL = 'story';
export const WEBSOCKET_INITIAL_RECONNECT_DELAY_MS = 500;
export const WEBSOCKET_MAX_RECONNECT_DELAY_MS = 10000;
export const WEBSOCKET_EVENTS = freeze({
  SUBSCRIBE: 'subscribe',
  STORY_AVAILABLE: 'story.available',
  WORLD_TIME_CHANGED: 'world:time_changed',
  LOCATION_WEATHER_CHANGED: 'world:weather_changed',
  AMBIENCE_NOTICE: 'world:ambience_notice',
  PARTY_PREFIX: 'party:',
  PARTY_COMBAT_PREFIX: 'party:combat_',
  PARTY_INVITE: 'party:invite',
  PARTY_MEMBER_JOINED: 'party:member_joined',
  PARTY_MEMBER_LEFT: 'party:member_left',
  PARTY_DISBANDED: 'party:disbanded',
  PARTY_COMPANION_RECRUITED: 'party:companion_recruited',
  PARTY_COMPANION_DISMISSED: 'party:companion_dismissed',
  PARTY_STORY_TURN: 'party:story_turn',
  PARTY_MOVED: 'party:moved',
});

export const STORAGE_KEY_PREFIXES = freeze({
  HISTORY: 'stervian_history_',
  DEFEAT_ACTION: 'stervian_defeat_action_',
  FLEE_ACTION: 'stervian_flee_action_',
});

export const TOAST_DURATION_MS = 2400;
export const COMBAT_REFRESH_INTERVAL_MS = 2500;
export const BATTLE_ANIMATION_STEP_MS = 450;
export const BATTLE_ANIMATION_SETTLE_MS = 150;
export const CRAFTING_ANIMATION_DURATION_MS = 2000;
export const DEFAULT_FARMING_CYCLE_MS = 60000;
export const DEFAULT_GATHERING_CYCLE_MS = 20000;
export const DEFAULT_FISHING_CYCLE_MS = 20000;
export const DEFAULT_RECIPE_DURATION_SECONDS = 60;
export const MIN_LIFESKILL_CYCLE_MS = 1000;
export const IDLE_STATUS_LABEL = 'IDLE';

export const MAX_LEVEL = 10;
export const MAX_EXPERIENCE = 248300;
export const EXPERIENCE_THRESHOLDS = freeze([0, 100, 350, 850, 2000, 5500, 11500, 28000, 65000, 135000, MAX_EXPERIENCE]);
export const LIFESKILL_EXP_PER_LEVEL = 200;

export const FLEE_ENERGY_COST = 40;
export const RESPAWN_VITALS = freeze({ hp: 1, energy: 1, food: 20, water: 20 });

export const ACTION_MODES = freeze({ STORY: 'story' });
export const MAX_ENCOUNTER_ENEMIES = 5;

export const PLAYER_TOOL = freeze({
  INSPECT_CURRENT_LOCATION: 'inspect_current_location',
  NPC_KNOWN_PLACES: 'npc_known_places',
  SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC: 'search_npc_in_relationship_with_npc'
});
export const PLAYER_TOOL_OPTIONS = freeze([
  freeze({ tool: PLAYER_TOOL.INSPECT_CURRENT_LOCATION, label: 'Inspect current location', needsTarget: false, description: 'The Dungeon Master checks this location and all of its places, so it can describe and guide you with real places.' }),
  freeze({ tool: PLAYER_TOOL.NPC_KNOWN_PLACES, label: 'Places this NPC knows', needsTarget: true, description: 'Checks which places your target NPC actually knows. The NPC can only give real directions to those places.' }),
  freeze({ tool: PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC, label: 'Does this NPC know someone?', needsTarget: true, description: 'Checks whether your target NPC knows another NPC. If they have no relationship, the target does not know that person.' })
]);
export const PLAYER_TOOL_NPC_NAME_MAX_LENGTH = 100;
export const OBSERVE_MODE = freeze({
  MIN_REPEAT: 1,
  MAX_REPEAT: 3,
  DEFAULT_REPEAT: 1,
  DIRECTION_MAX_LENGTH: 1000,
});

export const BATTLE_STATUS = freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
  FLED: 'FLED',
});

export const SKILL_MENU_TYPE = freeze({ ATTACK: 'ATTACK', MAGIC_ATTACK: 'MAGIC_ATTACK', DEFEND: 'DEFEND', SPELL: 'SPELL' });
export const TAUNT_SKILL_NAME = 'TAUNT';

export const CHARACTER_TYPE = freeze({ PLAYER: 'PLAYER', NPC: 'NPC' });
export const PARTY_MEMBER_ROLE = freeze({ LEADER: 'LEADER', MEMBER: 'MEMBER', CAPTIVE: 'CAPTIVE' });
export const TACTICS_ROLE = freeze({ BALANCED: 'BALANCED', TANK: 'TANK', HEALER: 'HEALER', AGGRESSIVE: 'AGGRESSIVE', SUPPORT: 'SUPPORT' });
export const DEFAULT_TACTICS_ROLE = TACTICS_ROLE.BALANCED;

export const SUBLOCATION_TYPE = freeze({ INN: 'INN', SHOP: 'SHOP', GUILD_OFFICE: 'GUILD_OFFICE' });
export const TRADING_SUBLOCATION_TYPES = freeze([SUBLOCATION_TYPE.SHOP, SUBLOCATION_TYPE.INN]);

export const MEMORY_TYPE = freeze({ SHORT_TERM: 'SHORT_TERM', LONG_TERM: 'LONG_TERM', SECRET: 'SECRET' });
export const SHORT_TERM_MEMORY_TTL_MS = 60 * 60 * 1000;
export const LONG_TERM_MEMORY_TTL_MS = 2 * 60 * 60 * 1000;

export const ITEM_LOCATION = freeze({ BACKPACK: 'BACKPACK', VAULT: 'VAULT', EQUIPPED: 'EQUIPPED' });
export const VAULT_TRANSFER_DIRECTION = freeze({ DEPOSIT: 'deposit', WITHDRAW: 'withdraw' });

export const ITEM_TYPE = freeze({
  HELMET: 'HELMET',
  ARMOR: 'ARMOR',
  SHOES: 'SHOES',
  GLOVES: 'GLOVES',
  EARRING: 'EARRING',
  RING: 'RING',
  NECKLACE: 'NECKLACE',
  BELT: 'BELT',
  MAIN_HAND: 'MAIN_HAND',
  TWO_HAND: 'TWO_HAND',
  SUB_HAND: 'SUB_HAND',
  QUEST_ITEMS: 'QUEST_ITEMS',
  FOOD: 'FOOD',
  FISH: 'FISH',
  POTION: 'POTION',
  MISCS: 'MISCS',
  SKILL_SCROLL: 'SKILL_SCROLL',
});
export const EQUIPPABLE_ITEM_TYPES = freeze([
  ITEM_TYPE.HELMET, ITEM_TYPE.ARMOR, ITEM_TYPE.SHOES, ITEM_TYPE.GLOVES,
  ITEM_TYPE.EARRING, ITEM_TYPE.RING,
  ITEM_TYPE.NECKLACE, ITEM_TYPE.BELT, ITEM_TYPE.MAIN_HAND, ITEM_TYPE.TWO_HAND,
]);
export const WEAPON_ITEM_TYPES = freeze([ITEM_TYPE.MAIN_HAND, ITEM_TYPE.TWO_HAND]);
export const ACCESSORY_ITEM_TYPES = freeze([
  ITEM_TYPE.RING, ITEM_TYPE.EARRING, ITEM_TYPE.NECKLACE, ITEM_TYPE.BELT,
]);

export const LOOT_GROUP_RARITY = freeze({
  COMMON: 'COMMON',
  UNCOMMON: 'UNCOMMON',
  RARE: 'RARE',
  LEGENDARY: 'LEGENDARY',
  BOSS: 'BOSS',
});

export const MAX_ONGOING_SCENES = 10;
export const SCENE_STAGE = freeze({ ON_GOING: 'on_going', ABANDONED: 'abandoned', SOLVED: 'solved' });
export const SCENE_FIELD_MAX_LENGTHS = freeze({ scene_goal: 500, scene_notes: 3000 });
export const SCENE_AFFINITY_REWARD = freeze({ MIN: -100, MAX: 100 });
export const FATE_CHECK_QUESTION_MAX_LENGTH = 300;
export const FATE_DICE_HIDE_DELAY_MS = 1800;
export const FATE_ODDS_DEFAULT = 'FIFTY_FIFTY';
export const FATE_CHAOS_FROM_SCENE = '';
export const FATE_CHAOS_OPTIONS = freeze([
  freeze({ value: '', label: 'Chaos: scene' }),
  freeze({ value: '1', label: 'Chaos 1 · orderly' }),
  freeze({ value: '2', label: 'Chaos 2' }),
  freeze({ value: '3', label: 'Chaos 3' }),
  freeze({ value: '4', label: 'Chaos 4' }),
  freeze({ value: '5', label: 'Chaos 5 · balanced' }),
  freeze({ value: '6', label: 'Chaos 6' }),
  freeze({ value: '7', label: 'Chaos 7' }),
  freeze({ value: '8', label: 'Chaos 8' }),
  freeze({ value: '9', label: 'Chaos 9 · wild' })
]);
export const SKILL_CHECK = freeze({ DC_MIN: 1, DC_MAX: 30, DC_DEFAULT: 15 });
export const SKILL_ROLL_MODE = freeze({ NORMAL: 'NORMAL', ADVANTAGE: 'ADVANTAGE', DISADVANTAGE: 'DISADVANTAGE' });
export const CHECK_ORDER = freeze({ SKILL_FIRST: 'SKILL_FIRST', FATE_FIRST: 'FATE_FIRST' });
export const SKILL_DC_PRESETS = freeze([
  freeze({ dc: 5, label: 'Very easy' }),
  freeze({ dc: 10, label: 'Easy' }),
  freeze({ dc: 15, label: 'Medium' }),
  freeze({ dc: 20, label: 'Hard' }),
  freeze({ dc: 25, label: 'Very hard' }),
  freeze({ dc: 30, label: 'Nearly impossible' })
]);
export const STORY_SKILLS = freeze([
  freeze({ key: 'athletics', name: 'Athletics', ability: 'STR' }),
  freeze({ key: 'acrobatics', name: 'Acrobatics', ability: 'DEX' }),
  freeze({ key: 'sleight_of_hand', name: 'Sleight of Hand', ability: 'DEX' }),
  freeze({ key: 'stealth', name: 'Stealth', ability: 'DEX' }),
  freeze({ key: 'arcana', name: 'Arcana', ability: 'INT' }),
  freeze({ key: 'history', name: 'History', ability: 'INT' }),
  freeze({ key: 'investigation', name: 'Investigation', ability: 'INT' }),
  freeze({ key: 'nature', name: 'Nature', ability: 'INT' }),
  freeze({ key: 'religion', name: 'Religion', ability: 'INT' }),
  freeze({ key: 'animal_handling', name: 'Animal Handling', ability: 'WIS' }),
  freeze({ key: 'insight', name: 'Insight', ability: 'WIS' }),
  freeze({ key: 'medicine', name: 'Medicine', ability: 'WIS' }),
  freeze({ key: 'perception', name: 'Perception', ability: 'WIS' }),
  freeze({ key: 'survival', name: 'Survival', ability: 'WIS' }),
  freeze({ key: 'deception', name: 'Deception', ability: 'CHA' }),
  freeze({ key: 'intimidation', name: 'Intimidation', ability: 'CHA' }),
  freeze({ key: 'performance', name: 'Performance', ability: 'CHA' }),
  freeze({ key: 'persuasion', name: 'Persuasion', ability: 'CHA' })
]);
export const FATE_ODDS_OPTIONS = freeze([
  freeze({ value: 'CERTAIN', label: 'Certain' }),
  freeze({ value: 'NEARLY_CERTAIN', label: 'Nearly Certain' }),
  freeze({ value: 'VERY_LIKELY', label: 'Very Likely' }),
  freeze({ value: 'LIKELY', label: 'Likely' }),
  freeze({ value: 'FIFTY_FIFTY', label: '50/50' }),
  freeze({ value: 'UNLIKELY', label: 'Unlikely' }),
  freeze({ value: 'VERY_UNLIKELY', label: 'Very Unlikely' }),
  freeze({ value: 'NEARLY_IMPOSSIBLE', label: 'Nearly Impossible' }),
  freeze({ value: 'IMPOSSIBLE', label: 'Impossible' })
]);

export const AI_API_KEY = freeze({
  HEADER: 'x-ai-api-key',
  STORAGE_KEY: 'stervian.aiApiKey',
  MAX_LENGTH: 512,
});
