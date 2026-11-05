import { randomInt } from 'node:crypto';
import {
  ABILITY_STAT_FIELDS,
  CHECK_ORDER,
  SKILL_CHECK,
  SKILL_CHECK_RESULT,
  SKILL_ROLL_MODE,
  SKILLS_FOR_STORY_PLAYING
} from '../../configs/constants.js';

export const SKILL_CHECK_RESULT_LABELS = Object.freeze({
  [SKILL_CHECK_RESULT.CRITICAL_SUCCESS]: 'Critical Success',
  [SKILL_CHECK_RESULT.SUCCESS]: 'Success',
  [SKILL_CHECK_RESULT.FAILURE]: 'Failure',
  [SKILL_CHECK_RESULT.CRITICAL_FAILURE]: 'Critical Failure'
});

export function findStorySkill(key) {
  return SKILLS_FOR_STORY_PLAYING[String(key || '').trim().toLowerCase()] || null;
}

export function normalizeRollMode(value) {
  const mode = String(value || '').trim().toUpperCase();
  return SKILL_ROLL_MODE[mode] || SKILL_ROLL_MODE.NORMAL;
}

export function normalizeCheckOrder(value) {
  const order = String(value || '').trim().toUpperCase();
  return CHECK_ORDER[order] || CHECK_ORDER.SKILL_FIRST;
}

export function parseDc(value) {
  if (value === undefined || value === null || value === '') return SKILL_CHECK.DC_DEFAULT;
  const dc = Number(value);
  if (!Number.isInteger(dc) || dc < SKILL_CHECK.DC_MIN || dc > SKILL_CHECK.DC_MAX) return null;
  return dc;
}

export function abilityModifier(score) {
  const value = Math.floor(Number(score) || 0);
  const cap = SKILL_CHECK.MODIFIER_SOFT_CAP_SCORE;
  if (value <= cap) return Math.floor((value - 10) / 2);
  return Math.floor((cap - 10) / 2) + Math.floor((value - cap) / SKILL_CHECK.POINTS_PER_BONUS_ABOVE_CAP);
}

export function abilityStatField(skill) {
  return ABILITY_STAT_FIELDS[skill?.ability] || null;
}

export function resolveSkillCheck({ skill, abilityScore, proficiency, dc, rollMode, rolls }) {
  const mode = normalizeRollMode(rollMode);
  const dice = (Array.isArray(rolls) ? rolls : []).map((roll) => Math.floor(Number(roll)));
  const die = mode === SKILL_ROLL_MODE.ADVANTAGE ? Math.max(dice[0], dice[1]) : dice[0];
  const abilityBonus = mode === SKILL_ROLL_MODE.DISADVANTAGE ? 0 : abilityModifier(abilityScore);
  const proficiencyBonus = Math.floor(Number(proficiency) || 0);
  const total = die + abilityBonus + proficiencyBonus;
  const naturalTwenty = die === SKILL_CHECK.DIE_SIDES;
  const naturalOne = die === 1;
  const result = naturalTwenty
    ? SKILL_CHECK_RESULT.CRITICAL_SUCCESS
    : naturalOne
      ? SKILL_CHECK_RESULT.CRITICAL_FAILURE
      : total >= dc ? SKILL_CHECK_RESULT.SUCCESS : SKILL_CHECK_RESULT.FAILURE;
  return {
    skill: skill.key,
    skillName: skill.name,
    ability: skill.ability,
    abilityScore: Math.floor(Number(abilityScore) || 0),
    rollMode: mode,
    rolls: dice,
    die,
    abilityBonus,
    proficiencyBonus,
    total,
    dc,
    result,
    resultLabel: SKILL_CHECK_RESULT_LABELS[result],
    success: result === SKILL_CHECK_RESULT.SUCCESS || result === SKILL_CHECK_RESULT.CRITICAL_SUCCESS
  };
}

export function rollD20(random = randomInt) {
  return random(1, SKILL_CHECK.DIE_SIDES + 1);
}

export function rollSkillCheck({ skill, abilityScore, proficiency, dc, rollMode }, random = randomInt) {
  const mode = normalizeRollMode(rollMode);
  const rolls = mode === SKILL_ROLL_MODE.ADVANTAGE ? [rollD20(random), rollD20(random)] : [rollD20(random)];
  return resolveSkillCheck({ skill, abilityScore, proficiency, dc, rollMode: mode, rolls });
}

function signed(value) {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function describeSkillRoll(skillCheck) {
  const ability = String(skillCheck.ability || '').toUpperCase();
  const dice = skillCheck.rollMode === SKILL_ROLL_MODE.ADVANTAGE
    ? `d20 with advantage: ${skillCheck.rolls.join(' and ')}, keeps ${skillCheck.die}`
    : skillCheck.rollMode === SKILL_ROLL_MODE.DISADVANTAGE
      ? `d20 with disadvantage (no ${ability} bonus): ${skillCheck.die}`
      : `d20: ${skillCheck.die}`;
  return `${dice} | ${ability} bonus ${signed(skillCheck.abilityBonus)} | Proficiency ${signed(skillCheck.proficiencyBonus)} | Total ${skillCheck.total} vs DC ${skillCheck.dc}`;
}

export function toStoredSkillCheck(skillCheck) {
  if (!skillCheck) return null;
  return {
    skill: skillCheck.skill,
    skillName: skillCheck.skillName,
    ability: skillCheck.ability,
    rollMode: skillCheck.rollMode,
    rolls: skillCheck.rolls,
    die: skillCheck.die,
    abilityBonus: skillCheck.abilityBonus,
    proficiencyBonus: skillCheck.proficiencyBonus,
    total: skillCheck.total,
    dc: skillCheck.dc,
    result: skillCheck.result,
    resultLabel: skillCheck.resultLabel,
    success: skillCheck.success,
    order: skillCheck.order || null,
    secretRevealed: Boolean(skillCheck.secretReveal)
  };
}

export function formatSkillCheckForPrompt(skillCheck) {
  if (!skillCheck) return '';
  const lines = [
    '### Skill Check This Turn (system-rolled, binding; see Skill Check Rules)',
    `Skill: ${skillCheck.skillName} (${String(skillCheck.ability || '').toUpperCase()}) | ${describeSkillRoll(skillCheck)} | Result: ${String(skillCheck.resultLabel || '').toUpperCase()}`
  ];
  if (skillCheck.secretReveal) {
    lines.push(`Secret Revealed: ${skillCheck.secretReveal.npcName} gives in and tells the player this secret, in character: "${skillCheck.secretReveal.content}"`);
  }
  return lines.join('\n');
}

export function formatCheckOrderForPrompt(order) {
  const first = order === CHECK_ORDER.FATE_FIRST ? 'Fate Check' : 'Skill Check';
  const second = order === CHECK_ORDER.FATE_FIRST ? 'Skill Check' : 'Fate Check';
  return `### Check Order This Turn\nThe ${first} happened first and the ${second} second. Narrate them in that order: the first result sets up the situation, the second resolves within it.`;
}
