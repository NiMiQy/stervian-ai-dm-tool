const freeze = Object.freeze;

export const HTTP_STATUS = freeze({
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
});

export const ERROR_NAMES = freeze({
  DATABASE_OPERATION: 'DatabaseOperationError',
  BATTLE_RULE: 'BattleRuleError',
  VAULT_ACCESS: 'VaultAccessError',
  VAULT_RULE: 'VaultRuleError',
  CRAFTING_RULE: 'CraftingRuleError',
  CRAFTING_CONFLICT: 'CraftingConflictError',
  FARMING_RULE: 'FarmingRuleError',
  FARMING_CONFLICT: 'FarmingConflictError',
  GATHERING_RULE: 'GatheringRuleError',
  GATHERING_CONFLICT: 'GatheringConflictError',
  FISHING_RULE: 'FishingRuleError',
  FISHING_CONFLICT: 'FishingConflictError',
  LOOKUP_INPUT: 'LookupInputError',
  SCENE_RULE: 'SceneRuleError',
});

export const NUMERIC_ID_PATTERN = /^\d+$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 40;
export const USERNAME_PATTERN = new RegExp(`^[a-zA-Z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`);
export const JSON_CHUNK_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const MAX_INT32 = 2147483647;

export const SERVER_DEFAULTS = freeze({
  PORT: 3000,
  MCP_PORT: 3001,
  MCP_HOST: '127.0.0.1',
  PUBLIC_DIRECTORY: 'public',
  LANDING_PAGE: '/login.html',
  GAME_PAGE: '/game.html',
  ADMIN_FORBIDDEN_REDIRECT_DELAY_MS: 2000,
});

export const MCP_SERVER = freeze({
  NAME: 'Stervian_DM',
  VERSION: '1.0.0',
  ALLOWED_ORIGINS: freeze([`http://localhost:${SERVER_DEFAULTS.PORT}`, `http://127.0.0.1:${SERVER_DEFAULTS.PORT}`]),
});

export const CONTENT_TYPES = freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
});
export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export const BYTES_PER_MB = 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 10 * BYTES_PER_MB;
export const JSON_CHUNK_BYTES = BYTES_PER_MB;
export const JSON_CHUNK_TTL_MS = 2 * 60 * 1000;
export const JSON_CHUNK_CLEANUP_INTERVAL_MS = 30 * 1000;
export const MAX_ACTIVE_JSON_UPLOADS = 256;
export const MAX_BUFFERED_JSON_BYTES = 256 * BYTES_PER_MB;
export const JSON_CHUNK_MODES = freeze({ APPEND: 'append', COMMIT: 'commit' });
export const JSON_CHUNK_HEADERS = freeze({
  id: 'x-stervian-json-chunk-id',
  index: 'x-stervian-json-chunk-index',
  total: 'x-stervian-json-chunk-total',
  mode: 'x-stervian-json-chunk-mode',
});
export const MAX_IMAGE_BYTES = 5 * BYTES_PER_MB;

export const SESSION_COOKIE_NAME = 'stervian_session';
export const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const BCRYPT_SALT_ROUNDS = 12;

export const DATABASE_DEFAULTS = freeze({
  PORT: 3306,
  CONNECTION_LIMIT: 5,
});

export const TRANSACTION_ISOLATION = freeze({
  SERIALIZABLE: 'Serializable',
  READ_COMMITTED: 'ReadCommitted',
});
export const QUEST_TRANSACTION_TIMEOUT_MS = 15000;
export const PRISMA_TRANSACTION_CONFLICT_CODE = 'P2034';
export const TRANSACTION_CONFLICT_MESSAGES = freeze(['deadlock', 'serialization failure', 'could not serialize access']);

export const WEBSOCKET_PATH = '/ws';
export const WEBSOCKET_PROTOCOL_VERSION = 1;
export const WEBSOCKET_MAX_PAYLOAD_BYTES = 16 * 1024;
export const WEBSOCKET_MAX_REQUEST_ID_LENGTH = 100;
export const WEBSOCKET_CLOSE_GOING_AWAY = 1001;
export const WEBSOCKET_STORY_CHANNEL = 'story';
export const WEBSOCKET_EVENTS = freeze({
  CONNECTED: 'connected',
  ERROR: 'error',
  ACK: 'ack',
  SUBSCRIBE: 'subscribe',
  PING: 'ping',
  PONG: 'pong',
  STORY_AVAILABLE: 'story.available',
  WORLD_TIME_CHANGED: 'world:time_changed',
  LOCATION_WEATHER_CHANGED: 'world:weather_changed',
  AMBIENCE_NOTICE: 'world:ambience_notice',
  PARTY_INVITE: 'party:invite',
  PARTY_INVITE_DECLINED: 'party:invite_declined',
  PARTY_MEMBER_JOINED: 'party:member_joined',
  PARTY_MEMBER_LEFT: 'party:member_left',
  PARTY_STORY_TURN: 'party:story_turn',
  PARTY_MOVED: 'party:moved',
  PARTY_COMBAT_START: 'party:combat_start',
  PARTY_COMBAT_UPDATE: 'party:combat_update',
});
export const WEBSOCKET_ERROR_CODES = freeze({
  INVALID_JSON: 'INVALID_JSON',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  UNKNOWN_CHANNEL: 'UNKNOWN_CHANNEL',
  UNKNOWN_MESSAGE: 'UNKNOWN_MESSAGE',
});

export const ACTION_MODES = freeze({ STORY: 'story' });
export const VALID_ACTION_MODES = freeze(Object.values(ACTION_MODES));

export const ADMIN_MODELS = freeze([
  'users', 'characters', 'items', 'skills', 'effects', 'lifeskills', 'regions', 'locations',
  'location_routes', 'sublocations', 'loot_groups', 'crafting_recipes', 'quests', 'prefixes', 'suffixes', 'stories', 'ambiences', 'character_scenes',
]);
export const ADMIN_DASHBOARD_QUERY_KEYS = freeze(['userSearch', 'userStatus', 'userSort', 'userDirection', 'userPage', 'userPageSize']);
export const ADMIN_USER_SORT_FIELDS = freeze(['id', 'user_id', 'username', 'character', 'role', 'status', 'created_at']);
export const ADMIN_DEFAULT_PAGE_SIZE = 50;
export const ADMIN_MAX_PAGE_SIZE = 100;
export const MAP_COORDINATE_MIN = 0;
export const MAP_COORDINATE_MAX = 100;
export const DEFAULT_SUBLOCATION_SERVICE_PRICE = 350;
export const ADMIN_DESCRIPTION_MAX_LENGTH = 200;
export const DEFAULT_ROUTE_COST = 5;
export const DEFAULT_NPC_RELATIONSHIP_TYPE = 'ACQUAINTANCE';
export const DEFAULT_NPC_LOCATION_KNOWLEDGE = 'LOCAL_LANDMARK';
export const DEFAULT_TIER = 'TIER_1';
export const DEFAULT_WEAPON_TYPE = 'SWORD';
export const UNARMED_WEAPON_TYPE = 'NONE';
export const ANY_WEAPON_TYPE = 'ANY_WEAPON';
export const ITEM_TRIGGER_NONE = 'NONE';

export const CHARACTER_TYPE = freeze({ PLAYER: 'PLAYER', NPC: 'NPC' });
export const CHARACTER_SEX = freeze({ MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' });
export const VALID_CHARACTER_SEXES = freeze(Object.values(CHARACTER_SEX));

export const ITEM_LOCATION = freeze({ NONE: 'NONE', BACKPACK: 'BACKPACK', VAULT: 'VAULT', EQUIPPED: 'EQUIPPED' });
export const STORAGE_LOCATIONS = freeze([ITEM_LOCATION.BACKPACK, ITEM_LOCATION.VAULT]);
export const CARRIED_LOCATIONS = freeze([ITEM_LOCATION.BACKPACK, ITEM_LOCATION.EQUIPPED]);

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
  QUEST_ITEMS: 'QUEST_ITEMS',
  FOOD: 'FOOD',
  FISH: 'FISH',
  POTION: 'POTION',
  MISCS: 'MISCS',
  SKILL_SCROLL: 'SKILL_SCROLL',
});
export const EQUIPMENT_ITEM_TYPES = freeze([
  ITEM_TYPE.HELMET, ITEM_TYPE.ARMOR, ITEM_TYPE.SHOES, ITEM_TYPE.GLOVES,
  ITEM_TYPE.EARRING, ITEM_TYPE.RING,
  ITEM_TYPE.NECKLACE, ITEM_TYPE.BELT, ITEM_TYPE.MAIN_HAND, ITEM_TYPE.TWO_HAND,
]);
export const NON_EQUIPMENT_ITEM_TYPES = freeze([ITEM_TYPE.QUEST_ITEMS, ITEM_TYPE.MISCS, ITEM_TYPE.FOOD, ITEM_TYPE.FISH, ITEM_TYPE.POTION, ITEM_TYPE.SKILL_SCROLL]);
export const isConsumableItem = (item) => Boolean(item?.is_consumable);
export const isMaterialItem = (item) => Boolean(item?.is_material);
export const WEAPON_ITEM_TYPES = freeze([ITEM_TYPE.MAIN_HAND, ITEM_TYPE.TWO_HAND]);
export const ACCESSORY_ITEM_TYPES = freeze([
  ITEM_TYPE.RING, ITEM_TYPE.EARRING, ITEM_TYPE.NECKLACE, ITEM_TYPE.BELT,
]);

export const EQUIP_SLOT = freeze({
  NONE: 'NONE',
  HELMET: 'HELMET',
  ARMOR: 'ARMOR',
  GLOVES: 'GLOVES',
  SHOES: 'SHOES',
  LEFT_HAND: 'LEFT_HAND',
  RIGHT_HAND: 'RIGHT_HAND',
  LEFT_EARRING: 'LEFT_EARRING',
  RIGHT_EARRING: 'RIGHT_EARRING',
  LEFT_RING: 'LEFT_RING',
  RIGHT_RING: 'RIGHT_RING',
  NECKLACE: 'NECKLACE',
  BELT: 'BELT',
});
export const EQUIP_SLOT_FIELDS = freeze({
  HELMET: 'helmet',
  ARMOR: 'armor',
  GLOVES: 'gloves',
  SHOES: 'shoes',
  LEFT_HAND: 'left_hand',
  RIGHT_HAND: 'right_hand',
  LEFT_EARRING: 'left_earring',
  RIGHT_EARRING: 'right_earring',
  LEFT_RING: 'left_ring',
  RIGHT_RING: 'right_ring',
  NECKLACE: 'necklace',
  BELT: 'belt',
});
export const HAND_SLOTS = freeze([EQUIP_SLOT.LEFT_HAND, EQUIP_SLOT.RIGHT_HAND]);
export const ACCURACY_ACCESSORY_FIELDS = freeze(['left_earring', 'right_earring', 'left_ring', 'right_ring', 'necklace']);
export const SLOT_BY_ITEM_TYPE = freeze({
  HELMET: EQUIP_SLOT.HELMET,
  ARMOR: EQUIP_SLOT.ARMOR,
  SHOES: EQUIP_SLOT.SHOES,
  GLOVES: EQUIP_SLOT.GLOVES,
  EARRING: EQUIP_SLOT.LEFT_EARRING,
  RING: EQUIP_SLOT.LEFT_RING,
  NECKLACE: EQUIP_SLOT.NECKLACE,
  BELT: EQUIP_SLOT.BELT,
  MAIN_HAND: EQUIP_SLOT.LEFT_HAND,
  TWO_HAND: EQUIP_SLOT.LEFT_HAND,
});
export const EQUIP_SLOT_ITEM_TYPES = freeze({
  HELMET: freeze([ITEM_TYPE.HELMET]),
  ARMOR: freeze([ITEM_TYPE.ARMOR]),
  GLOVES: freeze([ITEM_TYPE.GLOVES]),
  SHOES: freeze([ITEM_TYPE.SHOES]),
  LEFT_HAND: freeze([ITEM_TYPE.MAIN_HAND, ITEM_TYPE.TWO_HAND]),
  RIGHT_HAND: freeze([ITEM_TYPE.MAIN_HAND]),
  LEFT_EARRING: freeze([ITEM_TYPE.EARRING]),
  RIGHT_EARRING: freeze([ITEM_TYPE.EARRING]),
  LEFT_RING: freeze([ITEM_TYPE.RING]),
  RIGHT_RING: freeze([ITEM_TYPE.RING]),
  NECKLACE: freeze([ITEM_TYPE.NECKLACE]),
  BELT: freeze([ITEM_TYPE.BELT]),
});

export const RARITY = freeze({
  NORMAL: 'NORMAL',
  UNCOMMON: 'UNCOMMON',
  RARE: 'RARE',
  UNIQUE: 'UNIQUE',
  MYSTIC: 'MYSTIC',
  LEGENDARY: 'LEGENDARY',
  ANCIENT: 'ANCIENT',
});
export const LOOT_GROUP_RARITY = freeze({
  COMMON: 'COMMON',
  UNCOMMON: 'UNCOMMON',
  RARE: 'RARE',
  LEGENDARY: 'LEGENDARY',
  BOSS: 'BOSS',
});
export const VALID_LOOT_GROUP_RARITIES = freeze(Object.values(LOOT_GROUP_RARITY));
export const RARE_LOOT_GROUP_RARITIES = freeze([LOOT_GROUP_RARITY.RARE, LOOT_GROUP_RARITY.LEGENDARY, LOOT_GROUP_RARITY.BOSS]);
export const MAX_LOOT_CHANCE_PCT = 100;

export const SKILL_MENU_TYPE = freeze({ ATTACK: 'ATTACK', MAGIC_ATTACK: 'MAGIC_ATTACK', DEFEND: 'DEFEND', SPELL: 'SPELL' });
export const OFFENSIVE_SKILL_TYPES = freeze([SKILL_MENU_TYPE.ATTACK, SKILL_MENU_TYPE.MAGIC_ATTACK, SKILL_MENU_TYPE.SPELL]);
export const SKILL_DAMAGE_TYPE = freeze({ PHYSICAL: 'PHYSICAL', MAGICAL: 'MAGICAL', HYBRID: 'HYBRID' });
export const SKILL_TARGET_RULE = freeze({
  SELF_ONLY: 'SELF_ONLY',
  ALL_PARTY_MEMBERS: 'ALL_PARTY_MEMBERS',
  ON_SELECTED_ALLY: 'ON_SELECTED_ALLY',
  ON_SELECTED_ENEMY: 'ON_SELECTED_ENEMY',
  ALL_ENEMIES: 'ALL_ENEMIES',
  TO_ALL: 'TO_ALL',
});
export const CURE_EFFECT_NONE = 'NONE';
export const CONSUME_BONUS_MODE = freeze({ NONE: 'NONE', TEMPORARY: 'TEMPORARY', PERMANENT_ONCE: 'PERMANENT_ONCE' });
export const ITEM_STAT_BONUS_FIELDS = freeze([
  freeze(['max_hp_bonus', 'Max HP']), freeze(['proficiency_bonus', 'Proficiency']), freeze(['strength_bonus', 'STR']),
  freeze(['dexterity_bonus', 'DEX']), freeze(['intelligent_bonus', 'INT']), freeze(['constitution_bonus', 'CON']),
  freeze(['wisdom_bonus', 'WIS']), freeze(['charisma_bonus', 'CHA']), freeze(['physical_attack_bonus', 'Physical ATK']),
  freeze(['magical_attack_bonus', 'Magical ATK']), freeze(['armor_bonus', 'Armor']), freeze(['magical_armor_bonus', 'Magic Armor']),
  freeze(['effect_resistant_bonus', 'Status Resist']), freeze(['fire_element_resistant', 'Fire Resist']), freeze(['ice_element_resistant', 'Ice Resist']),
  freeze(['earth_element_resistant', 'Earth Resist']), freeze(['lightning_element_resistant', 'Lightning Resist']), freeze(['wind_element_resistant', 'Wind Resist']),
  freeze(['holy_element_resistant', 'Holy Resist']), freeze(['dark_element_resistant', 'Dark Resist']), freeze(['crit_chance_bonus', 'Crit Chance']),
  freeze(['crit_damage_bonus', 'Crit Damage']),
]);

export const SUBLOCATION_TYPE = freeze({
  DEFAULT: 'DEFAULT',
  SECRET_HIDEOUT: 'SECRET_HIDEOUT',
  HOUSE: 'HOUSE',
  CASTLE: 'CASTLE',
  MANSION: 'MANSION',
  GUILD_OFFICE: 'GUILD_OFFICE',
  ALLEY: 'ALLEY',
  SQUARE: 'SQUARE',
  INN: 'INN',
  SHOP: 'SHOP',
});
export const DEFAULT_LOCATION_TYPE = 'VILLAGE';
export const TRADING_SUBLOCATION_TYPES = freeze([SUBLOCATION_TYPE.SHOP, SUBLOCATION_TYPE.INN]);

export const MEMORY_TYPE = freeze({
  SHORT_TERM: 'SHORT_TERM',
  LONG_TERM: 'LONG_TERM',
  SEMANTIC: 'SEMANTIC',
  EPISODIC: 'EPISODIC',
  SECRET: 'SECRET',
});
export const VALID_MEMORY_TYPES = freeze(Object.values(MEMORY_TYPE));
export const SHORT_TERM_MEMORY_LIMIT = 10;
export const LONG_TERM_MEMORY_LIMIT = 5;
export const SHORT_TERM_MEMORY_TTL_MS = 60 * 60 * 1000;
export const LONG_TERM_MEMORY_TTL_MS = 2 * 60 * 60 * 1000;
export const MEMORY_TTL_MS = freeze({
  [MEMORY_TYPE.SHORT_TERM]: SHORT_TERM_MEMORY_TTL_MS,
  [MEMORY_TYPE.LONG_TERM]: LONG_TERM_MEMORY_TTL_MS,
});
export const MEMORY_FETCH_LIMIT = 100;
export const DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT = 10;
export const MEMORY_CONTENT_MAX_LENGTH = 5000;
export const MEMORY_SUMMARY_MAX_LENGTH = 2000;
export const UNREVEALED_PLAYER_NAME = 'the stranger';

export const PARTY_STATUS = freeze({ ACTIVE: 'ACTIVE', DISBANDED: 'DISBANDED' });
export const PARTY_MEMBER_ROLE = freeze({ LEADER: 'LEADER', MEMBER: 'MEMBER', CAPTIVE: 'CAPTIVE' });
export const PARTY_INVITE_STATUS = freeze({ PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', DECLINED: 'DECLINED', EXPIRED: 'EXPIRED' });
export const TACTICS_ROLE = freeze({
  BALANCED: 'BALANCED',
  TANK: 'TANK',
  HEALER: 'HEALER',
  AGGRESSIVE: 'AGGRESSIVE',
  SUPPORT: 'SUPPORT',
});
export const VALID_TACTICS = freeze(Object.values(TACTICS_ROLE));
export const DEFAULT_TACTICS_ROLE = TACTICS_ROLE.BALANCED;
export const MAX_PARTY_SIZE = 4;
export const RECRUITED_COMPANION_RELATIONSHIP_SCORE = 50;
export const PARTY_TURN = freeze({
  ACTION_MAX_LENGTH: 1000,
  STRANGER_LABEL: 'A stranger',
  SUBAGENT_STRANGER_PREFIX: 'Stranger',
  NOT_LEADER_ERROR: 'Only the party leader can send the party turn.',
  EMPTY_ERROR: 'Write an action for at least one party member.',
  INVALID_MEMBER_ERROR: 'One of the party rows is not an online player in your party.',
  REVEAL_TARGET_ERROR: 'Select the NPC to reveal real names to.',
});
export const PARTY_PRESENCE = freeze({ NAVIGATION_GRACE_MS: 5000 });
export const PARTY_MOVEMENT = freeze({ FOLLOWER_BLOCKED_ERROR: 'You are travelling with a party. Only the party leader can move the party.' });
export const SAME_LOCATION_PARTY_ERROR = 'Players must be in the same location and sublocation to form a party.';

export const QUEST_STATUS = freeze({ AVAILABLE: 'AVAILABLE', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', FAILED: 'FAILED' });
export const QUEST_TYPE = freeze({ COLLECT: 'COLLECT', ELIMINATE: 'ELIMINATE', CAPTURE: 'CAPTURE' });
export const MAX_ACTIVE_QUESTS = 5;

export const DIALOGUE_SESSION_TYPE = freeze({ DIRECT: 'DIRECT', GROUP: 'GROUP', AMBIENT: 'AMBIENT' });
export const DIALOGUE_SESSION_STATUS = freeze({ ACTIVE: 'ACTIVE', PAUSED: 'PAUSED', CLOSED: 'CLOSED' });
export const DIALOGUE_MESSAGE_TYPE = freeze({ SPEECH: 'SPEECH', ACTION: 'ACTION', NARRATION: 'NARRATION' });
export const DIALOGUE_PARTICIPANT_ROLE = freeze({ PLAYER: 'PLAYER', NPC: 'NPC' });
export const DIALOGUE_HISTORY_LIMIT = 10;
export const ROLEPLAY_HISTORY_MESSAGES = 10;
export const ROLEPLAY_HISTORY_MESSAGE_MAX_LENGTH = 400;
export const ROLEPLAY_HISTORY_NARRATION_EXCERPT_LENGTH = 200;
export const PLAYER_TOOL = freeze({
  INSPECT_CURRENT_LOCATION: 'inspect_current_location',
  NPC_KNOWN_PLACES: 'npc_known_places',
  SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC: 'search_npc_in_relationship_with_npc'
});
export const PLAYER_TOOL_LIST = Object.freeze(Object.values(PLAYER_TOOL));
export const PLAYER_TOOLS_NEEDING_TARGET = Object.freeze([PLAYER_TOOL.NPC_KNOWN_PLACES, PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC]);
export const PLAYER_TOOL_NPC_NAME_MAX_LENGTH = 100;
export const DIALOGUE_PAUSE_TIMEOUT_MS = 15 * 60 * 1000;
export const GAME_TIME_SLOT = freeze({
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  EVENING: 'EVENING',
  NIGHT: 'NIGHT',
});

export const GAME_CLOCK = freeze({
  CYCLE_MS: 60 * 60 * 1000,
  SLOTS: freeze([
    freeze({ slot: GAME_TIME_SLOT.MORNING, label: 'Morning', durationMs: 24 * 60 * 1000 }),
    freeze({ slot: GAME_TIME_SLOT.AFTERNOON, label: 'Afternoon', durationMs: 12 * 60 * 1000 }),
    freeze({ slot: GAME_TIME_SLOT.EVENING, label: 'Evening', durationMs: 648 * 1000 }),
    freeze({ slot: GAME_TIME_SLOT.NIGHT, label: 'Night', durationMs: 792 * 1000 }),
  ]),
  BROADCAST_GRACE_MS: 250,
  PROMPT_GUIDANCE: freeze({
    MORNING: 'Daylight. Markets, workshops and guild halls are open; streets and inns are busy with travelers and workers.',
    AFTERNOON: 'Bright late day. Work continues, travelers arrive, shadows lengthen toward dusk.',
    EVENING: 'Dusk. Lamps and hearths are lit, shops are closing, taverns and inns fill with drinkers and storytellers.',
    NIGHT: 'Dark night. Streets are quiet and dim, most shops are shut, guards patrol, and danger and secrets are more likely outdoors.',
  }),
});

export const WEATHER_TYPE = freeze({
  CLEAR: 'CLEAR',
  SUNNY: 'SUNNY',
  RAIN: 'RAIN',
  HEAVYRAIN: 'HEAVYRAIN',
  STORM: 'STORM',
  FOG: 'FOG',
});

export const LOCATION_WEATHER = freeze({
  MIN_DURATION_MS: 15 * 60 * 1000,
  MAX_DURATION_MS: 30 * 60 * 1000,
  SWEEP_INTERVAL_MS: 60 * 1000,
  INITIAL_WEIGHTS: freeze({ CLEAR: 50, SUNNY: 20, RAIN: 15, HEAVYRAIN: 7, STORM: 3, FOG: 5 }),
  TRANSITIONS: freeze({
    CLEAR: freeze({ CLEAR: 55, SUNNY: 20, RAIN: 18, HEAVYRAIN: 7 }),
    SUNNY: freeze({ SUNNY: 60, CLEAR: 40 }),
    RAIN: freeze({ RAIN: 35, CLEAR: 40, HEAVYRAIN: 15, STORM: 10 }),
    HEAVYRAIN: freeze({ HEAVYRAIN: 30, CLEAR: 35, STORM: 20, FOG: 15 }),
    STORM: freeze({ STORM: 15, RAIN: 60, FOG: 25 }),
    FOG: freeze({ CLEAR: 100 }),
  }),
  LABELS: freeze({ CLEAR: 'Clear', SUNNY: 'Sunny', RAIN: 'Rain', HEAVYRAIN: 'Heavy Rain', STORM: 'Storm', FOG: 'Fog' }),
  NIGHT_LABELS: freeze({ SUNNY: 'Clear' }),
  PROMPT_GUIDANCE: freeze({
    CLEAR: 'Clear skies and calm air.',
    SUNNY: 'Bright sunshine and warm air.',
    RAIN: 'Steady rain; wet streets, dripping eaves, people hurrying under cover.',
    HEAVYRAIN: 'Heavy downpour; poor visibility, flooded paths, most people stay indoors.',
    STORM: 'Violent storm; thunder, lightning and howling wind, travel outdoors is miserable and dangerous.',
    FOG: 'Thick fog; sounds are muffled and shapes vanish beyond a few paces.',
  }),
  NIGHT_PROMPT_GUIDANCE: freeze({
    CLEAR: 'Clear night sky with visible stars and moonlight.',
    SUNNY: 'Clear night sky with visible stars and moonlight; the day was sunny and warm.',
  }),
});

export const CROWD_LEVEL = freeze({ EMPTY: 'EMPTY', FEW: 'FEW', SOME: 'SOME', BUSY: 'BUSY', PACKED: 'PACKED' });
export const ANY_TIME_SLOT = 'ANY';

export const AMBIENCE = freeze({
  MAX_FIGURES: 10,
  MAX_WEIGHT: 1000,
  TITLE_MAX_LENGTH: 120,
  FIGURE_LABEL_MAX_LENGTH: 120,
  CROWD_LABELS: freeze({ EMPTY: 'empty', FEW: 'quiet, with only a few people', SOME: 'moderately busy', BUSY: 'busy', PACKED: 'packed' }),
});

export const DIALOGUE_EXPIRY_SWEEP_INTERVAL_MS = 60 * 1000;
export const DIALOGUE_SUMMARY_DELAY_MS = 1000;
export const DIALOGUE_SUMMARY_MAX_PAUSE_AGE_MS = 60 * 60 * 1000;
export const DIALOGUE_SUMMARY_MESSAGE_LIMIT = 30;
export const DIALOGUE_SUMMARY_TRANSCRIPT_MAX_LENGTH = 6000;
export const DIALOGUE_LEAVE_CHOICE = freeze({ PAUSE: 'PAUSE', CLOSE: 'CLOSE' });
export const DIALOGUE_FAREWELL_PATTERN = /\b(?:good\s*-?\s*bye|bye(?:\s*-?\s*bye)?|farewell|see\s+(?:you|ya|u)(?:\s+(?:soon|later|again|around|tomorrow|next\s+time))?|take\s+care|until\s+next\s+time|catch\s+you\s+later|so\s+long|i(?:'m|\s+am)\s+(?:leaving|moving\s+(?:out|on)|heading\s+(?:out|off)|off\s+now|going\s+now)|i\s+(?:must|should|have\s+to|need\s+to|gotta|got\s+to)\s+(?:go|leave|be\s+going|head\s+out|move\s+on)|gotta\s+go|time\s+(?:for\s+me\s+)?to\s+(?:go|leave))\b|tạm\s+biệt|hẹn\s+gặp\s+lại|chào\s+nhé/i;
export const DIALOGUE_FAREWELL_NEGATION_PATTERN = /\b(?:not|never|don'?t|won'?t|can'?t|isn'?t|aren'?t)\s+(?:\w+\s+){0,2}(?:leav|go\b|going|say(?:ing)?\s+(?:good\s*bye|bye)|bye)|\b(?:before|if|when|unless)\s+(?:i|you|we)\s+(?:\w+\s+){0,2}(?:leave|go|say)|\btake\s+care\s+of\b|\bhe\s+said|\bshe\s+said|\bthey\s+said/i;

export const BATTLE_STATUS = freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
  FLED: 'FLED',
});

export const VAULT_TRANSFER_DIRECTION = freeze({ DEPOSIT: 'deposit', WITHDRAW: 'withdraw' });
export const VALID_VAULT_TRANSFER_DIRECTIONS = freeze(Object.values(VAULT_TRANSFER_DIRECTION));

export const BASE_ATTRIBUTE_VALUE = 5;
export const ATTRIBUTE_POINTS_PER_COST_STEP = 5;
export const INITIAL_ATTRIBUTE_POINT_BUDGET = 45;
export const ATTRIBUTE_POINTS_PER_LEVEL = 5;
export const UPGRADEABLE_STATS = freeze(['intelligent', 'strength', 'dexterity', 'charisma', 'constitution', 'wisdom']);

export const DEFAULT_MAX_HP = 10;
export const DEFAULT_MAX_ENERGY = 100;
export const DEFAULT_MAX_FOOD = 100;
export const DEFAULT_MAX_WATER = 100;
export const DEFAULT_BACKPACK_SLOTS = 40;
export const DEFAULT_VAULT_SLOTS = 60;
export const DEFAULT_VAULT_TIER = 1;
export const DEFAULT_STARTING_GOLD = 1000;
export const DEFAULT_RESPAWN_LOCATION_ID = 1;

export const MAX_LEVEL = 10;
export const MAX_EXPERIENCE = 248300;
export const EXPERIENCE_THRESHOLDS = freeze({
  1: 0,
  2: 100,
  3: 350,
  4: 850,
  5: 2000,
  6: 5500,
  7: 11500,
  8: 28000,
  9: 65000,
  10: 135000,
});
export const PROFICIENCY_TIERS = freeze([
  freeze({ throughLevel: 4, proficiency: 2 }),
  freeze({ throughLevel: 8, proficiency: 3 }),
  freeze({ throughLevel: MAX_LEVEL, proficiency: 4 }),
]);
export const MAX_PROFICIENCY = 4;
export const SPELL_POINT_TIERS = freeze({
  1: freeze({ 1: 2 }),
  2: freeze({ 1: 2 }),
  3: freeze({ 1: 3, 2: 1 }),
  4: freeze({ 1: 3, 2: 1 }),
  5: freeze({ 1: 4, 2: 2 }),
  6: freeze({ 1: 4, 2: 2 }),
  7: freeze({ 1: 4, 2: 2 }),
  8: freeze({ 1: 4, 2: 3, 3: 1 }),
  9: freeze({ 1: 4, 2: 3, 3: 1 }),
  10: freeze({ 1: 4, 2: 3, 3: 1 }),
});
export const EXP_BONUS_PER_LEVEL_ABOVE_TEMPLATE = 0.15;

export const NPC_IDENTITY = Object.freeze({
  NAME_MAX_LENGTH: 60,
  INTRODUCTION_SUBJECT: Object.freeze({ SELF: 'self', PARTY: 'party' }),
});

export const AFFINITY_MIN = -400;
export const AFFINITY_MAX = 500;
export const HOSTILE_AFFINITY = AFFINITY_MIN;
export const RELATIONSHIP_STATUS = freeze({
  HOSTILE: 'HOSTILE',
  DISGUSTED: 'DISGUSTED',
  HATEFUL: 'HATEFUL',
  WARY: 'WARY',
  DISLIKE: 'DISLIKE',
  STRANGER: 'STRANGER',
  NEUTRAL: 'NEUTRAL',
  FRIENDLY: 'FRIENDLY',
  CONFIDANT: 'CONFIDANT',
  DEVOTED: 'DEVOTED',
});
export const AFFINITY_STATUS_THRESHOLDS = freeze([
  freeze({ max: -300, status: RELATIONSHIP_STATUS.HOSTILE }),
  freeze({ max: -150, status: RELATIONSHIP_STATUS.DISGUSTED }),
  freeze({ max: -101, status: RELATIONSHIP_STATUS.HATEFUL }),
  freeze({ max: -51, status: RELATIONSHIP_STATUS.WARY }),
  freeze({ max: -1, status: RELATIONSHIP_STATUS.DISLIKE }),
  freeze({ max: 50, status: RELATIONSHIP_STATUS.STRANGER }),
  freeze({ max: 101, status: RELATIONSHIP_STATUS.NEUTRAL }),
  freeze({ max: 201, status: RELATIONSHIP_STATUS.FRIENDLY }),
  freeze({ max: 400, status: RELATIONSHIP_STATUS.CONFIDANT }),
]);
export const AFFINITY_PRICE_PENALTIES = freeze([
  freeze({ max: -101, multiplier: 1.5 }),
  freeze({ max: -51, multiplier: 1.25 }),
  freeze({ max: -1, multiplier: 1.1 }),
]);
export const AFFINITY_SERVICE_DISCOUNTS = freeze([
  freeze({ min: 400, multiplier: 0.7 }),
  freeze({ min: 201, multiplier: 0.85 }),
  freeze({ min: 101, multiplier: 0.95 }),
]);
export const RELATIONSHIP_HISTORY_LIMIT = 20;
export const RELATIONSHIP_NOTE_MAX_LENGTH = 500;

export const SHOP_SELL_PRICE_PERCENT = 70;

export const HUNGER_EFFECTS = freeze([
  freeze({ name: 'Hungry', effect_type: 'HUNGRY', threshold: 75, reduction: 15, description: 'Food at or below 75%: physical and magical damage dealt is reduced by 15%.' }),
  freeze({ name: 'Starving', effect_type: 'STARVING', threshold: 50, reduction: 30, description: 'Food at or below 50%: physical and magical damage dealt is reduced by 30%.' }),
  freeze({ name: 'Starvation', effect_type: 'STARVATION', threshold: 25, reduction: 60, description: 'Food at or below 25%: physical and magical damage dealt is reduced by 60%.' }),
]);
export const THIRST_EFFECTS = freeze([
  freeze({ name: 'Thirsty', effect_type: 'THIRSTY', threshold: 75, increase: 10, description: 'Water at or below 75%: skill energy costs increase by 10%, rounded up.' }),
  freeze({ name: 'Dehydrated', effect_type: 'DEHYDRATED', threshold: 50, increase: 20, description: 'Water at or below 50%: skill energy costs increase by 20%, rounded up.' }),
  freeze({ name: 'Severe_dehydration', effect_type: 'SEVERE_DEHYDRATION', threshold: 25, increase: 40, description: 'Water at or below 25%: skill energy costs increase by 40%, rounded up.' }),
]);
export const STATUS_LABEL_PREFIX = '- ';
export const STATUS_LABELS = freeze({
  NORMAL: '- Normal',
  KNOCKED_OUT: '- Knocked Out',
  DEFENDING: '- Defending',
  EVASIVE: '- Evasive',
});

export const RESOURCE_DEPLETION_MS = 120 * 60 * 1000;
export const RESOURCE_PERSIST_MS = 4 * 60 * 1000;

export const ELEMENTS = freeze(['fire', 'ice', 'earth', 'lightning', 'wind', 'holy', 'dark']);
export const COMBAT_STATUS_TYPE = freeze({
  STUN: 'STUN',
  DAZE: 'DAZE',
  WEAK: 'WEAK',
  BLIND: 'BLIND',
  POISON: 'POISON',
  TAUNT: 'TAUNT',
});
export const COMBAT_STATUS_TYPES = freeze(Object.values(COMBAT_STATUS_TYPE));
export const STATUS_DEFINITIONS = freeze({
  STUN: freeze({ duration: 1, value: 0, label: 'Stun' }),
  DAZE: freeze({ duration: 3, value: 0.3, label: 'Daze' }),
  WEAK: freeze({ duration: 3, value: 0.3, label: 'Weak' }),
  BLIND: freeze({ duration: 2, value: 0.75, label: 'Blind' }),
  POISON: freeze({ duration: 3, value: 0, label: 'Poison' }),
  TAUNT: freeze({ duration: 3, value: 0, label: 'Taunt' }),
});
export const DEFAULT_STATUS_PROC_CHANCE = 50;
export const GUARANTEED_PROC_CHANCE = 100;
export const STATUS_PROC_CHANCE_MIN = 5;
export const STATUS_PROC_CHANCE_MAX = 95;
export const DAZE_INITIATIVE_MULTIPLIER = 0.7;
export const DEFAULT_TAUNT_DURATION = 3;
export const COMBAT_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ENCOUNTER_ENEMIES = 5;
export const MAX_HOSTILE_ENCOUNTER_NPCS = 5;
export const AREA_COMBAT = freeze({
  NOT_HERE_ERROR: 'That target is not here to fight.',
  NPC_ONLY_ONE_ERROR: 'You can fight only one NPC at a time, without monsters.',
  LEADER_ONLY_ERROR: 'Only the party leader can start combat.'
});
export const NPC_LOOKUP_LIMIT = 50;
export const DEFAULT_INITIATIVE_VARIANCE = 3;
export const LEVELS_PER_INITIATIVE_BONUS = 5;
export const FIRST_STRIKE_THREAT_MULTIPLIER = 1.2;
export const ELEMENTAL_RESISTANCE_MIN = -50;
export const ELEMENTAL_RESISTANCE_MAX = 75;
export const DEFAULT_SKILL_HEAL_AMOUNT = 15;
export const DEFAULT_COMPANION_HP = 25;
export const MONSTER_EXP_PER_LEVEL = 30;
export const MIN_MONSTER_BASE_EXP = 10;
export const COMPANION_REVIVE_HP_RATIO = 0.3;
export const FLEE_RULES = freeze({
  BASE_CHANCE: 40,
  CHANCE_PER_DEXTERITY: 3,
  MIN_CHANCE: 10,
  MAX_CHANCE: 85,
  ENERGY_COST: 40,
});
export const RESPAWN_VITALS = freeze({ current_hp: 1, current_energy: 100, current_food: 20, current_water: 20 });
export const BATTLE_ACTION_FLEE = 'flee';
export const BASH_SKILL_NAME = 'BASH';
export const TAUNT_SKILL_NAME = 'TAUNT';
export const DODGE_SKILL_NAME = 'DODGE';
export const TRAINING_DUMMY = freeze({
  NAME: 'Training Dummy',
  SPRITE: '🎯',
  INFINITE_HP: 1000000000,
  MAX_HP: 1000000,
  MAX_DEFENSE: 1000,
  DEFAULT_ARMOR: 5,
  DEFAULT_MAGIC_ARMOR: 4,
  DEFAULT_EVADE: 10,
  DEFAULT_STATUS_RESIST: 4
});
export const EVADE_RULES = freeze({
  BASE_PCT: 10,
  DEX_BASELINE: 5,
  PCT_PER_DEX: 1,
  LEVEL_GAP_THRESHOLD: 3,
  PCT_PER_LEVEL_GAP: 10,
  DODGE_BONUS_PCT: 15,
  DAZE_PENALTY_PCT: 25,
  BASE_ACCURACY: 1,
  BLIND_ACCURACY_PENALTY: 75,
  CAP_PCT: 85
});

export const NPC_COMBAT_AI = freeze({
  CAUTIOUS_DAMAGE_RATIO: 0.2,
  CAUTIOUS_TURNS: 2,
  DESPERATE_HP_RATIO: 0.15,
  HEALER_HEAL_THRESHOLD: 0.75,
  DEFAULT_HEAL_THRESHOLD: 0.45,
  ALLY_DANGER_HP_RATIO: 0.4,
  TANK_SELF_DEFEND_HP_RATIO: 0.35,
  BALANCED_FOCUS_LOWEST_CHANCE: 0.6,
  DESPERATE_BEST_SKILL_CHANCE: 0.8,
  CAUTIOUS_AFTER_DEFEND_SCALE: 0.65,
  CAUTIOUS_BASIC_CHANCE: 0.2,
  CAUTIOUS_OFFENSIVE_CHANCE: 0.65,
  AGGRESSIVE_BASIC_CHANCE: 0.4,
  FALLBACK_DAMAGE_ESTIMATE: 10,
});
export const NPC_AI_STATE = freeze({ DESPERATE: 'Desperate', CAUTIOUS: 'Cautious', AGGRESSIVE: 'Aggressive' });
export const NPC_BASIC_ATTACK = freeze({ id: 'npc_basic_attack', name: 'Basic Strike', type: SKILL_MENU_TYPE.ATTACK, skill_target_rule: SKILL_TARGET_RULE.ON_SELECTED_ENEMY, skill_damage_type: SKILL_DAMAGE_TYPE.PHYSICAL, attack_amplifier: 1 });
export const NPC_BASIC_DEFENSE = freeze({ id: 'npc_defend', name: 'Defend', type: SKILL_MENU_TYPE.DEFEND, skill_target_rule: SKILL_TARGET_RULE.SELF_ONLY, armor_amplifier: 2, magical_armor_amplifier: 2 });
export const BASIC_STRIKE_NAMES = freeze(['basic strike', 'strike']);

export const HEALTH_LABEL_THRESHOLDS = freeze({ HEALTHY: 0.75, WOUNDED: 0.3 });

export const UPGRADE_BASE_GOLD_COST = 2500;
export const UPGRADE_RARITY_COST = freeze({ NORMAL: 1500, UNCOMMON: 2250, RARE: 3500, UNIQUE: 6000, MYSTIC: 8000, LEGENDARY: 15000, ANCIENT: 30000 });
export const UPGRADE_MATERIAL_CATEGORY = freeze({ WEAPON: 'WEAPON', ARMOR: 'ARMOR', ACCESSORY: 'ACCESSORY' });
export const UPGRADE_MATERIAL_NAMES = freeze({
  WEAPON: freeze({ NORMAL: 'weapon upgrade stone' }),
  ARMOR: freeze({ NORMAL: 'armor upgrade stone' }),
  ACCESSORY: freeze({}),
});
export const UPGRADE_RATES = freeze({
  TWO_HAND: 0.10,
  MAIN_HAND: 0.08,
  ARMOR: 0.035,
  HELMET: 0.02,
  GLOVES: 0.02,
  SHOES: 0.02,
  EARRING: 0.015,
  RING: 0.015,
  NECKLACE: 0.015,
  BELT: 0.015,
});

export const LIFESKILL_NAMES = freeze({ FARMING: 'Farming', GATHERING: 'Gathering', FISHING: 'Fishing', COOKING: 'Cooking', PROCESSING: 'Processing', CRAFTING: 'Crafting', ALCHEMY: 'Alchemy' });
export const LIFESKILL_DESCRIPTIONS = freeze({
  FARMING: 'Cultivate seeds into crops and agricultural bounties.',
  GATHERING: 'Collect raw materials from nature like herbs and wood and stuffs.',
  FISHING: 'Catch fish from rivers, lakes, and oceans.',
  COOKING: 'Prepare food that restores survival resources.',
  PROCESSING: 'Refine raw materials into processed goods.',
  CRAFTING: 'Crafting Items',
  ALCHEMY: 'Prepare potions to provide buffs and recover stats.',
});
export const LIFESKILL_RANKS = freeze([
  freeze({ above: 80, title: 'Guru' }),
  freeze({ above: 50, title: 'Master' }),
  freeze({ above: 40, title: 'Artisan' }),
  freeze({ above: 30, title: 'Professional' }),
  freeze({ above: 20, title: 'Skilled' }),
  freeze({ above: 10, title: 'Apprentice' }),
]);
export const LIFESKILL_DEFAULT_RANK = 'Beginner';
export const LIFESKILL_EXP_PER_LEVEL = 200;
export const LIFESKILL_MASTERY_PER_LEVEL = 10;
export const LIFESKILL_FORMULAS = freeze({
  UNCOMMON_CHANCE: freeze({ base: 35, perLevel: 0.5, cap: 75 }),
  RARE_CHANCE: freeze({ base: 5, perLevel: 1.0, cap: 45 }),
  LEGENDARY_CHANCE: freeze({ base: 1, perLevel: 0.2, cap: 15 }),
  FREE_ENERGY_CHANCE: freeze({ levelsPerStep: 5, perStep: 3.5, cap: 35 }),
  BONUS_YIELD_CHANCE: freeze({ perLevel: 1.2, cap: 50 }),
  SUCCESS_RATE_BONUS: freeze({ perLevel: 0.5, cap: 20 }),
  MAX_YIELD_CHANCE: freeze({ base: 10, perLevel: 1.0, cap: 80 }),
});
export const RECIPE_LIFESKILL_NAMES = freeze([LIFESKILL_NAMES.PROCESSING, LIFESKILL_NAMES.CRAFTING, LIFESKILL_NAMES.COOKING, LIFESKILL_NAMES.ALCHEMY]);
export const LIFESKILL_RECIPE_DURATION_SECONDS = 30;
export const LIFESKILL_RECIPE_ENERGY_COST = 1;
export const LIFESKILL_TIER_EXP = freeze({ TIER_1: 10, TIER_2: 25, TIER_3: 50 });
export const MASS_PROCESS_MAX_QUANTITY = 50;
export const MASS_PROCESS_UNLOCK_RANKS = freeze(['Master', 'Guru']);
export const MASS_PROCESS_UNLOCK_LEVEL = 51;
export const LIFESKILL_BONUS_YIELD_QUANTITY = 1;
export const GATHERING_ENERGY_COST = 1;
export const GATHERING_BASE_EXP = 20;
export const GATHERING_RARE_BONUS_EXP = 35;
export const AMBUSH_CHANCE = freeze({ basePct: 10, perEnergyPct: 1.125, capPct: 55 });
export const CAMPING_TENT_ITEM_NAME = 'Camping Tent';
export const CAMPFIRE_REST_MODES = freeze({ REST: 'rest', TENT: 'tent' });
export const COMMON_GATHERING_LOOT_GROUP = 'Gathering - Common';
export const GATHERING_LOOT_GROUP_SUFFIX = 'Gathering';
export const FISHING_LOOT_GROUP_SUFFIX = 'Fishing';
export const FISHING_ENERGY_COST = 1;
export const FISHING_BASE_EXP = 20;
export const FISHING_RARE_BONUS_EXP = 35;
export const GATHERING_LEVEL_DROP_BONUS_PCT = 0.5;
export const DEFAULT_FARMING_EXP_REWARD = 25;
export const DEFAULT_FARMING_ENERGY_COST = 1;
export const DEFAULT_RECIPE_DURATION_SECONDS = 60;
export const DEFAULT_SEED_PRICE = 5;
export const ENERGY_POTION = freeze({ name: 'Energy Potion', price: 400, energyRestore: 15, maxStack: 5, shopSublocationName: "Honey Zanla's Inn" });
export const MAX_SEED_PURCHASE_QUANTITY = 999;

export const STARTING_REGION = freeze({
  name: 'Zaun Kingdom',
  description: 'One of 5 Region of Stervian Land',
  geography: 'fertile land with many plains and grasslands, and vast stretches of green fields',
  politics: 'non-xenophobic, neutral',
  culture: 'follow the God of Harvest - Zarmin, and the god of Knowledge Nasus',
});
export const STARTING_LOCATION = freeze({
  name: 'Honeywood Village',
  description: 'A peaceful farming village surrounded by golden fields, gentle streams, and welcoming homes where travelers rest beneath honey-scented trees.',
  is_safe_zone: true,
});
export const CHARACTER_FIELD_MAX_LENGTHS = freeze({ name: 20, race: 10, sex: 10, job: 100, alignment: 20, appearance: 5000, description: 5000 });
export const CHARACTER_MIN_AGE = 12;
export const CHARACTER_MAX_AGE = 999;
export const STARTER_LIFESKILLS = freeze([
  freeze({ name: LIFESKILL_NAMES.COOKING, description: LIFESKILL_DESCRIPTIONS.COOKING }),
]);
export const STARTER_COMBAT_SKILLS = freeze(['Strike', 'Defend']);
export const STARTER_WEAPON_MAP = freeze({
  SWORD: 'Wooden Sword',
  BOW: 'Wooden Bow',
  STAFF: 'Wooden Staff',
  QUARTERSTAFF: 'Wooden Quarterstaff',
  AXE: 'Wooden Axe',
  SPEAR: 'Wooden Spear',
  GREATSWORD: 'Wooden GreatSword',
  SHORTSWORD: 'Wooden Short Sword',
  CLUB: 'Wooden Club',
  KNIFE: 'Wooden Knife',
});
export const STARTER_CONSUMABLES = freeze([
  freeze({ name: 'Bandage', alternates: freeze([]), quantity: 5 }),
  freeze({ name: 'Small HP Potion', alternates: freeze(['Small HP potions', 'Minor Health Potion']), quantity: 5 }),
  freeze({ name: 'Bread', alternates: freeze([]), quantity: 5 }),
  freeze({ name: 'Bottle of water', alternates: freeze(['Bottle of Water']), quantity: 5 }),
]);

export const DEFAULT_AI_MODEL = 'deepseek-flash';
export const PROMPT_ROLE = freeze({ MASTER: 'master', NARRATION: 'narration' });
export const AGENT_PIPELINE = freeze({
  NPC_SLOT_TOKEN: '{{NPC_SLOT}}',
  BEAT_PATTERN: /\[\[BEAT:\s*([\s\S]*?)\]\]/i,
  ROLEPLAY_TOOL: 'roleplay_npc',
  ROLEPLAY_PARTY_TOOL: 'roleplay_npc_party',
});
export const OBSERVE_MODE = freeze({
  MIN_REPEAT: 1,
  MAX_REPEAT: 3,
  DEFAULT_REPEAT: 1,
  DIRECTION_MAX_LENGTH: 1000,
  SLOT_TOKEN_PREFIX: '{{OBSERVE_SLOT_',
  SLOT_TOKEN_SUFFIX: '}}',
  SLOT_PATTERN_SOURCE: '\\{\\{OBSERVE_SLOT_(\\d+)\\}\\}',
  ACTION_LABEL: 'Observe',
  HISTORY_TURNS: 8,
  DESCRIPTION_MAX_LENGTH: 600,
  MEMORY_LIMIT: 5,
  DEFAULT_INTENT: 'React in character to what {other} just said or did.',
});
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4';
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const PLACEHOLDER_DEEPSEEK_API_KEY = 'sk-mockup-deepseek-v4-apikey-replace-me';
export const DEEPSEEK_CONTEXT_WINDOW_TOKENS = 1000000;
export const AI_API_KEY_HEADER = 'x-ai-api-key';
export const AI_API_KEY_MAX_LENGTH = 512;
export const AI_API_KEY_MISSING_MESSAGE = 'No AI API key set. Click "Enter AI API key" and paste your DeepSeek API key.';
export const AI_DEFAULTS = freeze({
  TEMPERATURE: 0.7,
  ANTHROPIC_TEMPERATURE: 0.9,
  TOP_P: 0.95,
  TOP_K: 40,
  MAX_TOKENS: 4000,
  HARNESS_MAX_TOKENS: 2500,
  COMPLETION_MAX_TOKENS: 2000,
  TIMEOUT_MS: 45000,
});
export const ANTHROPIC_API_VERSION = '2023-06-01';
export const TOKENIZER_ENCODING = 'cl100k_base';
export const MAX_HARNESS_ITERATIONS = 4;
export const HARNESS_STEP_STATUS = freeze({ SUCCESS: 'SUCCESS', FAILED: 'FAILED', PARTIAL_ERROR: 'PARTIAL_ERROR' });
export const HARNESS_LOG_DIRECTORY = freeze(['logs', 'harness']);
export const NPC_ROLE = freeze({ WORLD_NPC: 'WORLD_NPC', COMPANION: 'COMPANION', HOSTILE_ENEMY: 'HOSTILE_ENEMY' });
export const MEMORY_PROMPT_NARRATION_MAX_LENGTH = 500;
export const MEMORY_ACTION_SNIPPET_MAX_LENGTH = 40;
export const DEFAULT_MAX_WINDOW_TURNS = 15;
export const HISTORY_PRUNE_STEP = 10;
export const DEFAULT_MAX_SCOPED_NPCS = 5;
export const DEFAULT_MAX_NPC_MEMORIES = 4;
export const CROWD_OVERFLOW_THRESHOLD = 10;

export const WEAPON_TYPE = freeze({
  SWORD: 'SWORD',
  BOW: 'BOW',
  STAFF: 'STAFF',
  QUARTERSTAFF: 'QUARTERSTAFF',
  AXE: 'AXE',
  SPEAR: 'SPEAR',
  CLUB: 'CLUB',
  GREATSWORD: 'GREATSWORD',
  SHORTSWORD: 'SHORTSWORD',
  KNIFE: 'KNIFE',
  SHIELD: 'SHIELD',
});
export const EFFECT_TYPE = freeze({
  NONE: 'NONE',
  BUFF: 'BUFF',
  CURE: 'CURE',
  HEALING: 'HEALING',
  RECOVERY: 'RECOVERY',
  STUN: 'STUN',
  DAZE: 'DAZE',
  WEAK: 'WEAK',
  BLIND: 'BLIND',
  POISON: 'POISON',
  HUNGRY: 'HUNGRY',
  STARVING: 'STARVING',
  STARVATION: 'STARVATION',
  THIRSTY: 'THIRSTY',
  DEHYDRATED: 'DEHYDRATED',
  SEVERE_DEHYDRATION: 'SEVERE_DEHYDRATION',
  TAUNT: 'TAUNT',
});
export const LOCATION_TYPE = freeze({
  VILLAGE: 'VILLAGE',
  TOWN: 'TOWN',
  CAPITAL: 'CAPITAL',
  FORTRESS: 'FORTRESS',
  STRONGHOLD: 'STRONGHOLD',
  DANGER_FIELD: 'DANGER_FIELD',
  HUNTING_FIELD: 'HUNTING_FIELD',
  DUNGEON: 'DUNGEON',
});
export const EFFECT_TRIGGER_RULE = freeze({ NONE: 'NONE', ...SKILL_TARGET_RULE });
export const TIER = freeze({ TIER_1: 'TIER_1', TIER_2: 'TIER_2', TIER_3: 'TIER_3', TIER_4: 'TIER_4' });
export const AFFIX_KIND = freeze({ PREFIX: 'prefix', SUFFIX: 'suffix', BOTH: 'both' });
export const ITEM_LOCATION_FILTER_ALL = 'ALL';

export const MCP_DB = freeze({
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MAX_FILTERS: 20,
  MAX_IN_VALUES: 100,
  MAX_TEXT_LENGTH: 500,
  MAX_STORY_LENGTH: 100000,
  MAX_KEY_TEXT_LENGTH: 191,
  MAX_DIALOGUE_MESSAGE_IDS: 200,
  MATCH_ALL: 'all',
  MATCH_ANY: 'any',
  SORT_ASC: 'asc',
  SORT_DESC: 'desc',
});
export const MCP_DB_FIELD_TYPE = freeze({
  STRING: 'String',
  INT: 'Int',
  FLOAT: 'Float',
  BOOLEAN: 'Boolean',
  DATE_TIME: 'DateTime',
  ENUM: 'Enum',
  JSON_DATA: 'Json',
  BYTES: 'Bytes',
});
export const MCP_DB_OPERATOR = freeze({
  EQUALS: 'equals',
  NOT: 'not',
  CONTAINS: 'contains',
  STARTS_WITH: 'startsWith',
  ENDS_WITH: 'endsWith',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IN: 'in',
  IS_NULL: 'isNull',
});
export const MCP_DB_MESSAGES = freeze({
  NOT_FOUND: 'No matching record found.',
  UNKNOWN_TABLE: 'Unknown table. Call list_tables to see the available tables.',
  STORY_CHARACTER_NOT_FOUND: 'Story denied: character_id does not match an active character.',
  STORY_CHARACTER_NO_USER: 'Story denied: that character has no user_id (NPCs cannot own stories).',
  STORY_OWNER_MISMATCH: 'Story denied: user_id does not own that character.',
  STORY_LOCATION_NOT_FOUND: 'Story denied: location_id does not match an active location.',
  STORY_SUBLOCATION_NOT_FOUND: 'Story denied: sublocation_id does not match an active sublocation.',
  STORY_SUBLOCATION_MISMATCH: 'Story denied: sublocation_id is not inside location_id.',
  STORY_DIALOGUE_NOT_FOUND: 'Story denied: dialogue_session_id does not exist.',
  STORY_DIALOGUE_MISMATCH: 'Story denied: that dialogue session belongs to another character.',
  STORY_MESSAGES_NEED_SESSION: 'Story denied: dialogue_message_ids need a dialogue_session_id.',
  STORY_MESSAGES_MISMATCH: 'Story denied: some dialogue_message_ids are not in that dialogue session.',
  STORY_NOTHING_TO_UPDATE: 'Provide at least one field to update.',
});


// D&D 5e skills for story-mode checks. Each skill is tied to one ability score.
export const SKILLS_FOR_STORY_PLAYING = freeze({
  athletics: freeze({ key: 'athletics', name: 'Athletics', ability: 'str', description: 'Climb, jump, swim, force a door, grapple' }),
  acrobatics: freeze({ key: 'acrobatics', name: 'Acrobatics', ability: 'dex', description: 'Balance, tumble, escape a grab' }),
  sleight_of_hand: freeze({ key: 'sleight_of_hand', name: 'Sleight of Hand', ability: 'dex', description: 'Pickpocket, plant an item, palm a key' }),
  stealth: freeze({ key: 'stealth', name: 'Stealth', ability: 'dex', description: 'Sneak, hide, tail someone' }),
  arcana: freeze({ key: 'arcana', name: 'Arcana', ability: 'int', description: 'Recognize magic, runes, spells' }),
  history: freeze({ key: 'history', name: 'History', ability: 'int', description: 'Recall lore, factions, ruins' }),
  investigation: freeze({ key: 'investigation', name: 'Investigation', ability: 'int', description: 'Deduce from clues, search a room methodically' }),
  nature: freeze({ key: 'nature', name: 'Nature', ability: 'int', description: 'Plants, animals, weather, terrain' }),
  religion: freeze({ key: 'religion', name: 'Religion', ability: 'int', description: 'Gods, rites, undead, holy symbols' }),
  animal_handling: freeze({ key: 'animal_handling', name: 'Animal Handling', ability: 'wis', description: 'Calm or control animals and mounts' }),
  insight: freeze({ key: 'insight', name: 'Insight', ability: 'wis', description: 'Read intentions, detect lies' }),
  medicine: freeze({ key: 'medicine', name: 'Medicine', ability: 'wis', description: 'Stabilize, diagnose, identify poison' }),
  perception: freeze({ key: 'perception', name: 'Perception', ability: 'wis', description: 'Notice hidden people, sounds, traps' }),
  survival: freeze({ key: 'survival', name: 'Survival', ability: 'wis', description: 'Track, forage, navigate, predict weather' }),
  deception: freeze({ key: 'deception', name: 'Deception', ability: 'cha', description: 'Lie, bluff, disguise' }),
  intimidation: freeze({ key: 'intimidation', name: 'Intimidation', ability: 'cha', description: 'Threaten, coerce' }),
  performance: freeze({ key: 'performance', name: 'Performance', ability: 'cha', description: 'Sing, act, entertain a crowd' }),
  persuasion: freeze({ key: 'persuasion', name: 'Persuasion', ability: 'cha', description: 'Convince, negotiate, charm' }),
});

export const ABILITY_STAT_FIELDS = freeze({ str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligent', wis: 'wisdom', cha: 'charisma' });
export const SKILL_ROLL_MODE = freeze({ NORMAL: 'NORMAL', ADVANTAGE: 'ADVANTAGE', DISADVANTAGE: 'DISADVANTAGE' });
export const CHECK_ORDER = freeze({ SKILL_FIRST: 'SKILL_FIRST', FATE_FIRST: 'FATE_FIRST' });
export const SKILL_CHECK = freeze({
  DIE_SIDES: 20,
  DC_MIN: 1,
  DC_MAX: 30,
  DC_DEFAULT: 15,
  MODIFIER_SOFT_CAP_SCORE: 20,
  POINTS_PER_BONUS_ABOVE_CAP: 10,
  PENDING_TTL_MS: 5 * 60 * 1000,
  SECRET_REVEAL_SKILLS: freeze(['intimidation', 'persuasion', 'deception', 'insight']),
});
export const SKILL_CHECK_RESULT = freeze({
  CRITICAL_SUCCESS: 'CRITICAL_SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  CRITICAL_FAILURE: 'CRITICAL_FAILURE',
});

export const CHAOS_FACTOR_MIN = 1;
export const CHAOS_FACTOR_MAX = 9;
export const DEFAULT_CHAOS_FACTOR = 5;
export const FATE_ODDS = freeze({
  CERTAIN: 'CERTAIN',
  NEARLY_CERTAIN: 'NEARLY_CERTAIN',
  VERY_LIKELY: 'VERY_LIKELY',
  LIKELY: 'LIKELY',
  FIFTY_FIFTY: 'FIFTY_FIFTY',
  UNLIKELY: 'UNLIKELY',
  VERY_UNLIKELY: 'VERY_UNLIKELY',
  NEARLY_IMPOSSIBLE: 'NEARLY_IMPOSSIBLE',
  IMPOSSIBLE: 'IMPOSSIBLE',
});
export const VALID_FATE_ODDS = freeze(Object.values(FATE_ODDS));
export const FATE_ODDS_LABELS = freeze({
  CERTAIN: 'Certain',
  NEARLY_CERTAIN: 'Nearly Certain',
  VERY_LIKELY: 'Very Likely',
  LIKELY: 'Likely',
  FIFTY_FIFTY: '50/50',
  UNLIKELY: 'Unlikely',
  VERY_UNLIKELY: 'Very Unlikely',
  NEARLY_IMPOSSIBLE: 'Nearly Impossible',
  IMPOSSIBLE: 'Impossible',
});
export const FATE_RESULT = freeze({
  EXCEPTIONAL_YES: 'EXCEPTIONAL_YES',
  YES: 'YES',
  NO: 'NO',
  EXCEPTIONAL_NO: 'EXCEPTIONAL_NO',
});
const fate = (exceptionalYes, yes, exceptionalNo) => freeze({ exceptionalYes, yes, exceptionalNo });
export const FATE_CHART = freeze({
  CERTAIN: freeze([fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96), fate(17, 85, 98), fate(18, 90, 99), fate(19, 95, 100), fate(20, 99, null), fate(20, 99, null), fate(20, 99, null)]),
  NEARLY_CERTAIN: freeze([fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96), fate(17, 85, 98), fate(18, 90, 99), fate(19, 95, 100), fate(20, 99, null), fate(20, 99, null)]),
  VERY_LIKELY: freeze([fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96), fate(17, 85, 98), fate(18, 90, 99), fate(19, 95, 100), fate(20, 99, null)]),
  LIKELY: freeze([fate(3, 15, 84), fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96), fate(17, 85, 98), fate(18, 90, 99), fate(19, 95, 100)]),
  FIFTY_FIFTY: freeze([fate(2, 10, 83), fate(3, 15, 84), fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96), fate(17, 85, 98), fate(18, 90, 99)]),
  UNLIKELY: freeze([fate(1, 5, 82), fate(2, 10, 83), fate(3, 15, 84), fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96), fate(17, 85, 98)]),
  VERY_UNLIKELY: freeze([fate(null, 1, 81), fate(1, 5, 82), fate(2, 10, 83), fate(3, 15, 84), fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94), fate(15, 75, 96)]),
  NEARLY_IMPOSSIBLE: freeze([fate(null, 1, 81), fate(null, 1, 81), fate(1, 5, 82), fate(2, 10, 83), fate(3, 15, 84), fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91), fate(13, 65, 94)]),
  IMPOSSIBLE: freeze([fate(null, 1, 81), fate(null, 1, 81), fate(null, 1, 81), fate(1, 5, 82), fate(2, 10, 83), fate(3, 15, 84), fate(5, 25, 86), fate(7, 35, 88), fate(10, 50, 91)]),
});

export const RANDOM_EVENT_FOCUS = freeze({
  REMOTE_EVENT: 'REMOTE_EVENT',
  AMBIGUOUS_EVENT: 'AMBIGUOUS_EVENT',
  NEW_NPC: 'NEW_NPC',
  NPC_ACTION: 'NPC_ACTION',
  NPC_NEGATIVE: 'NPC_NEGATIVE',
  NPC_POSITIVE: 'NPC_POSITIVE',
  MOVE_TOWARD_A_THREAD: 'MOVE_TOWARD_A_THREAD',
  MOVE_AWAY_FROM_A_THREAD: 'MOVE_AWAY_FROM_A_THREAD',
  CLOSE_A_THREAD: 'CLOSE_A_THREAD',
  PC_NEGATIVE: 'PC_NEGATIVE',
  PC_POSITIVE: 'PC_POSITIVE',
  CURRENT_CONTEXT: 'CURRENT_CONTEXT',
});
export const RANDOM_EVENT_FOCUS_FOR_STORY_TABLE = freeze([
  freeze({ min: 1, max: 5, focus: RANDOM_EVENT_FOCUS.REMOTE_EVENT, label: 'Remote Event', guidance: 'Something happens away from the player characters that they learn about or that will affect them later.' }),
  freeze({ min: 6, max: 10, focus: RANDOM_EVENT_FOCUS.AMBIGUOUS_EVENT, label: 'Ambiguous Event', guidance: 'Something strange or unclear happens whose meaning is not yet obvious.' }),
  freeze({ min: 11, max: 20, focus: RANDOM_EVENT_FOCUS.NEW_NPC, label: 'New NPC', guidance: 'A new person enters the scene; use a crowd figure from the ambience or a canonical NPC present at this location.' }),
  freeze({ min: 21, max: 40, focus: RANDOM_EVENT_FOCUS.NPC_ACTION, label: 'NPC Action', guidance: 'An NPC already in the scene takes an independent action.' }),
  freeze({ min: 41, max: 45, focus: RANDOM_EVENT_FOCUS.NPC_NEGATIVE, label: 'NPC Negative', guidance: 'Something bad happens to an NPC in the scene.' }),
  freeze({ min: 46, max: 50, focus: RANDOM_EVENT_FOCUS.NPC_POSITIVE, label: 'NPC Positive', guidance: 'Something good happens to an NPC in the scene.' }),
  freeze({ min: 51, max: 55, focus: RANDOM_EVENT_FOCUS.MOVE_TOWARD_A_THREAD, label: 'Move Toward A Thread', guidance: 'Something happens that brings the player closer to the goal of the referenced scene.' }),
  freeze({ min: 56, max: 65, focus: RANDOM_EVENT_FOCUS.MOVE_AWAY_FROM_A_THREAD, label: 'Move Away From A Thread', guidance: 'Something happens that sets back progress on the goal of the referenced scene.' }),
  freeze({ min: 66, max: 70, focus: RANDOM_EVENT_FOCUS.CLOSE_A_THREAD, label: 'Close A Thread', guidance: 'The referenced scene reaches an ending, for better or worse; record the outcome with an update_scene note and leave marking it solved to the player.' }),
  freeze({ min: 71, max: 80, focus: RANDOM_EVENT_FOCUS.PC_NEGATIVE, label: 'PC Negative', guidance: 'Something bad happens to the player character.' }),
  freeze({ min: 81, max: 85, focus: RANDOM_EVENT_FOCUS.PC_POSITIVE, label: 'PC Positive', guidance: 'Something good happens to the player character.' }),
  freeze({ min: 86, max: 100, focus: RANDOM_EVENT_FOCUS.CURRENT_CONTEXT, label: 'Current Context', guidance: 'Something happens that follows naturally from the current situation.' }),
]);
export const THREAD_EVENT_FOCUSES = freeze([
  RANDOM_EVENT_FOCUS.MOVE_TOWARD_A_THREAD,
  RANDOM_EVENT_FOCUS.MOVE_AWAY_FROM_A_THREAD,
  RANDOM_EVENT_FOCUS.CLOSE_A_THREAD,
]);
export const FATE_CHECK = freeze({
  QUESTION_MAX_LENGTH: 300,
  PENDING_TTL_MS: 5 * 60 * 1000,
  DIE_SIDES: 100,
  EXCEPTIONAL_YES_CHAOS_DELTA: -1,
  EXCEPTIONAL_NO_CHAOS_DELTA: 1,
});

export const SCENE_STAGE = freeze({ ON_GOING: 'on_going', ABANDONED: 'abandoned', SOLVED: 'solved' });
export const VALID_SCENE_STAGES = freeze(Object.values(SCENE_STAGE));
export const MAX_ONGOING_SCENES = 10;
export const SOLVED_SCENES_DISPLAY_LIMIT = 10;
export const SCENE_FIELD_MAX_LENGTHS = freeze({ scene_goal: 500, scene_notes: 3000 });
export const SCENE_AFFINITY_REWARD = freeze({ MIN: -100, MAX: 100 });
export const SCENE_LIMIT_ERROR = `You can only have ${MAX_ONGOING_SCENES} on-going scenes. Solve or delete one first.`;
export const MEMORY_ADD_FROM = freeze({ AI_SUMMARIZE: 'AI_SUMMARIZE', ADMIN_SUMMARIZE_SCENES: 'ADMIN_SUMMARIZE_SCENES' });
export const SCENE_SUMMARY_MEMORY_TYPES = freeze([MEMORY_TYPE.SEMANTIC, MEMORY_TYPE.EPISODIC, MEMORY_TYPE.SECRET]);
export const SCENE_SUMMARY_MAX_SCENES = 5;
export const SCENE_SUMMARY_CONTENT_MAX_LENGTH = 1500;
