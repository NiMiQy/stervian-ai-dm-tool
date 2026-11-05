import { HUNGER_EFFECTS, STATUS_LABELS, STATUS_LABEL_PREFIX, THIRST_EFFECTS } from '../configs/constants.js';

export const hungerEffects = HUNGER_EFFECTS;
export const thirstEffects = THIRST_EFFECTS;

export function getHungerState(stats = {}) {
  const max = stats.max_food;
  const current = stats.current_food;
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(current)) return null;
  return [...hungerEffects].reverse().find((effect) => Math.max(0, current) * 100 <= max * effect.threshold) || null;
}

export function hungerDamage(total, hunger) {
  return total > 0 && hunger ? Math.max(1, Math.floor(total * (100 - hunger.reduction) / 100)) : total;
}

export function refreshHungerStatus(unit) {
  const hungerNames = hungerEffects.map((effect) => `${STATUS_LABEL_PREFIX}${effect.name}`);
  unit.statuses = (unit.statuses || []).filter((status) => !hungerNames.includes(status) && status !== STATUS_LABELS.NORMAL);
  const hunger = getHungerState(unit);
  if (hunger && !unit.isDefeated) unit.statuses.push(`${STATUS_LABEL_PREFIX}${hunger.name}`);
  if (!unit.statuses.length) unit.statuses.push(STATUS_LABELS.NORMAL);
}

export function getThirstState(stats = {}) {
  const max = stats.max_water;
  const current = stats.current_water;
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(current)) return null;
  return [...thirstEffects].reverse().find((effect) => Math.max(0, current) * 100 <= max * effect.threshold) || null;
}

export function skillEnergyCost(skill, stats) {
  const base = Math.max(0, Number(skill.energy_consume_cost) || 0);
  const thirst = getThirstState(stats);
  return Math.ceil(base * (100 + (thirst?.increase ?? 0)) / 100);
}

export function refreshThirstStatus(unit) {
  const names = thirstEffects.map((effect) => `${STATUS_LABEL_PREFIX}${effect.name}`);
  unit.statuses = (unit.statuses || []).filter((status) => !names.includes(status) && status !== STATUS_LABELS.NORMAL);
  const thirst = getThirstState(unit);
  if (thirst && !unit.isDefeated) unit.statuses.push(`${STATUS_LABEL_PREFIX}${thirst.name}`);
  if (!unit.statuses.length) unit.statuses.push(STATUS_LABELS.NORMAL);
  unit.skills = (unit.skills || []).map((skill) => ({ ...skill, effective_energy_cost: unit.isEnemy ? 0 : skillEnergyCost(skill, unit) }));
}
