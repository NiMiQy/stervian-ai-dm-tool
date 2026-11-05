import prisma from '../prismaClient.js';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { retrieveNpcMemories as retrieveMemoryRecords, createNpcMemory, isMajorNpcMemoryEvent, redactPlayerNameFromMemory } from '../characterMemoryService.js';
import {
  CHARACTER_TYPE,
  CROWD_OVERFLOW_THRESHOLD,
  DEFAULT_MAX_NPC_MEMORIES,
  DEFAULT_MAX_SCOPED_NPCS,
  DEFAULT_MAX_WINDOW_TURNS,
  HEALTH_LABEL_THRESHOLDS,
  HISTORY_PRUNE_STEP,
  PARTY_MEMBER_ROLE,
} from '../../configs/constants.js';

/**
 * ============================================================================
 * STERVIAN AI DUNGEON - CONTEXT MANAGEMENT (CONTEXT MGMT)
 * ============================================================================
 * Manages the Token Budget, Relevance Scoping, and Memory Layering for the DM:
 * 1. Sliding Window: Keeps the last N (default: 6) turns verbatim.
 * 2. Party Silhouette Compression: Compresses 12-slot gear tables into 1-line silhouettes.
 * 3. Scoped Local NPCs: Caps local crowd to 3-4 prominent figures and prioritizes targeted NPCs.
 * 4. Target NPC Memory Injection: Injects top persistent memories when an NPC is engaged.
 * 5. Background Reflection Worker: Asynchronously distills memorable events into MySQL character_memories.
 */

export { CROWD_OVERFLOW_THRESHOLD, DEFAULT_MAX_NPC_MEMORIES, DEFAULT_MAX_SCOPED_NPCS, DEFAULT_MAX_WINDOW_TURNS };

/**
 * Keeps a recent window of the conversation history, pruned in steps.
 *
 * The window grows from `minTurns` up to `minTurns + pruneStep - 1` entries,
 * then drops `pruneStep` old entries at once. Between prunes the start of the
 * window stays the same, so the history prefix stays cacheable across turns.
 *
 * @param {Array} history - Full conversational history array (append-only)
 * @param {number} minTurns - Fewest entries kept once the history is long (default: 15)
 * @param {number} pruneStep - Entries dropped at once when the window is full (default: 10)
 * @returns {Object} { activeWindow: Array, prunedTurns: Array }
 */
export function applySlidingWindow(history = [], minTurns = DEFAULT_MAX_WINDOW_TURNS, pruneStep = HISTORY_PRUNE_STEP) {
  const list = Array.isArray(history) ? history : [];
  const step = Math.max(1, Math.trunc(pruneStep) || 1);

  if (list.length <= minTurns) {
    return { activeWindow: [...list], prunedTurns: [] };
  }

  const windowStart = Math.floor((list.length - minTurns) / step) * step;

  return {
    activeWindow: list.slice(windowStart),
    prunedTurns: list.slice(0, windowStart)
  };
}

/**
 * Computes a narrative health tier description from current and max HP.
 */
function getHealthTier(currentHp, maxHp) {
  if (typeof currentHp !== 'number' || typeof maxHp !== 'number' || maxHp <= 0) {
    return 'Condition Normal';
  }
  const ratio = currentHp / maxHp;
  if (ratio > HEALTH_LABEL_THRESHOLDS.HEALTHY) return 'Healthy';
  if (ratio > HEALTH_LABEL_THRESHOLDS.WOUNDED) return 'Wounded';
  return 'Severely Injured';
}

/**
 * Extracts a concise silhouette of visible weapon and armor.
 */
function extractEquipmentSilhouette(equipment = {}) {
  const weapon = equipment.left_hand?.name || equipment.right_hand?.name || 'Unarmed';
  const armor = equipment.armor?.name || 'Clothes';
  return `${weapon}, ${armor}`;
}

/**
 * Compresses party state from verbose 12-slot tables into dense, 1-line narrative silhouettes.
 * Reduces party token usage by up to 80% while strictly enforcing agency rules.
 *
 * @param {Object} party - Active party object
 * @param {Object} activeCharacter - The player character taking the current action
 * @returns {string} Formatted compact party block
 */
export function compressPartySilhouette(party, activeCharacter = null) {
  if (!party || !Array.isArray(party.members) || party.members.length <= 1) {
    return 'Traveling solo (No active party companions).';
  }

  const otherMembers = party.members.filter((m) => {
    if (activeCharacter?.id && m.character_id === activeCharacter.id) return false;
    if (activeCharacter?.name && m.name === activeCharacter.name) return false;
    return true;
  });

  if (!otherMembers.length) {
    return 'Traveling solo (No active party companions).';
  }

  const lines = otherMembers.map((m) => {
    const isHuman = m.is_player || m.character_type === CHARACTER_TYPE.PLAYER;
    const gear = extractEquipmentSilhouette(m.equipment);
    const health = getHealthTier(m.current_hp, m.max_hp);

    if (isHuman) {
      const roleTag = m.is_leader || m.role === PARTY_MEMBER_ROLE.LEADER ? 'Leader' : 'Member';
      return `* [REAL HUMAN PLAYER - DO NOT CONTROL] ${m.name} (${m.race || 'Human'}): Wields ${gear}. ${health}. (${roleTag})`;
    } else {
      const tactics = m.tactics_role ? ` [Tactics: ${m.tactics_role}]` : '';
      return `* [AI NPC COMPANION] ${m.name} (${m.race || 'NPC'}): Wields ${gear}.${tactics} ${health}.`;
    }
  });

  const introductionOrder = otherMembers
    .filter((m) => m.is_player || m.character_type === CHARACTER_TYPE.PLAYER)
    .map((m, index) => `#${index + 2} = ${m.name}`);

  return [
    `### Active Party: "${party.name || 'Adventuring Party'}" (Active: ${activeCharacter?.name || 'Leader'})`,
    lines.join('\n'),
    'Rules: Never control or speak for [REAL HUMAN PLAYER] characters.',
    ...(introductionOrder.length ? [`Introduction order for introduce_name_to_npc (subject "party"): ${introductionOrder.join(', ')}. When the leader introduces several members at once, the first name spoken belongs to #2, the next to #3, and so on. These are real character names for the narrator only; NPCs only know the names they are told.`] : [])
  ].join('\n');
}

/**
 * Scopes nearby NPCs to the top prominent figures in the immediate sublocation.
 * If the player's action specifically addresses an NPC by name, promotes them to the top.
 * Detects if the total crowd exceeds CROWD_OVERFLOW_THRESHOLD (10).
 *
 * @param {Array} npcs - List of nearby NPC objects
 * @param {string} actionText - The player's declared action
 * @param {number} maxNpcs - Maximum prominent NPCs to include (default: 5)
 * @returns {Object} { scopedNpcs: Array, targetNpc: Object|null, totalCount: number, hasCrowdOverflow: boolean }
 */
export function scopeLocalNpcs(npcs = [], actionText = '', maxNpcs = DEFAULT_MAX_SCOPED_NPCS) {
  if (!Array.isArray(npcs) || npcs.length === 0) {
    return { scopedNpcs: [], targetNpc: null, totalCount: 0, hasCrowdOverflow: false };
  }

  const totalCount = npcs.length;
  const hasCrowdOverflow = totalCount > CROWD_OVERFLOW_THRESHOLD;
  const cleanAction = String(actionText || '').toLowerCase();
  const actionWords = cleanAction.match(/[\p{L}\p{N}]+/gu) || [];
  let targetNpc = null;
  const prioritized = [];
  const remaining = [];

  for (const item of npcs) {
    const npcChar = item.character || item;
    const name = (npcChar.name || '').toLowerCase();

    const nameWords = name.match(/[\p{L}\p{N}]+/gu) || [];
    const isGenericWord = ['village', 'town', 'city', 'inn', 'square', 'market', 'road', 'forest', 'old', 'traveling', 'shadowy'].includes(nameWords[0]);
    const matchesDirect = nameWords.length > 0 && (
      actionWords.some((word, start) =>
        word === nameWords[0] && nameWords.every((nameWord, offset) => actionWords[start + offset] === nameWord)
      ) || (!isGenericWord && nameWords[0].length > 2 && actionWords.includes(nameWords[0]))
    );
    if (matchesDirect) {
      if (!targetNpc) {
        targetNpc = item;
      }
      prioritized.unshift(item); // Prioritize targeted NPC at the very top
    } else {
      remaining.push(item);
    }
  }

  const combined = [...prioritized, ...remaining];
  const scopedNpcs = combined.slice(0, maxNpcs);

  return {
    scopedNpcs,
    targetNpc,
    totalCount,
    hasCrowdOverflow
  };
}

/**
 * Formats scoped NPCs into clean micro-cards.
 * If crowd exceeds 10 NPCs, appends an exploration notice for the player.
 */
export function formatScopedNpcs(scopedNpcs = [], targetNpc = null, totalCount = 0) {
  if (!scopedNpcs.length) {
    return 'No notable figures nearby at this spot.';
  }

  const cards = scopedNpcs.map((item) => {
    const char = item.character || item;
    const isTarget = targetNpc && ((item.character_id && item.character_id === targetNpc.character_id) || char.name === targetNpc.character?.name);
    const targetTag = isTarget ? ' [ENGAGED IN CONVERSATION]' : '';
    const speakable = item.is_speakable !== false ? 'Speakable' : 'Silent';
    const briefAppearance = char.appearance ? `: ${char.appearance.slice(0, 100)}` : '';
    return `* ${char.name} (${char.race || 'Human'} ${char.job || 'NPC'})${targetTag} [${speakable}]${briefAppearance}`;
  });

  if (totalCount > CROWD_OVERFLOW_THRESHOLD) {
    cards.push(`*(Note: The area is bustling with a large crowd of over ${totalCount} people. Remind the player that there are other figures around waiting to be explored or spoken with.)*`);
  }

  return cards.join('\n');
}

/**
 * Retrieves top persistent memories for a targeted NPC.
 *
 * @param {number} npcCharacterId - Character ID of the NPC
 * @param {Object} db - Prisma database client
 * @param {number} limit - Max memories to retrieve (default: 4)
 * @returns {Promise<Array>} List of memory string facts
 */
export async function retrieveNpcMemories(npcCharacterId, db = prisma, limit = DEFAULT_MAX_NPC_MEMORIES, targetCharacterId = null, affinity = 0, playerName = '', nameRevealed = false) {
  if (!npcCharacterId) return [];
  try {
    const rows = await retrieveMemoryRecords({ db, npcCharacterId, targetCharacterId, limit, affinity });
    return rows
      .map((row) => redactPlayerNameFromMemory(row.content, playerName, nameRevealed))
      .filter(Boolean);
  } catch (error) {
    console.warn('Unable to retrieve NPC memories for context:', error.message);
    return [];
  }
}
/**
 * Background Asynchronous Worker:
 * Detects if a notable duel, trade, defeat, or deal occurred with an NPC,
 * distills a 1-sentence memory fact, and persists to MySQL character_memories.
 *
 * Runs completely asynchronously (after response is delivered to player).
 */
export async function extractAndSaveNpcMemoryBackground({
  targetNpc,
  activeCharacter,
  actionText,
  narration,
  modelInstance = null,
  db = prisma
}) {
  if (!targetNpc || !activeCharacter) return null;
  const targetChar = targetNpc.character || targetNpc;
  const targetId = targetNpc.character_id || targetChar.id;
  const playerId = activeCharacter.character_id || activeCharacter.id;
  if (!targetId || !playerId) return null;
  const memorable = isMajorNpcMemoryEvent(actionText, narration) || /defeat|duel|kill|attack|win|loss|bargain|promise|debt|steal|bribe|reward|confess|trade/i.test(`${actionText || ''} ${narration || ''}`);
  if (!memorable) return null;

  try {
    let content = '';
    if (modelInstance && typeof modelInstance.invoke === 'function') {
      const prompt = `You are a memory extractor for an RPG NPC.\nNPC: ${targetChar.name || 'NPC'}\nPlayer: ${activeCharacter.name || 'Adventurer'}\nPlayer action: ${actionText || ''}\nOutcome: ${(narration || '').slice(0, 400)}\nReturn one concise sentence from the NPC's perspective.`;
      const response = await modelInstance.invoke([new HumanMessage({ content: prompt })]);
      content = String(response.content || '').trim().replace(/^['"]|['"]$/g, '');
    } else {
      content = `${targetChar.name || 'The NPC'} remembers ${activeCharacter.name || 'the adventurer'}: ${(actionText || '').slice(0, 150)}.`;
    }
    return await createNpcMemory({
      db,
      npcCharacterId: targetId,
      targetCharacterId: playerId,
      content,
      memoryType: isMajorNpcMemoryEvent(actionText, narration) ? 'EPISODIC' : 'SHORT_TERM',
      modelInstance
    });
  } catch (error) {
    console.warn('Background NPC memory distillation skipped:', error.message);
    return null;
  }
}
export default {
  DEFAULT_MAX_WINDOW_TURNS,
  DEFAULT_MAX_SCOPED_NPCS,
  DEFAULT_MAX_NPC_MEMORIES,
  CROWD_OVERFLOW_THRESHOLD,
  applySlidingWindow,
  compressPartySilhouette,
  scopeLocalNpcs,
  formatScopedNpcs,
  retrieveNpcMemories,
  extractAndSaveNpcMemoryBackground
};
