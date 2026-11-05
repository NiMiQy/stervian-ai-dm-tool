import { randomInt, randomUUID } from 'node:crypto';
import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { buildEquipment, getCharacterItems } from '../components/logics/characterItems.js';
import { retrieveNpcMemories } from './characterMemoryService.js';
import { abilityStatField, findStorySkill, rollSkillCheck } from '../containers/core/skillCheckRules.js';
import { ITEM_LOCATION, MEMORY_FETCH_LIMIT, MEMORY_TYPE, SKILL_CHECK } from '../configs/constants.js';

const pendingSkillChecks = new Map();

function sweepPending(now = Date.now()) {
  for (const [key, entry] of pendingSkillChecks) {
    if (entry.expiresAt <= now) pendingSkillChecks.delete(key);
  }
}

function equippedBonus(equipment, field) {
  return Object.values(equipment || {})
    .filter((item) => item && typeof item === 'object')
    .reduce((total, item) => total + (Number(item.item_bonus?.[field]) || 0), 0);
}

export async function loadCheckStats(characterId, statField, db = prisma) {
  try {
    const [stats, equippedRows] = await Promise.all([
      db.character_stats.findUnique({ where: { character_id: Number(characterId) } }),
      getCharacterItems(db, Number(characterId), ITEM_LOCATION.EQUIPPED)
    ]);
    const equipment = buildEquipment(equippedRows);
    return {
      abilityScore: (Number(stats?.[statField]) || 0) + equippedBonus(equipment, `${statField}_bonus`),
      proficiency: (Number(stats?.proficiency) || 0) + equippedBonus(equipment, 'proficiency_bonus')
    };
  } catch (error) {
    throw databaseError('loadCheckStats', 'read character stats for a skill check', error);
  }
}

export async function requestSkillCheck({ characterId, skillKey, dc, rollMode, db = prisma, random = randomInt }) {
  const skill = findStorySkill(skillKey);
  if (!skill) throw new Error('Unknown skill.');
  const statField = abilityStatField(skill);
  const { abilityScore, proficiency } = await loadCheckStats(characterId, statField, db);
  const skillCheck = {
    id: randomUUID(),
    ...rollSkillCheck({ skill, abilityScore, proficiency, dc, rollMode }, random),
    createdAt: Date.now()
  };
  sweepPending();
  pendingSkillChecks.set(Number(characterId), { ...skillCheck, expiresAt: Date.now() + SKILL_CHECK.PENDING_TTL_MS });
  return skillCheck;
}

export function consumePendingSkillCheck(characterId, skillCheckId) {
  sweepPending();
  const key = Number(characterId);
  const entry = pendingSkillChecks.get(key);
  if (!entry || entry.id !== skillCheckId) return null;
  pendingSkillChecks.delete(key);
  const { expiresAt, ...skillCheck } = entry;
  return skillCheck;
}

export function canRevealSecret(skillCheck) {
  return Boolean(skillCheck?.success) && SKILL_CHECK.SECRET_REVEAL_SKILLS.includes(skillCheck.skill);
}

export async function attachSecretReveal({ skillCheck, npc, playerCharacterId, db = prisma, random = randomInt }) {
  if (!canRevealSecret(skillCheck) || !npc?.id || !playerCharacterId) return skillCheck;
  const memories = await retrieveNpcMemories({
    db,
    npcCharacterId: npc.id,
    targetCharacterId: playerCharacterId,
    includeSecret: true,
    limit: MEMORY_FETCH_LIMIT
  });
  const secrets = memories.filter((memory) => memory.is_secret || memory.memory_type === MEMORY_TYPE.SECRET);
  if (!secrets.length) return skillCheck;
  const secret = secrets[random(0, secrets.length)];
  return { ...skillCheck, secretReveal: { npcName: npc.name, content: String(secret.content || '').trim() } };
}

export { toStoredSkillCheck, formatSkillCheckForPrompt } from '../containers/core/skillCheckRules.js';
