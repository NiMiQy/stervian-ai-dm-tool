import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  CHARACTER_TYPE,
  HTTP_STATUS,
  ITEM_LOCATION,
  MAX_ACTIVE_QUESTS,
  PARTY_MEMBER_ROLE,
  PARTY_STATUS,
  QUEST_STATUS,
  QUEST_TRANSACTION_TIMEOUT_MS,
  QUEST_TYPE,
} from '../configs/constants.js';
import {
  calculateLevelRewards,
  proficiencyForLevel,
  spellPointsForLevel
} from './progressionContainer.js';
import { getNsfwAccess, nsfwWhere } from '../services/nsfwAccessService.js';

export { MAX_ACTIVE_QUESTS };

function currentAreaScope(character) {
  if (character.sublocation_id) return { sublocation_id: character.sublocation_id };
  if (character.location_id) return { location_id: character.location_id, sublocation_id: null };
  return null;
}

async function getCharacter(client, userId) {
  return client.characters.findUnique({
    where: { user_id: userId },
    select: { id: true, location_id: true, sublocation_id: true, deleted: true }
  });
}

async function getLocalIssuers(client, character) {
  const scope = currentAreaScope(character);
  if (!scope) return [];
  const appearances = await client.npcs_in_locations_or_sublocations.findMany({
    where: {
      ...scope,
      deleted: false,
      npc: {
        is: {
          deleted: false,
          npc_monsters: { is: null },
          character: { is: { deleted: false, character_type: CHARACTER_TYPE.NPC } }
        }
      }
    },
    select: {
      npc_id: true,
      npc: { select: { character: { select: { id: true, name: true } } } }
    }
  });
  const unique = new Map();
  appearances.forEach(({ npc_id: npcId, npc }) => {
    if (npc?.character && !unique.has(npcId)) unique.set(npcId, { id: npcId, name: npc.character.name || 'Unnamed NPC' });
  });
  return [...unique.values()];
}

function targetName(quest) {
  if (quest.objective_type === QUEST_TYPE.COLLECT) return quest.target_item?.name || 'item';
  if ((quest.target_npc_character_id === 7 || quest.target_npc_character_id === 8) && quest.name?.toLowerCase().includes('mage bandit')) {
    return 'Bandit / Mage Bandit';
  }
  return quest.target_npc?.character?.name || 'target';
}

function objectiveProgress(quest, savedProgress, backpackCounts, capturedNpcIds) {
  const required = Math.max(1, Number(quest.required_quantity) || 1);
  if (quest.objective_type === QUEST_TYPE.COLLECT) return Math.min(required, backpackCounts.get(quest.target_item_id) || 0);
  if (quest.objective_type === QUEST_TYPE.CAPTURE) return Math.min(required, capturedNpcIds.get(quest.target_npc_character_id) || 0);
  return Math.min(required, Math.max(0, Number(savedProgress) || 0));
}

function formatQuest(quest, issuerName, savedProgress, backpackCounts, capturedNpcIds) {
  const required = Math.max(1, Number(quest.required_quantity) || 1);
  const progress = objectiveProgress(quest, savedProgress, backpackCounts, capturedNpcIds);
  return {
    id: quest.id,
    name: quest.name,
    description: quest.description,
    objective_type: quest.objective_type,
    target_name: targetName(quest),
    required_quantity: required,
    progress,
    completed: progress >= required,
    repeatable: Boolean(quest.repeatable),
    gold_reward: Math.max(0, Number(quest.gold_reward) || 0),
    exp_reward: Math.max(0, Number(quest.exp_reward) || 0),
    affinity_reward: Math.max(0, Number(quest.affinity_reward) || 0),
    issuer_name: issuerName || quest.source_npc?.character?.name || 'Unknown NPC',
    can_complete: progress >= required
  };
}

async function getBackpackCounts(client, characterId) {
  const rows = await client.character_items.findMany({
    where: { character_id: characterId, location: ITEM_LOCATION.BACKPACK, deleted: false },
    select: { item_id: true, quantity: true }
  });
  return rows.reduce((counts, row) => {
    counts.set(row.item_id, (counts.get(row.item_id) || 0) + Math.max(0, Number(row.quantity ?? 1) || 0));
    return counts;
  }, new Map());
}

async function getCapturedNpcIds(client, characterId) {
  const rows = await client.party_members.findMany({
    where: {
      role: PARTY_MEMBER_ROLE.CAPTIVE,
      is_active: true,
      deleted: false,
      party: {
        is: {
          status: PARTY_STATUS.ACTIVE,
          deleted: false,
          members: { some: { character_id: characterId, deleted: false } }
        }
      }
    },
    select: { character_id: true }
  });
  return rows.reduce((counts, row) => counts.set(row.character_id, (counts.get(row.character_id) || 0) + 1), new Map());
}

function questInclude() {
  return {
    source_npc: { select: { character: { select: { name: true } } } },
    target_item: { select: { name: true } },
    target_npc: { select: { character: { select: { name: true } } } }
  };
}

async function lockCharacter(client, characterId) {
  await client.$queryRaw`SELECT id FROM characters WHERE id = ${characterId} FOR UPDATE`;
}

export async function getQuestBoard(userId) {
  try {
    const character = await getCharacter(prisma, userId);
    if (!character || character.deleted) return { has_local_offers: false, offers: [], active: [], active_limit: MAX_ACTIVE_QUESTS, active_count: 0 };
    const issuers = await getLocalIssuers(prisma, character);
    const issuerIds = issuers.map((issuer) => issuer.id);
    const questVisibility = nsfwWhere(await getNsfwAccess(prisma, character.id));
    const [localQuests, activeRuns] = await Promise.all([
      issuerIds.length ? prisma.quests.findMany({
        where: { source_npc_id: { in: issuerIds }, deleted: false, ...questVisibility },
        include: questInclude(),
        orderBy: { id: 'asc' }
      }) : [],
      prisma.character_quests.findMany({
        where: { character_id: character.id, status: QUEST_STATUS.ACTIVE, deleted: false, quest: { is: { deleted: false, ...questVisibility } } },
        include: { quest: { include: questInclude() } },
        orderBy: { accepted_at: 'asc' }
      })
    ]);
    const localQuestIds = localQuests.map((quest) => quest.id);
    const [completedRows, backpackCounts, capturedNpcIds] = await Promise.all([
      localQuestIds.length ? prisma.character_quests.findMany({
        where: { character_id: character.id, quest_id: { in: localQuestIds }, status: QUEST_STATUS.COMPLETED, deleted: false },
        select: { quest_id: true }
      }) : [],
      getBackpackCounts(prisma, character.id),
      getCapturedNpcIds(prisma, character.id)
    ]);
    const activeQuestIds = new Set(activeRuns.map((run) => run.quest_id));
    const completedQuestIds = new Set(completedRows.map((run) => run.quest_id));
    const activeCount = activeRuns.length;
    const issuerNameById = new Map(issuers.map((issuer) => [issuer.id, issuer.name]));
    const offers = localQuests.map((quest) => ({
      ...formatQuest(quest, issuerNameById.get(quest.source_npc_id), 0, backpackCounts, capturedNpcIds),
      is_active: activeQuestIds.has(quest.id),
      has_been_completed: completedQuestIds.has(quest.id),
      can_accept: !activeQuestIds.has(quest.id) && (!completedQuestIds.has(quest.id) || quest.repeatable) && activeCount < MAX_ACTIVE_QUESTS
    }));
    const active = activeRuns.map((run) => ({
      run_id: run.id,
      status: run.status,
      accepted_at: run.accepted_at,
      ...formatQuest(run.quest, run.quest.source_npc?.character?.name, run.progress, backpackCounts, capturedNpcIds)
    }));
    return {
      has_local_offers: localQuests.length > 0,
      offers,
      active,
      active_limit: MAX_ACTIVE_QUESTS,
      active_count: activeCount
    };
  } catch (error) {
    throw databaseError('getQuestBoard', 'read quests', error);
  }
}

function hasValidObjective(quest) {
  const quantity = Number(quest.required_quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return false;
  if (quest.objective_type === QUEST_TYPE.COLLECT) return Boolean(quest.target_item_id);
  if (quest.objective_type === QUEST_TYPE.ELIMINATE || quest.objective_type === QUEST_TYPE.CAPTURE) return Boolean(quest.target_npc_character_id);
  return false;
}

export async function acceptQuest(userId, questId) {
  const id = Number(questId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, select: { id: true, location_id: true, sublocation_id: true, deleted: true } });
      if (!character || character.deleted) return { error: 'Character not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      await lockCharacter(tx, character.id);
      const quest = await tx.quests.findFirst({ where: { id, deleted: false, ...nsfwWhere(await getNsfwAccess(tx, character.id)) } });
      if (!quest) return { error: 'Quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      const issuers = await getLocalIssuers(tx, character);
      if (!issuers.some((issuer) => issuer.id === quest.source_npc_id)) return { error: 'This quest is not offered in your current area.', statusCode: HTTP_STATUS.CONFLICT };
      if (!hasValidObjective(quest)) return { error: 'This quest objective is not configured correctly.', statusCode: HTTP_STATUS.CONFLICT };
      const activeCount = await tx.character_quests.count({ where: { character_id: character.id, status: QUEST_STATUS.ACTIVE, deleted: false } });
      if (activeCount >= MAX_ACTIVE_QUESTS) return { error: `You can have up to ${MAX_ACTIVE_QUESTS} active quests.`, statusCode: HTTP_STATUS.CONFLICT };
      const existingRuns = await tx.character_quests.findMany({
        where: { character_id: character.id, quest_id: quest.id, deleted: false },
        select: { status: true }
      });
      if (existingRuns.some((run) => run.status === QUEST_STATUS.ACTIVE)) return { error: 'You have already accepted this quest.', statusCode: HTTP_STATUS.CONFLICT };
      if (!quest.repeatable && existingRuns.some((run) => run.status === QUEST_STATUS.COMPLETED)) return { error: 'This quest can only be completed once.', statusCode: HTTP_STATUS.CONFLICT };
      const run = await tx.character_quests.create({ data: { character_id: character.id, quest_id: quest.id, status: QUEST_STATUS.ACTIVE, progress: 0 } });
      return { success: true, quest_id: quest.id, run_id: run.id };
    }, { timeout: QUEST_TRANSACTION_TIMEOUT_MS });
  } catch (error) {
    throw databaseError('acceptQuest', 'accept quest', error);
  }
}

async function consumeQuestItems(tx, characterId, itemId, required) {
  const itemRows = await tx.character_items.findMany({
    where: { character_id: characterId, item_id: itemId, location: ITEM_LOCATION.BACKPACK, deleted: false },
    select: { id: true, quantity: true },
    orderBy: { id: 'asc' }
  });
  const available = itemRows.reduce((total, row) => total + Math.max(0, Number(row.quantity ?? 1) || 0), 0);
  if (available < required) throw new Error('Required quest items changed before turn-in.');
  let remaining = required;
  for (const row of itemRows) {
    if (remaining <= 0) break;
    const quantity = Math.max(0, Number(row.quantity ?? 1) || 0);
    const removed = Math.min(quantity, remaining);
    const nextQuantity = quantity - removed;
    const changed = await tx.character_items.updateMany({
      where: { id: row.id, character_id: characterId, location: ITEM_LOCATION.BACKPACK, quantity: row.quantity, deleted: false },
      data: { quantity: nextQuantity, deleted: nextQuantity === 0 }
    });
    if (changed.count !== 1) throw new Error('Required quest items changed before turn-in.');
    remaining -= removed;
  }
}

export async function completeQuest(userId, runId) {
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Active quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, select: { id: true, location_id: true, sublocation_id: true, deleted: true } });
      if (!character || character.deleted) return { error: 'Character not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      await lockCharacter(tx, character.id);
      const run = await tx.character_quests.findFirst({
        where: { id, character_id: character.id, status: QUEST_STATUS.ACTIVE, deleted: false, quest: { is: nsfwWhere(await getNsfwAccess(tx, character.id)) } },
        include: { quest: { include: questInclude() } }
      });
      if (!run || !run.quest || run.quest.deleted) return { error: 'Active quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      const issuers = await getLocalIssuers(tx, character);
      if (!issuers.some((issuer) => issuer.id === run.quest.source_npc_id)) return { error: 'Return to the quest issuer to turn in this quest.', statusCode: HTTP_STATUS.CONFLICT };
      if (!hasValidObjective(run.quest)) return { error: 'This quest objective is not configured correctly.', statusCode: HTTP_STATUS.CONFLICT };
      const [backpackCounts, capturedNpcIds] = await Promise.all([
        getBackpackCounts(tx, character.id),
        getCapturedNpcIds(tx, character.id)
      ]);
      const required = Math.max(1, Number(run.quest.required_quantity) || 1);
      const progress = objectiveProgress(run.quest, run.progress, backpackCounts, capturedNpcIds);
      if (progress < required) return { error: 'This quest is not complete yet.', statusCode: HTTP_STATUS.CONFLICT };
      if (run.quest.objective_type === QUEST_TYPE.COLLECT) await consumeQuestItems(tx, character.id, run.quest.target_item_id, required);
      await tx.character_quests.update({ where: { id: run.id }, data: { status: QUEST_STATUS.COMPLETED, completed_at: new Date() } });
      const goldReward = Math.max(0, Number(run.quest.gold_reward) || 0);
      if (goldReward) {
        const player = await tx.players.findUnique({ where: { character_id: character.id }, select: { gold: true } });
        if (player) await tx.players.update({ where: { character_id: character.id }, data: { gold: Math.max(0, Number(player.gold) || 0) + goldReward } });
      }
      const affinityReward = Math.max(0, Number(run.quest.affinity_reward) || 0);
      if (affinityReward) {
        await tx.player_npc_relationships.upsert({
          where: { player_character_id_npc_character_id: { player_character_id: character.id, npc_character_id: run.quest.source_npc_id } },
          create: { player_character_id: character.id, npc_character_id: run.quest.source_npc_id, affinity: affinityReward, deleted: false },
          update: { affinity: { increment: affinityReward }, deleted: false }
        });
      }
      const expReward = Math.max(0, Number(run.quest.exp_reward) || 0);
      if (expReward) {
        const fullChar = await tx.characters.findUnique({
          where: { id: character.id },
          include: { character_stat: true, player: true }
        });
        if (fullChar?.character_stat && fullChar?.player) {
          const { levelChanged, result: evaluation } = calculateLevelRewards(fullChar.level, fullChar.current_exp, expReward);
          await tx.characters.update({
            where: { id: fullChar.id },
            data: { level: evaluation.level, current_exp: evaluation.currentExp }
          });
          await tx.character_stats.update({
            where: { id: fullChar.character_stat.id },
            data: {
              proficiency: proficiencyForLevel(evaluation.level),
              current_hp: levelChanged ? fullChar.character_stat.max_hp : fullChar.character_stat.current_hp,
              current_energy: levelChanged ? fullChar.character_stat.max_energy : fullChar.character_stat.current_energy
            }
          });
          if (levelChanged) {
            await tx.players.update({
              where: { character_id: fullChar.id },
              data: { current_point_spend: { increment: evaluation.levelUps * ATTRIBUTE_POINTS_PER_LEVEL } }
            });
            const slots = spellPointsForLevel(evaluation.level);
            const existingSlots = await tx.character_spellpoints.findMany({ where: { character_id: fullChar.id, deleted: false } });
            for (const [slotLevel, maxCurrent] of Object.entries(slots)) {
              const current = existingSlots.find((slot) => Number(slot.level) === Number(slotLevel));
              if (current) {
                await tx.character_spellpoints.update({ where: { id: current.id }, data: { max_current: maxCurrent, current: maxCurrent } });
              } else {
                await tx.character_spellpoints.create({ data: { character_id: fullChar.id, level: Number(slotLevel), max_current: maxCurrent, current: maxCurrent } });
              }
            }
          }
        }
      }
      return { success: true, quest_name: run.quest.name, gold_reward: goldReward, exp_reward: expReward, affinity_reward: affinityReward };
    }, { timeout: QUEST_TRANSACTION_TIMEOUT_MS });
  } catch (error) {
    throw databaseError('completeQuest', 'complete quest', error);
  }
}

export async function abandonQuest(userId, runId) {
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Active quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, select: { id: true, deleted: true } });
      if (!character || character.deleted) return { error: 'Character not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      await lockCharacter(tx, character.id);
      const run = await tx.character_quests.findFirst({
        where: { id, character_id: character.id, status: QUEST_STATUS.ACTIVE, deleted: false },
        select: { id: true, quest: { select: { name: true } } }
      });
      if (!run) return { error: 'Active quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      const changed = await tx.character_quests.updateMany({
        where: { id: run.id, character_id: character.id, status: QUEST_STATUS.ACTIVE, deleted: false },
        data: { status: QUEST_STATUS.FAILED, progress: 0 }
      });
      if (changed.count !== 1) return { error: 'Active quest not found.', statusCode: HTTP_STATUS.NOT_FOUND };
      return { success: true, run_id: run.id, quest_name: run.quest?.name || 'Quest' };
    }, { timeout: QUEST_TRANSACTION_TIMEOUT_MS });
  } catch (error) {
    throw databaseError('abandonQuest', 'abandon quest', error);
  }
}

export async function recordQuestEliminations(client, characterId, defeatedNpcIds) {
  const ids = (Array.isArray(defeatedNpcIds) ? defeatedNpcIds : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return;
  try {
    const activeRuns = await client.character_quests.findMany({
      where: { character_id: characterId, status: QUEST_STATUS.ACTIVE, deleted: false, quest: { is: { deleted: false, objective_type: QUEST_TYPE.ELIMINATE } } },
      select: {
        id: true,
        progress: true,
        quest: { select: { target_npc_character_id: true, required_quantity: true, name: true } }
      }
    });
    for (const run of activeRuns) {
      const targetId = run.quest.target_npc_character_id;
      if (!targetId) continue;
      const targetIds = (targetId === 7 || targetId === 8) && run.quest.name?.toLowerCase().includes('mage bandit')
        ? [7, 8]
        : [targetId];
      const eliminated = ids.filter((target) => targetIds.includes(target)).length;
      if (!eliminated) continue;
      const required = Math.max(1, Number(run.quest.required_quantity) || 1);
      const nextProgress = Math.min(required, Math.max(0, run.progress) + eliminated);
      await client.character_quests.updateMany({
        where: { id: run.id, status: QUEST_STATUS.ACTIVE, progress: run.progress, deleted: false },
        data: { progress: nextProgress }
      });
    }
  } catch (error) {
    throw databaseError('recordQuestEliminations', 'update quest progress', error);
  }
}
