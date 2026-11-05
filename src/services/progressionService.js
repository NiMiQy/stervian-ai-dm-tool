import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { ATTRIBUTE_POINTS_PER_LEVEL } from '../configs/constants.js';
import { calculateLevelRewards, proficiencyForLevel, spellPointsForLevel } from '../containers/progressionContainer.js';

async function syncSpellPoints(tx, characterId, level) {
  const slots = spellPointsForLevel(level);
  const existing = await tx.character_spellpoints.findMany({ where: { character_id: characterId, deleted: false } });
  for (const [slotLevel, maxCurrent] of Object.entries(slots)) {
    const current = existing.find((slot) => Number(slot.level) === Number(slotLevel));
    if (current) {
      await tx.character_spellpoints.update({ where: { id: current.id }, data: { max_current: maxCurrent, current: maxCurrent } });
    } else {
      await tx.character_spellpoints.create({ data: { character_id: characterId, level: Number(slotLevel), max_current: maxCurrent, current: maxCurrent } });
    }
  }
}

export async function applyLevelRewards(userId, gainedExp) {
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, include: { character_stat: true, player: true } });
      if (!character || character.deleted || !character.character_stat || !character.player) return { error: 'Character not found.' };
      const { levelChanged, result: evaluation } = calculateLevelRewards(character.level, character.current_exp, gainedExp);
      await tx.characters.update({ where: { id: character.id }, data: { level: evaluation.level, current_exp: evaluation.currentExp } });
      await tx.character_stats.update({ where: { id: character.character_stat.id }, data: { proficiency: proficiencyForLevel(evaluation.level), current_hp: levelChanged ? character.character_stat.max_hp : character.character_stat.current_hp, current_energy: levelChanged ? character.character_stat.max_energy : character.character_stat.current_energy } });
      if (levelChanged) {
        await tx.players.update({ where: { character_id: character.id }, data: { current_point_spend: { increment: evaluation.levelUps * ATTRIBUTE_POINTS_PER_LEVEL } } });
        await syncSpellPoints(tx, character.id, evaluation.level);
      }
      return evaluation;
    });
  } catch (error) {
    throw databaseError('applyLevelRewards', 'apply character progression', error);
  }
}
