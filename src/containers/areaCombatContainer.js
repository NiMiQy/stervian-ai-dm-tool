import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { createEncounter } from './core/battleSystemCore.js';
import { getCharacterSheet } from './characterContainer.js';
import { getUserActiveParty } from './partyContainer.js';
import { AREA_COMBAT, CHARACTER_TYPE, HTTP_STATUS, MAX_ENCOUNTER_ENEMIES } from '../configs/constants.js';

const ruleError = (error, statusCode = HTTP_STATUS.BAD_REQUEST) => ({ error, statusCode });

export async function getAreaCombatTargets(userId) {
  try {
    const character = await prisma.characters.findUnique({
      where: { user_id: userId },
      select: { location_id: true, sublocation_id: true }
    });
    if (!character) return null;

    const scope = character.sublocation_id
      ? { sublocation_id: character.sublocation_id }
      : character.location_id
        ? { location_id: character.location_id, sublocation_id: null }
        : null;
    if (!scope) return { monsters: [], npcs: [] };

    const appearances = await prisma.npcs_in_locations_or_sublocations.findMany({
      where: {
        deleted: false,
        ...scope,
        npc: {
          is: {
            deleted: false,
            is_attackable: true,
            character: { is: { deleted: false, character_type: CHARACTER_TYPE.NPC } }
          }
        }
      },
      select: {
        npc: {
          select: {
            character_id: true,
            npc_monsters: { select: { deleted: true } },
            character: { select: { id: true, name: true, level: true, race: true, job: true } }
          }
        }
      }
    });

    const monsters = new Map();
    const npcs = new Map();
    for (const { npc } of appearances) {
      const entry = npc?.character;
      if (!entry) continue;
      const view = {
        id: entry.id,
        name: entry.name || 'Unknown',
        level: Math.max(1, Number(entry.level) || 1),
        race: entry.race || null,
        job: entry.job || null
      };
      if (npc.npc_monsters) {
        if (npc.npc_monsters.deleted !== true) monsters.set(view.id, view);
      } else {
        npcs.set(view.id, view);
      }
    }

    const byName = (a, b) => a.name.localeCompare(b.name) || a.level - b.level;
    return { monsters: [...monsters.values()].sort(byName), npcs: [...npcs.values()].sort(byName) };
  } catch (error) {
    throw databaseError('getAreaCombatTargets', 'read', error);
  }
}

export function normalizeAreaCombatSelection(rawTargets) {
  if (!Array.isArray(rawTargets) || !rawTargets.length) return ruleError('Choose at least one target to fight.');
  const seen = new Set();
  const targets = [];
  for (const raw of rawTargets) {
    const id = Number(raw?.id);
    const count = Number(raw?.count ?? 1);
    if (!Number.isInteger(id) || id <= 0) return ruleError('Select a valid target.');
    if (!Number.isInteger(count) || count < 1 || count > MAX_ENCOUNTER_ENEMIES) return ruleError(`Each target count must be between 1 and ${MAX_ENCOUNTER_ENEMIES}.`);
    if (seen.has(id)) return ruleError('Each target can only be listed once.');
    seen.add(id);
    targets.push({ id, count });
  }
  const total = targets.reduce((sum, target) => sum + target.count, 0);
  if (total > MAX_ENCOUNTER_ENEMIES) return ruleError(`An encounter can contain at most ${MAX_ENCOUNTER_ENEMIES} enemies.`);
  return { targets, total };
}

export function resolveAreaCombatNames(area, targets) {
  const monsterById = new Map((area?.monsters || []).map((entry) => [entry.id, entry]));
  const npcById = new Map((area?.npcs || []).map((entry) => [entry.id, entry]));
  const npcTargets = targets.filter((target) => npcById.has(target.id));
  if (targets.some((target) => !monsterById.has(target.id) && !npcById.has(target.id))) {
    return ruleError(AREA_COMBAT.NOT_HERE_ERROR);
  }
  if (npcTargets.length) {
    if (targets.length !== 1 || npcTargets[0].count !== 1) return ruleError(AREA_COMBAT.NPC_ONLY_ONE_ERROR);
    return { names: [npcById.get(npcTargets[0].id).name], isNpc: true };
  }
  const names = targets.flatMap((target) => Array(target.count).fill(monsterById.get(target.id).name));
  return { names, isNpc: false };
}

export async function startAreaEncounter(userId, rawTargets) {
  const selection = normalizeAreaCombatSelection(rawTargets);
  if (selection.error) return selection;

  const partyInfo = await getUserActiveParty(userId);
  const party = partyInfo?.party || null;
  if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
    return ruleError(AREA_COMBAT.LEADER_ONLY_ERROR, HTTP_STATUS.FORBIDDEN);
  }

  const area = await getAreaCombatTargets(userId);
  if (!area) return ruleError('Character not found.', HTTP_STATUS.NOT_FOUND);
  const resolved = resolveAreaCombatNames(area, selection.targets);
  if (resolved.error) return resolved;

  const battle = await createEncounter(userId, () => getCharacterSheet(userId), resolved.names);
  if (battle?.error) return ruleError(battle.error, HTTP_STATUS.NOT_FOUND);
  return { battle };
}
