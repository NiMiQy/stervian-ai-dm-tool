import { executeHarvest, getHarvestData, GatheringRuleError, isFishingLootGroup } from './gatheringContainer.js';
import {
  ERROR_NAMES,
  FISHING_BASE_EXP,
  FISHING_ENERGY_COST,
  FISHING_RARE_BONUS_EXP,
  HTTP_STATUS,
  LIFESKILL_DESCRIPTIONS,
  LIFESKILL_NAMES,
} from '../configs/constants.js';

class FishingRuleError extends GatheringRuleError {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message, statusCode);
    this.name = ERROR_NAMES.FISHING_RULE;
  }
}

class FishingConflictError extends FishingRuleError {
  constructor(message) {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = ERROR_NAMES.FISHING_CONFLICT;
  }
}

export const FISHING_PROFILE = Object.freeze({
  lifeskillName: LIFESKILL_NAMES.FISHING,
  lifeskillDescription: LIFESKILL_DESCRIPTIONS.FISHING,
  energyCost: FISHING_ENERGY_COST,
  baseExp: FISHING_BASE_EXP,
  rareBonusExp: FISHING_RARE_BONUS_EXP,
  includeGroup: isFishingLootGroup,
  requireLootGroups: true,
  noLootGroupsMessage: 'There is no fishing spot in this area.',
  noEnergyMessage: 'You do not have enough energy to fish.',
  energyChangedMessage: 'Your energy changed before fishing completed. Please try again.',
  RuleError: FishingRuleError,
  ConflictError: FishingConflictError,
  dataOperation: ['getFishingData', 'retrieve fishing data'],
  actionOperation: ['executeFish', 'execute fishing action']
});

export function getFishingData(userId) {
  return getHarvestData(userId, FISHING_PROFILE);
}

export function executeFish(userId) {
  return executeHarvest(userId, FISHING_PROFILE);
}

export { FishingConflictError, FishingRuleError };
