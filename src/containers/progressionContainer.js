import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  EXPERIENCE_THRESHOLDS,
  EXP_BONUS_PER_LEVEL_ABOVE_TEMPLATE,
  MAX_EXPERIENCE,
  MAX_LEVEL,
  MAX_PROFICIENCY,
  PROFICIENCY_TIERS,
  SPELL_POINT_TIERS,
} from '../configs/constants.js';

export { EXPERIENCE_THRESHOLDS, MAX_EXPERIENCE, MAX_LEVEL, PROFICIENCY_TIERS, SPELL_POINT_TIERS };

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function experienceForNextLevel(level) {
  const normalizedLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(finite(level, 1))));
  return normalizedLevel >= MAX_LEVEL ? MAX_EXPERIENCE : EXPERIENCE_THRESHOLDS[normalizedLevel + 1];
}

export function proficiencyForLevel(level) {
  const normalizedLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(finite(level, 1))));
  return PROFICIENCY_TIERS.find((tier) => normalizedLevel <= tier.throughLevel)?.proficiency || MAX_PROFICIENCY;
}

export function spellPointsForLevel(level) {
  const normalizedLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(finite(level, 1))));
  return { ...SPELL_POINT_TIERS[normalizedLevel] };
}

export function calculateExpReward(defeatedEnemies = []) {
  return (Array.isArray(defeatedEnemies) ? defeatedEnemies : [defeatedEnemies]).reduce((total, enemy) => {
    const level = Math.max(1, finite(enemy?.level, 1));
    const templateBaseLevel = Math.max(1, finite(enemy?.templateBaseLevel, 1));
    const baseExp = Math.max(0, finite(enemy?.baseExp ?? enemy?.experience_reward));
    const multiplier = Math.max(0, finite(enemy?.multiplier, 1));
    const levelBonus = 1 + EXP_BONUS_PER_LEVEL_ABOVE_TEMPLATE * Math.max(0, level - templateBaseLevel);
    return total + Math.floor(Math.round(baseExp * levelBonus * multiplier * 1e4) / 1e4);
  }, 0);
}

export function evaluateLevelUp(currentLevel, currentExp, gainedExp) {
  const startingLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(finite(currentLevel, 1))));
  const totalExp = Math.min(MAX_EXPERIENCE, Math.max(0, finite(currentExp) + Math.max(0, finite(gainedExp))));
  let level = startingLevel;
  while (level < MAX_LEVEL && totalExp >= EXPERIENCE_THRESHOLDS[level + 1]) level += 1;
  const levelUps = level - startingLevel;
  const levelStartExp = EXPERIENCE_THRESHOLDS[level];
  const nextLevelExp = experienceForNextLevel(level);
  return {
    previousLevel: startingLevel,
    level,
    levelUps,
    currentExp: totalExp,
    remainingExp: Math.max(0, totalExp - levelStartExp),
    nextLevelExp,
    requiredExp: level >= MAX_LEVEL ? 0 : nextLevelExp - levelStartExp,
    isMaxLevel: level >= MAX_LEVEL,
  };
}

export function calculateLevelRewards(currentLevel, currentExp, gainedExp) {
  const evaluation = evaluateLevelUp(currentLevel, currentExp, gainedExp);
  return {
    levelChanged: evaluation.level > evaluation.previousLevel,
    result: {
      ...evaluation,
      gainedExp: Math.max(0, finite(gainedExp)),
      pointsAwarded: evaluation.levelUps * ATTRIBUTE_POINTS_PER_LEVEL,
    },
  };
}
