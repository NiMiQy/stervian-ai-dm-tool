import { databaseError, isTransactionConflict } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { CAMPFIRE_REST_MODES, CAMPING_TENT_ITEM_NAME, DEFAULT_MAX_ENERGY, ERROR_NAMES, HTTP_STATUS, ITEM_LOCATION, TRANSACTION_ISOLATION } from '../configs/constants.js';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

class CampfireRuleError extends Error {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = ERROR_NAMES.GATHERING_RULE;
    this.statusCode = statusCode;
  }
}

async function countTents(client, characterId) {
  const rows = await client.character_items.findMany({
    where: { character_id: characterId, location: ITEM_LOCATION.BACKPACK, deleted: false, items: { is: { name: CAMPING_TENT_ITEM_NAME, deleted: false } } },
    select: { quantity: true }
  });
  return rows.reduce((total, row) => total + Math.max(0, number(row.quantity, 1)), 0);
}

export async function getCampfireData(userId) {
  try {
    const character = await prisma.characters.findUnique({ where: { user_id: userId }, include: { location: true, character_stat: true } });
    if (!character || character.deleted || !character.character_stat) throw new CampfireRuleError('Character not found.');
    return {
      available: Boolean(character.location && !character.location.is_safe_zone),
      has_tent: (await countTents(prisma, character.id)) > 0,
      tent_item_name: CAMPING_TENT_ITEM_NAME,
      current_energy: number(character.character_stat.current_energy),
      max_energy: number(character.character_stat.max_energy, DEFAULT_MAX_ENERGY),
      current_hp: number(character.character_stat.current_hp),
      max_hp: number(character.character_stat.max_hp)
    };
  } catch (error) {
    if (error instanceof CampfireRuleError) throw error;
    throw databaseError('getCampfireData', 'read campfire data', error);
  }
}

export async function restAtCampfire(userId, mode) {
  if (!Object.values(CAMPFIRE_REST_MODES).includes(mode)) throw new CampfireRuleError('Choose a valid way to rest.');
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, include: { location: true, character_stat: true } });
      if (!character || character.deleted || !character.character_stat) throw new CampfireRuleError('Character not found.');
      if (!character.location || character.location.is_safe_zone) throw new CampfireRuleError('You can only make a campfire outside a safe zone.');
      const stats = character.character_stat;
      const withTent = mode === CAMPFIRE_REST_MODES.TENT;
      if (withTent && (await countTents(tx, character.id)) < 1) throw new CampfireRuleError(`You need a ${CAMPING_TENT_ITEM_NAME} to rest in a tent.`);
      const maxEnergy = number(stats.max_energy, DEFAULT_MAX_ENERGY);
      const maxHp = number(stats.max_hp);
      const data = { current_energy: maxEnergy };
      if (withTent) data.current_hp = maxHp;
      await tx.character_stats.update({ where: { id: stats.id }, data });
      const restoredEnergy = Math.max(0, maxEnergy - number(stats.current_energy));
      const restoredHp = withTent ? Math.max(0, maxHp - number(stats.current_hp)) : 0;
      return {
        success: true,
        mode,
        message: withTent ? `You rested in your tent by the campfire. Energy and HP fully restored (+${restoredEnergy} energy, +${restoredHp} HP).` : `You rested by the campfire. Energy fully restored (+${restoredEnergy} energy).`,
        current_energy: maxEnergy,
        max_energy: maxEnergy,
        current_hp: withTent ? maxHp : number(stats.current_hp),
        max_hp: maxHp
      };
    }, { isolationLevel: TRANSACTION_ISOLATION.SERIALIZABLE });
  } catch (error) {
    if (error instanceof CampfireRuleError) throw error;
    if (isTransactionConflict(error)) throw new CampfireRuleError('Your character changed while resting. Please try again.', HTTP_STATUS.CONFLICT);
    throw databaseError('restAtCampfire', 'rest at campfire', error);
  }
}

export { CampfireRuleError };
