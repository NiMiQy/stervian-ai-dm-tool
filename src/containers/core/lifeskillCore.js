import {
  LIFESKILL_BONUS_YIELD_QUANTITY,
  LIFESKILL_DEFAULT_RANK,
  LIFESKILL_EXP_PER_LEVEL,
  LIFESKILL_FORMULAS,
  LIFESKILL_MASTERY_PER_LEVEL,
  LIFESKILL_RANKS,
  MASS_PROCESS_UNLOCK_RANKS,
} from '../../configs/constants.js';

const cappedPercent = (value, cap) => Math.min(cap, Math.round(value * 10) / 10);
const linearChance = ({ base = 0, perLevel, cap }, levelOffset) => cappedPercent(base + levelOffset * perLevel, cap);

export function getLifeSkillRankTitle(level) {
  const lvl = Math.max(1, Number(level) || 1);
  return LIFESKILL_RANKS.find((rank) => lvl > rank.above)?.title || LIFESKILL_DEFAULT_RANK;
}

export function calculateBdoLifeSkillFormulas(level) {
  const currentLevel = Math.max(1, Number(level) || 1);
  const levelOffset = currentLevel - 1;
  const freeEnergy = LIFESKILL_FORMULAS.FREE_ENERGY_CHANCE;
  const uncommonChancePct = linearChance(LIFESKILL_FORMULAS.UNCOMMON_CHANCE, levelOffset);
  const rareChancePct = linearChance(LIFESKILL_FORMULAS.RARE_CHANCE, levelOffset);
  const legendaryChancePct = linearChance(LIFESKILL_FORMULAS.LEGENDARY_CHANCE, levelOffset);
  const freeEnergyChancePct = cappedPercent(Math.floor(currentLevel / freeEnergy.levelsPerStep) * freeEnergy.perStep, freeEnergy.cap);
  const bonusYieldChancePct = linearChance(LIFESKILL_FORMULAS.BONUS_YIELD_CHANCE, levelOffset);
  const successRateBonusPct = linearChance(LIFESKILL_FORMULAS.SUCCESS_RATE_BONUS, levelOffset);
  const maxYieldChancePct = linearChance(LIFESKILL_FORMULAS.MAX_YIELD_CHANCE, levelOffset);
  const nextLevelExp = currentLevel * LIFESKILL_EXP_PER_LEVEL;
  const mastery = currentLevel * LIFESKILL_MASTERY_PER_LEVEL;
  const rank = getLifeSkillRankTitle(currentLevel);

  return {
    level: currentLevel,
    rank,
    mastery,
    uncommonChancePct,
    rareChancePct,
    legendaryChancePct,
    freeEnergyChancePct,
    freeGatherChancePct: freeEnergyChancePct,
    bonusYieldChancePct,
    successRateBonusPct,
    maxYieldChancePct,
    canMassProcess: MASS_PROCESS_UNLOCK_RANKS.includes(rank),
    nextLevelExp
  };
}

export function applyLifeSkillExpGain(currentLevel, currentExp, expGained) {
  const baseLevel = Math.max(1, Number(currentLevel) || 1);
  const baseExp = Math.max(0, Number(currentExp) || 0);
  const gain = Math.max(0, Number(expGained) || 0);

  let newExp = baseExp + gain;
  let newLevel = baseLevel;
  let leveledUp = false;
  let levelsGained = 0;

  while (newExp >= (newLevel * LIFESKILL_EXP_PER_LEVEL)) {
    newExp -= (newLevel * LIFESKILL_EXP_PER_LEVEL);
    newLevel += 1;
    leveledUp = true;
    levelsGained += 1;
  }

  const nextFormulas = calculateBdoLifeSkillFormulas(newLevel);

  return {
    newLevel,
    newExp,
    leveledUp,
    levelsGained,
    nextLevelExp: nextFormulas.nextLevelExp,
    rank: nextFormulas.rank,
    mastery: nextFormulas.mastery
  };
}

export function rollBdoEnergyCost(level, baseEnergyCost = 1) {
  const formulas = calculateBdoLifeSkillFormulas(level);
  const isFree = Math.random() < (formulas.freeEnergyChancePct / 100);
  return {
    energyConsumed: isFree ? 0 : Math.max(0, Number(baseEnergyCost) || 0),
    isFree,
    freeEnergyChancePct: formulas.freeEnergyChancePct
  };
}

export function rollBdoCraftingYield(level, baseOutputQuantity = 1, baseSuccessRate = 1.0) {
  const formulas = calculateBdoLifeSkillFormulas(level);
  const effectiveSuccessRate = Math.min(1.0, Math.max(0, Number(baseSuccessRate || 1.0) + (formulas.successRateBonusPct / 100)));
  const isSuccess = Math.random() <= effectiveSuccessRate;

  if (!isSuccess) {
    return {
      success: false,
      outputQuantity: 0,
      hasBonusYield: false,
      effectiveSuccessRate
    };
  }

  const hasBonusYield = Math.random() < (formulas.bonusYieldChancePct / 100);
  const finalQuantity = Math.max(1, Number(baseOutputQuantity) || 1) + (hasBonusYield ? LIFESKILL_BONUS_YIELD_QUANTITY : 0);

  return {
    success: true,
    outputQuantity: finalQuantity,
    hasBonusYield,
    effectiveSuccessRate
  };
}

export function rollRecipeOutputQuantity(level, minQuantity = 1, maxQuantity = 1) {
  const min = Math.max(1, Number(minQuantity) || 1);
  const max = Math.max(min, Number(maxQuantity) || min);
  if (max === min) return { quantity: min, isMaxYield: true };
  const { maxYieldChancePct } = calculateBdoLifeSkillFormulas(level);
  if (Math.random() < (maxYieldChancePct / 100)) return { quantity: max, isMaxYield: true };
  return { quantity: Math.floor(Math.random() * (max - min)) + min, isMaxYield: false };
}

export function canMassProcess(level) {
  return calculateBdoLifeSkillFormulas(level).canMassProcess;
}
