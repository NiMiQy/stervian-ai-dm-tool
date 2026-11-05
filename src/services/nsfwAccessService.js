import { databaseError } from '../database/databaseError.js';

export const NSFW_PLAYER_SELECT = { verified: true, is_nsfw: true, deleted: true };

export function canAccessNsfw(player) {
  return Boolean(player && !player.deleted && player.verified === true && player.is_nsfw === true);
}

export function isNsfwRecord(record) {
  return record?.is_nsfw === true;
}

export async function getNsfwAccess(client, characterId) {
  const id = Number(characterId);
  if (!Number.isInteger(id) || id <= 0) return false;
  try {
    const player = await client.players.findUnique({ where: { character_id: id }, select: NSFW_PLAYER_SELECT });
    return canAccessNsfw(player);
  } catch (error) {
    throw databaseError('getNsfwAccess', 'read NSFW access', error);
  }
}

export async function getNsfwAccessByUserId(client, userId) {
  if (typeof userId !== 'string' || !userId) return false;
  try {
    const character = await client.characters.findUnique({ where: { user_id: userId }, select: { player: { select: NSFW_PLAYER_SELECT } } });
    return canAccessNsfw(character?.player);
  } catch (error) {
    throw databaseError('getNsfwAccessByUserId', 'read NSFW access', error);
  }
}

export function nsfwItemWhere(allowed) {
  return allowed ? {} : { is_nsfw: false };
}

export function nsfwWhere(allowed) {
  return allowed ? {} : { OR: [{ is_nsfw: false }, { is_nsfw: null }] };
}

export function filterNsfw(records, allowed, pick = (record) => record) {
  const list = Array.isArray(records) ? records : [];
  return allowed ? list : list.filter((record) => !isNsfwRecord(pick(record)));
}

export function recipeHasNsfw(recipe) {
  return isNsfwRecord(recipe?.output_item) || (recipe?.ingredients || []).some((ingredient) => isNsfwRecord(ingredient.item));
}
