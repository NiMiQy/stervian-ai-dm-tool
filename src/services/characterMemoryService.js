import { databaseError } from '../database/databaseError.js';
import { getNsfwAccess, isNsfwRecord, nsfwWhere } from './nsfwAccessService.js';
import {
  DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT,
  LONG_TERM_MEMORY_LIMIT,
  MEMORY_CONTENT_MAX_LENGTH,
  MEMORY_FETCH_LIMIT,
  MEMORY_SUMMARY_MAX_LENGTH,
  MEMORY_TTL_MS,
  MEMORY_TYPE,
  SHORT_TERM_MEMORY_LIMIT,
  UNREVEALED_PLAYER_NAME,
} from '../configs/constants.js';

function ageLimit(memoryType, now) {
  const ttl = MEMORY_TTL_MS[memoryType] ?? null;
  return ttl ? new Date(now.getTime() - ttl) : null;
}

function isVisibleByAge(memory, now) {
  const cutoff = ageLimit(memory.memory_type, now);
  return !cutoff || !memory.created_at || new Date(memory.created_at) >= cutoff;
}

function isSecret(memory) {
  return Boolean(memory.is_secret) || memory.memory_type === MEMORY_TYPE.SECRET;
}

export function redactPlayerNameFromMemory(content, playerName, nameRevealed = false) {
  const text = String(content || '');
  const name = String(playerName || '').trim();
  if (nameRevealed || !name) return text;
  return text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), UNREVEALED_PLAYER_NAME);
}

function isMajorEvent(actionText, narration) {
  return /kidnap|kidnapp|assault|ambush|sold\s+(?:at|on)\s+(?:the\s+)?market|enslav|legendary\s+trader|former\s+hero|used\s+to\s+be\s+a\s+hero/i.test(`${actionText} ${narration}`);
}

async function summarizeShortTermMemories(memories, modelInstance) {
  const facts = memories.map((memory) => String(memory.content || '').trim()).filter(Boolean);
  if (modelInstance && typeof modelInstance.invoke === 'function') {
    try {
      const result = await modelInstance.invoke(`Summarize these ten NPC memories as one concise long-term memory, preserving the important facts and the NPC's impressions. Return only the sentence.\n${facts.map((fact) => `- ${fact}`).join('\n')}`);
      const summary = String(result.content || '').trim().replace(/^['"]|['"]$/g, '');
      if (summary) return summary.slice(0, MEMORY_SUMMARY_MAX_LENGTH);
    } catch {}
  }
  return facts.join(' ').slice(0, MEMORY_SUMMARY_MAX_LENGTH);
}

async function trimOldestMemories(db, { characterId, targetCharacterId, memoryType, keep }) {
  const rows = await db.character_memories.findMany({
    where: { character_id: characterId, target_character_id: targetCharacterId, memory_type: memoryType, deleted: false },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }]
  });
  for (const memory of rows.slice(keep)) {
    await db.character_memories.update({ where: { id: memory.id }, data: { deleted: true } });
  }
}

export async function retrieveNpcMemories({ db, npcCharacterId, targetCharacterId, limit = DEFAULT_NPC_MEMORY_RETRIEVAL_LIMIT, affinity = 0, includeSecret = false, nsfwAllowed = null }) {
  if (!db?.character_memories?.findMany || !npcCharacterId) return [];
  try {
    const now = new Date();
    const allowNsfw = typeof nsfwAllowed === 'boolean' ? nsfwAllowed : (db?.players?.findUnique ? await getNsfwAccess(db, targetCharacterId) : false);
    const rows = await db.character_memories.findMany({
      where: {
        character_id: Number(npcCharacterId),
        deleted: false,
        AND: [
          ...(targetCharacterId ? [{ OR: [{ target_character_id: Number(targetCharacterId) }, { target_character_id: null }] }] : []),
          nsfwWhere(allowNsfw)
        ]
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: MEMORY_FETCH_LIMIT
    });
    const canRevealSecrets = includeSecret;
    return rows
      .filter((memory) => isVisibleByAge(memory, now) && (canRevealSecrets || !isSecret(memory)))
      .slice(0, Math.max(0, limit))
      .map((memory) => ({ ...memory, content: memory.content || '' }));
  } catch (error) {
    throw databaseError('retrieveNpcMemories', 'read NPC memories', error);
  }
}

export async function createNpcMemory({ db, npcCharacterId, targetCharacterId, content, memoryType = MEMORY_TYPE.SHORT_TERM, isSecret = false, isNsfw = false, addFrom = null, modelInstance = null }) {
  if (!db?.character_memories?.create || !npcCharacterId || !targetCharacterId || !String(content || '').trim()) return null;
  try {
    const now = new Date();
    const expiryCutoffs = [
      { memory_type: MEMORY_TYPE.SHORT_TERM, before: ageLimit(MEMORY_TYPE.SHORT_TERM, now) },
      { memory_type: MEMORY_TYPE.LONG_TERM, before: ageLimit(MEMORY_TYPE.LONG_TERM, now) }
    ];
    if (typeof db?.character_memories?.updateMany === 'function') {
      for (const { memory_type, before } of expiryCutoffs) {
        await db.character_memories.updateMany({
          where: { character_id: Number(npcCharacterId), target_character_id: Number(targetCharacterId), memory_type, deleted: false, created_at: { lt: before } },
          data: { deleted: true }
        });
      }
    }

    const type = memoryType;
    const saved = await db.character_memories.create({
      data: {
        character_id: Number(npcCharacterId),
        target_character_id: Number(targetCharacterId),
        memory_type: type,
        content: String(content).trim().slice(0, MEMORY_CONTENT_MAX_LENGTH),
        is_secret: Boolean(isSecret),
        is_nsfw: Boolean(isNsfw),
        ...(addFrom ? { add_from: addFrom } : {})
      }
    });

    if (type === MEMORY_TYPE.SHORT_TERM && typeof db?.character_memories?.findMany === 'function') {
      const recent = await db.character_memories.findMany({
        where: { character_id: Number(npcCharacterId), target_character_id: Number(targetCharacterId), memory_type: MEMORY_TYPE.SHORT_TERM, deleted: false },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        take: SHORT_TERM_MEMORY_LIMIT
      });
      if (recent.length >= SHORT_TERM_MEMORY_LIMIT) {
        const summary = await summarizeShortTermMemories(recent, modelInstance);
        await db.character_memories.create({
          data: {
            character_id: Number(npcCharacterId),
            target_character_id: Number(targetCharacterId),
            memory_type: MEMORY_TYPE.LONG_TERM,
            content: summary,
            is_secret: recent.some(isSecret),
            is_nsfw: recent.some(isNsfwRecord)
          }
        });
        await db.character_memories.updateMany({ where: { id: { in: recent.map((memory) => memory.id) } }, data: { deleted: true } });
        await trimOldestMemories(db, { characterId: Number(npcCharacterId), targetCharacterId: Number(targetCharacterId), memoryType: MEMORY_TYPE.LONG_TERM, keep: LONG_TERM_MEMORY_LIMIT });
        return saved;
      }
      await trimOldestMemories(db, { characterId: Number(npcCharacterId), targetCharacterId: Number(targetCharacterId), memoryType: MEMORY_TYPE.SHORT_TERM, keep: SHORT_TERM_MEMORY_LIMIT });
    } else if (type === MEMORY_TYPE.LONG_TERM && typeof db?.character_memories?.findMany === 'function') {
      await trimOldestMemories(db, { characterId: Number(npcCharacterId), targetCharacterId: Number(targetCharacterId), memoryType: MEMORY_TYPE.LONG_TERM, keep: LONG_TERM_MEMORY_LIMIT });
    }
    return saved;
  } catch (error) {
    throw databaseError('createNpcMemory', 'save NPC memory', error);
  }
}

export function isMajorNpcMemoryEvent(actionText, narration) {
  return isMajorEvent(actionText, narration);
}
