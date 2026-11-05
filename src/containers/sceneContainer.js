import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { getUserActiveParty } from './partyContainer.js';
import { clampChaosFactor } from './core/fateRules.js';
import { createNpcMemory } from '../services/characterMemoryService.js';
import { getNpcIdentity, maskUnrevealedName, nameNpcUses } from '../services/npcIdentityService.js';
import { sceneMemorySummarySubagent } from '../services/ai/subagents/sceneSummary.js';
import { clampAffinity, getAffinityStatus, npcRelationshipManager } from '../services/ai/subagents/relationships.js';
import {
  CHARACTER_TYPE,
  DEFAULT_CHAOS_FACTOR,
  ERROR_NAMES,
  HTTP_STATUS,
  MAX_ONGOING_SCENES,
  MEMORY_ADD_FROM,
  RELATIONSHIP_NOTE_MAX_LENGTH,
  SCENE_AFFINITY_REWARD,
  SCENE_FIELD_MAX_LENGTHS,
  SCENE_LIMIT_ERROR,
  SCENE_STAGE,
  SCENE_SUMMARY_CONTENT_MAX_LENGTH,
  SCENE_SUMMARY_MAX_SCENES,
  SCENE_SUMMARY_MEMORY_TYPES,
  SOLVED_SCENES_DISPLAY_LIMIT,
  UNREVEALED_PLAYER_NAME
} from '../configs/constants.js';

export class SceneRuleError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = ERROR_NAMES.SCENE_RULE;
    this.statusCode = statusCode;
  }
}

const sceneInclude = {
  npc_character: { select: { id: true, name: true } }
};

export function formatScene(scene) {
  if (!scene) return null;
  return {
    id: scene.id,
    character_id: scene.character_id,
    party_id: scene.party_id ?? null,
    npc_character_id: scene.npc_character_id ?? null,
    npc_name: scene.npc_character?.name || null,
    location_id: scene.location_id ?? null,
    sublocation_id: scene.sublocation_id ?? null,
    scene_goal: scene.scene_goal,
    scene_notes: scene.scene_notes || '',
    chaos_factor: scene.chaos_factor ?? DEFAULT_CHAOS_FACTOR,
    affinity_reward: scene.affinity_reward ?? 0,
    scene_stage: scene.scene_stage,
    created_at: scene.created_at,
    updated_at: scene.updated_at
  };
}

function cleanText(value, maxLength, label, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new SceneRuleError(`${label} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new SceneRuleError(`${label} must be text.`);
  const text = value.trim();
  if (required && !text) throw new SceneRuleError(`${label} is required.`);
  if (text.length > maxLength) throw new SceneRuleError(`${label} must be ${maxLength} characters or fewer.`);
  return text;
}

function cleanAffinityReward(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return 0;
  const reward = Number(value);
  if (!Number.isInteger(reward)) throw new SceneRuleError('Affinity must be a whole number.');
  if (reward < SCENE_AFFINITY_REWARD.MIN || reward > SCENE_AFFINITY_REWARD.MAX) {
    throw new SceneRuleError(`Affinity must be between ${SCENE_AFFINITY_REWARD.MIN} and ${SCENE_AFFINITY_REWARD.MAX}.`);
  }
  return reward;
}

function requireNpcForAffinity(reward, npcId) {
  if (reward && !npcId) throw new SceneRuleError('Choose a canon NPC to receive the affinity change.');
}

async function resolveNpcCharacterId(db, npcCharacterId) {
  if (npcCharacterId === undefined) return undefined;
  if (npcCharacterId === null || npcCharacterId === '') return null;
  const id = Number(npcCharacterId);
  if (!Number.isInteger(id) || id <= 0) throw new SceneRuleError('Choose a valid NPC.');
  const npc = await db.characters.findFirst({ where: { id, deleted: false, character_type: CHARACTER_TYPE.NPC }, select: { id: true } });
  if (!npc) throw new SceneRuleError('That NPC does not exist.');
  return npc.id;
}

export async function countOngoingScenes(characterId, db = prisma) {
  try {
    return await db.character_scenes.count({ where: { character_id: Number(characterId), deleted: false, scene_stage: SCENE_STAGE.ON_GOING } });
  } catch (error) {
    throw databaseError('sceneContainer', 'countOngoingScenes', error);
  }
}

export async function listOngoingScenes(characterId, db = prisma) {
  try {
    const scenes = await db.character_scenes.findMany({
      where: { character_id: Number(characterId), deleted: false, scene_stage: SCENE_STAGE.ON_GOING },
      include: sceneInclude,
      orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
      take: MAX_ONGOING_SCENES
    });
    return scenes.map(formatScene);
  } catch (error) {
    throw databaseError('sceneContainer', 'listOngoingScenes', error);
  }
}

export async function listCharacterScenes(characterId, db = prisma) {
  try {
    const [ongoing, solved] = await Promise.all([
      listOngoingScenes(characterId, db),
      db.character_scenes.findMany({
        where: { character_id: Number(characterId), deleted: false, scene_stage: SCENE_STAGE.SOLVED },
        include: sceneInclude,
        orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
        take: SOLVED_SCENES_DISPLAY_LIMIT
      })
    ]);
    return { ongoing, solved: solved.map(formatScene), maxOngoing: MAX_ONGOING_SCENES };
  } catch (error) {
    if (error.name === ERROR_NAMES.DATABASE_OPERATION) throw error;
    throw databaseError('sceneContainer', 'listCharacterScenes', error);
  }
}

export async function createCharacterScene({ userId, characterId, sceneGoal, sceneNotes = '', npcCharacterId = null, affinityReward = 0 }, db = prisma) {
  const goal = cleanText(sceneGoal, SCENE_FIELD_MAX_LENGTHS.scene_goal, 'Scene goal', true);
  const notes = cleanText(sceneNotes ?? '', SCENE_FIELD_MAX_LENGTHS.scene_notes, 'Scene notes') || '';
  const reward = cleanAffinityReward(affinityReward) ?? 0;
  try {
    const character = await db.characters.findFirst({ where: { id: Number(characterId), deleted: false }, select: { id: true, user_id: true, location_id: true, sublocation_id: true } });
    if (!character) throw new SceneRuleError('Character not found.', HTTP_STATUS.NOT_FOUND);
    const npcId = await resolveNpcCharacterId(db, npcCharacterId);
    requireNpcForAffinity(reward, npcId);
    if (await countOngoingScenes(character.id, db) >= MAX_ONGOING_SCENES) throw new SceneRuleError(SCENE_LIMIT_ERROR, HTTP_STATUS.CONFLICT);
    let partyId = null;
    try {
      const partyInfo = await getUserActiveParty(userId || character.user_id);
      const party = partyInfo?.party || null;
      if (party?.id && Array.isArray(party.members) && party.members.some((member) => member.is_player && member.character_id !== character.id)) partyId = party.id;
    } catch (partyError) {
      console.warn('Unable to resolve party for scene:', partyError.message);
    }
    const created = await db.character_scenes.create({
      data: {
        character_id: character.id,
        party_id: partyId,
        npc_character_id: npcId ?? null,
        location_id: character.location_id ?? null,
        sublocation_id: character.sublocation_id ?? null,
        scene_goal: goal,
        scene_notes: notes,
        chaos_factor: DEFAULT_CHAOS_FACTOR,
        affinity_reward: reward,
        scene_stage: SCENE_STAGE.ON_GOING
      },
      include: sceneInclude
    });
    return formatScene(created);
  } catch (error) {
    if (error instanceof SceneRuleError || error.name === ERROR_NAMES.DATABASE_OPERATION) throw error;
    throw databaseError('sceneContainer', 'createCharacterScene', error);
  }
}

async function findOwnedScene(db, characterId, sceneId) {
  const id = Number(sceneId);
  if (!Number.isInteger(id) || id <= 0) throw new SceneRuleError('Scene not found.', HTTP_STATUS.NOT_FOUND);
  const scene = await db.character_scenes.findFirst({ where: { id, character_id: Number(characterId), deleted: false } });
  if (!scene) throw new SceneRuleError('Scene not found.', HTTP_STATUS.NOT_FOUND);
  return scene;
}

export async function updateCharacterScene({ characterId, sceneId, sceneGoal, sceneNotes, npcCharacterId, affinityReward }, db = prisma) {
  try {
    const scene = await findOwnedScene(db, characterId, sceneId);
    if (scene.scene_stage !== SCENE_STAGE.ON_GOING) throw new SceneRuleError('Only on-going scenes can be edited.');
    const data = {};
    if (sceneGoal !== undefined) data.scene_goal = cleanText(sceneGoal, SCENE_FIELD_MAX_LENGTHS.scene_goal, 'Scene goal', true);
    if (sceneNotes !== undefined) data.scene_notes = cleanText(sceneNotes ?? '', SCENE_FIELD_MAX_LENGTHS.scene_notes, 'Scene notes') || '';
    const npcId = await resolveNpcCharacterId(db, npcCharacterId);
    if (npcId !== undefined) data.npc_character_id = npcId;
    const reward = cleanAffinityReward(affinityReward);
    if (reward !== undefined) data.affinity_reward = reward;
    requireNpcForAffinity(reward ?? scene.affinity_reward, npcId !== undefined ? npcId : scene.npc_character_id);
    const updated = await db.character_scenes.update({ where: { id: scene.id }, data, include: sceneInclude });
    return formatScene(updated);
  } catch (error) {
    if (error instanceof SceneRuleError || error.name === ERROR_NAMES.DATABASE_OPERATION) throw error;
    throw databaseError('sceneContainer', 'updateCharacterScene', error);
  }
}

export async function setSceneStage({ characterId, sceneId, stage, notesAppend = '' }, db = prisma) {
  try {
    const scene = await findOwnedScene(db, characterId, sceneId);
    if (scene.scene_stage !== SCENE_STAGE.ON_GOING) throw new SceneRuleError('This scene is no longer on-going.');
    const data = { scene_stage: stage };
    const extra = String(notesAppend || '').trim();
    if (extra) data.scene_notes = `${scene.scene_notes ? `${scene.scene_notes}\n` : ''}${extra}`.slice(0, SCENE_FIELD_MAX_LENGTHS.scene_notes);
    const claimed = await db.character_scenes.updateMany({ where: { id: scene.id, scene_stage: SCENE_STAGE.ON_GOING, deleted: false }, data });
    if (!claimed.count) throw new SceneRuleError('This scene is no longer on-going.');
    const updated = await db.character_scenes.findUnique({ where: { id: scene.id }, include: sceneInclude });
    return formatScene(updated);
  } catch (error) {
    if (error instanceof SceneRuleError || error.name === ERROR_NAMES.DATABASE_OPERATION) throw error;
    throw databaseError('sceneContainer', 'setSceneStage', error);
  }
}

export function abandonCharacterScene({ characterId, sceneId }, db = prisma) {
  return setSceneStage({ characterId, sceneId, stage: SCENE_STAGE.ABANDONED }, db);
}

async function applySceneAffinityReward(db, scene) {
  const delta = Math.trunc(Number(scene?.affinity_reward) || 0);
  if (!delta || !scene.npc_character_id) return null;
  const [player, npc] = await Promise.all([
    db.players.findFirst({ where: { character_id: scene.character_id, deleted: false }, select: { character_id: true } }),
    db.npcs.findFirst({ where: { character_id: scene.npc_character_id, deleted: false }, select: { character_id: true, character: { select: { name: true } } } })
  ]);
  if (!player || !npc) return null;
  const where = { player_character_id_npc_character_id: { player_character_id: player.character_id, npc_character_id: npc.character_id } };
  const current = await db.player_npc_relationships.findUnique({ where, select: { affinity: true } });
  const before = clampAffinity(current?.affinity ?? 0);
  const affinity = clampAffinity(before + delta);
  const status = getAffinityStatus(affinity);
  const note = `Scene solved: "${scene.scene_goal}" (${delta > 0 ? '+' : ''}${delta} affinity)`.slice(0, RELATIONSHIP_NOTE_MAX_LENGTH);
  await db.player_npc_relationships.upsert({
    where,
    create: { player_character_id: player.character_id, npc_character_id: npc.character_id, affinity, status, interaction_notes: note },
    update: { affinity, status, interaction_notes: note, deleted: false }
  });
  return { npc_character_id: npc.character_id, npc_name: npc.character?.name || null, delta: affinity - before, affinity, status };
}

function forgetCachedRelationship(characterId, npcName) {
  const store = npcRelationshipManager?.store;
  if (!store || typeof store.keys !== 'function') return;
  const suffix = `::${String(characterId).trim().toLowerCase()}::${String(npcName || '').trim().toLowerCase()}`;
  for (const key of [...store.keys()]) if (key.endsWith(suffix)) store.delete(key);
}

export async function solveCharacterScene({ characterId, sceneId, resolution = '' }, db = prisma) {
  const solve = async (tx) => {
    const scene = await setSceneStage({ characterId, sceneId, stage: SCENE_STAGE.SOLVED, notesAppend: resolution ? `Resolution: ${resolution}` : '' }, tx);
    try {
      return { ...scene, affinity_change: await applySceneAffinityReward(tx, scene) };
    } catch (error) {
      throw databaseError('sceneContainer', 'applySceneAffinityReward', error);
    }
  };
  const result = db === prisma ? await prisma.$transaction(solve) : await solve(db);
  if (result.affinity_change?.npc_name) forgetCachedRelationship(result.character_id, result.affinity_change.npc_name);
  return result;
}

export async function appendSceneNotes({ characterId, sceneId, note }, db = prisma) {
  try {
    const scene = await findOwnedScene(db, characterId, sceneId);
    if (scene.scene_stage !== SCENE_STAGE.ON_GOING) throw new SceneRuleError('This scene is no longer on-going.');
    const text = String(note || '').trim();
    if (!text) return formatScene(scene);
    const updated = await db.character_scenes.update({
      where: { id: scene.id },
      data: { scene_notes: `${scene.scene_notes ? `${scene.scene_notes}\n` : ''}${text}`.slice(-SCENE_FIELD_MAX_LENGTHS.scene_notes) },
      include: sceneInclude
    });
    return formatScene(updated);
  } catch (error) {
    if (error instanceof SceneRuleError || error.name === ERROR_NAMES.DATABASE_OPERATION) throw error;
    throw databaseError('sceneContainer', 'appendSceneNotes', error);
  }
}

export async function adjustSceneChaosFactor({ characterId, sceneId, delta }, db = prisma) {
  if (!sceneId || !delta) return null;
  try {
    const scene = await db.character_scenes.findFirst({ where: { id: Number(sceneId), character_id: Number(characterId), deleted: false, scene_stage: SCENE_STAGE.ON_GOING } });
    if (!scene) return null;
    const next = clampChaosFactor((scene.chaos_factor ?? DEFAULT_CHAOS_FACTOR) + Number(delta));
    if (next === scene.chaos_factor) return formatScene(scene);
    const updated = await db.character_scenes.update({ where: { id: scene.id }, data: { chaos_factor: next }, include: sceneInclude });
    return formatScene(updated);
  } catch (error) {
    throw databaseError('sceneContainer', 'adjustSceneChaosFactor', error);
  }
}

function summarySceneIds(sceneIds) {
  const ids = [...new Set((Array.isArray(sceneIds) ? sceneIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) throw new SceneRuleError('Choose at least one scene to summarize.');
  if (ids.length > SCENE_SUMMARY_MAX_SCENES) throw new SceneRuleError(`You can summarize up to ${SCENE_SUMMARY_MAX_SCENES} scenes at a time.`);
  return ids;
}

async function placeNames(db, scenes) {
  const locationIds = [...new Set(scenes.map((scene) => scene.location_id).filter(Boolean))];
  const sublocationIds = [...new Set(scenes.map((scene) => scene.sublocation_id).filter(Boolean))];
  const [locations, sublocations] = await Promise.all([
    locationIds.length ? db.locations.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } }) : [],
    sublocationIds.length ? db.sublocations.findMany({ where: { id: { in: sublocationIds } }, select: { id: true, name: true } }) : []
  ]);
  return {
    locations: new Map(locations.map((row) => [row.id, row.name])),
    sublocations: new Map(sublocations.map((row) => [row.id, row.name]))
  };
}

function sceneSummaryContent(scene, names, realName, knownName, nameRevealed) {
  const place = [names.sublocations.get(scene.sublocation_id), names.locations.get(scene.location_id)].filter(Boolean).join(', ');
  const text = [
    `Goal: ${scene.scene_goal}`,
    `Stage: ${scene.scene_stage}`,
    place ? `Place: ${place}` : '',
    scene.scene_notes ? `Notes: ${scene.scene_notes}` : ''
  ].filter(Boolean).join('\n').slice(0, SCENE_SUMMARY_CONTENT_MAX_LENGTH);
  return nameRevealed ? text : maskUnrevealedName(text, realName, knownName);
}

export async function summarizeScenesToNpcMemories({ sceneIds, memoryType, addFrom = MEMORY_ADD_FROM.ADMIN_SUMMARIZE_SCENES, modelInstance = null }, db = prisma) {
  const ids = summarySceneIds(sceneIds);
  if (!SCENE_SUMMARY_MEMORY_TYPES.includes(memoryType)) throw new SceneRuleError(`Memory type must be one of: ${SCENE_SUMMARY_MEMORY_TYPES.join(', ')}.`);
  if (!Object.values(MEMORY_ADD_FROM).includes(addFrom)) throw new SceneRuleError('Unknown memory source.');
  let scenes;
  try {
    scenes = await db.character_scenes.findMany({
      where: { id: { in: ids }, deleted: false },
      include: { character: { select: { id: true, name: true } }, npc_character: { select: { id: true, name: true, character_type: true, deleted: true } } },
      orderBy: { id: 'asc' }
    });
  } catch (error) {
    throw databaseError('sceneContainer', 'summarizeScenesToNpcMemories', error);
  }
  if (scenes.length !== ids.length) throw new SceneRuleError('Some selected scenes no longer exist.', HTTP_STATUS.NOT_FOUND);
  const withoutNpc = scenes.filter((scene) => !scene.npc_character || scene.npc_character.deleted || scene.npc_character.character_type !== CHARACTER_TYPE.NPC);
  if (withoutNpc.length) throw new SceneRuleError(`Scenes need an NPC to summarize into memory: #${withoutNpc.map((scene) => scene.id).join(', #')}.`);

  const groups = new Map();
  for (const scene of scenes) {
    const key = `${scene.npc_character_id}:${scene.character_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(scene);
  }

  let names;
  try {
    names = await placeNames(db, scenes);
  } catch (error) {
    throw databaseError('sceneContainer', 'summarizeScenesToNpcMemories', error);
  }
  const results = [];
  for (const group of groups.values()) {
    const { npc_character: npc, character } = group[0];
    const realName = character?.name || 'Adventurer';
    const identity = await getNpcIdentity(db, character.id, npc.id);
    const nameRevealed = Boolean(identity?.is_player_name_revealed);
    const knownName = nameNpcUses(identity, realName) || UNREVEALED_PLAYER_NAME;
    const payload = {
      scenes_list: group.map((scene) => ({ id: scene.id, content: sceneSummaryContent(scene, names, realName, knownName, nameRevealed) })),
      is_nsfw: group.some((scene) => Boolean(scene.is_nsfw)),
      is_secret: group.some((scene) => Boolean(scene.is_secret)),
      memory_type: memoryType,
      add_from: addFrom
    };
    const { memory, isFallback } = await sceneMemorySummarySubagent({ npcName: npc.name || 'NPC', playerName: knownName, nameRevealed, payload, modelInstance, logName: realName });
    const saved = await createNpcMemory({
      db,
      npcCharacterId: npc.id,
      targetCharacterId: character.id,
      content: nameRevealed ? memory : maskUnrevealedName(memory, realName, knownName),
      memoryType,
      isSecret: payload.is_secret,
      isNsfw: payload.is_nsfw,
      addFrom
    });
    results.push({
      npc_character_id: npc.id,
      npc_name: npc.name,
      character_id: character.id,
      character_name: realName,
      scene_ids: group.map((scene) => scene.id),
      is_fallback: isFallback,
      memory: saved ? { id: saved.id, content: saved.content, memory_type: saved.memory_type, is_secret: saved.is_secret, is_nsfw: saved.is_nsfw, add_from: saved.add_from } : null
    });
  }
  return results;
}
