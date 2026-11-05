import { clampAffinity, getAffinityPriceMultiplier, getAffinityStatus } from './ai/subagents/relationships.js';
import { CHARACTER_TYPE, HOSTILE_AFFINITY, RELATIONSHIP_STATUS } from '../configs/constants.js';

export async function getSublocationOwnerAffinity(client, playerCharacterId, sublocation) {
  const ownerCharacterId = Number(sublocation?.owner_id);
  if (!Number.isInteger(ownerCharacterId) || ownerCharacterId <= 0 || !playerCharacterId) {
    return { owner: null, affinity: 0, status: RELATIONSHIP_STATUS.STRANGER, hostile: false };
  }
  const owner = await client.characters.findFirst({
    where: { id: ownerCharacterId, character_type: CHARACTER_TYPE.NPC, deleted: false, npc: { is: { deleted: false } } },
    select: { id: true, name: true }
  });
  if (!owner) return { owner: null, affinity: 0, status: RELATIONSHIP_STATUS.STRANGER, hostile: false };
  const relationship = await client.player_npc_relationships.findUnique({
    where: { player_character_id_npc_character_id: { player_character_id: Number(playerCharacterId), npc_character_id: owner.id } },
    select: { affinity: true }
  });
  const affinity = clampAffinity(relationship?.affinity);
  return { owner, affinity, status: getAffinityStatus(affinity), hostile: affinity === HOSTILE_AFFINITY };
}

export function adjustNpcPrice(basePrice, affinity, service = false) {
  const base = Number(basePrice);
  const multiplier = getAffinityPriceMultiplier(affinity, service);
  if (multiplier === null) return null;
  if (!Number.isSafeInteger(base) || base < 0) return null;
  const adjusted = Math.round(base * multiplier);
  return Number.isSafeInteger(adjusted) ? adjusted : null;
}
