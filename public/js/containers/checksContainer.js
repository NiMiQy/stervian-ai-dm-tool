import { createFateDice } from '../components/fateDice.js';
import { requestFateCheck, requestSkillCheck } from '../logics/authApi.js';
import {
  CHECK_ORDER,
  FATE_CHAOS_FROM_SCENE,
  FATE_CHAOS_OPTIONS,
  FATE_CHECK_QUESTION_MAX_LENGTH,
  FATE_DICE_HIDE_DELAY_MS,
  FATE_ODDS_DEFAULT,
  FATE_ODDS_OPTIONS,
  SKILL_CHECK,
  SKILL_DC_PRESETS,
  SKILL_ROLL_MODE,
  STORY_SKILLS
} from '../constants.js';

const DEFAULT_SKILL = 'perception';

export function describeSkillCheck(skillCheck) {
  if (!skillCheck) return '';
  return `🎯 ${skillCheck.skillName}: ${skillCheck.total} vs DC ${skillCheck.dc} — ${skillCheck.resultLabel}`;
}

function findSkill(key) {
  return STORY_SKILLS.find((skill) => skill.key === key) || STORY_SKILLS[0];
}

export function initChecksContainer({ getCharacterId, getComposerText = () => '', canUseChecks = () => true, notify = () => {}, onReady }) {
  const modal = document.querySelector('#checksModal');
  if (!modal) return { open() {}, close() {}, isBusy: () => false };
  const form = modal.querySelector('#checksForm');
  const actionInput = modal.querySelector('#checksActionInput');
  const skillCard = modal.querySelector('#skillCheckCard');
  const skillEnabled = modal.querySelector('#skillCheckEnabled');
  const skillSelect = modal.querySelector('#skillCheckSkill');
  const dcInput = modal.querySelector('#skillCheckDc');
  const dcPresets = modal.querySelector('#skillCheckDcPresets');
  const advantageInput = modal.querySelector('#skillCheckAdvantage');
  const disadvantageInput = modal.querySelector('#skillCheckDisadvantage');
  const formula = modal.querySelector('#skillCheckFormula');
  const fateCard = modal.querySelector('#fateCheckCard');
  const fateEnabled = modal.querySelector('#fateCheckEnabled');
  const fateQuestion = modal.querySelector('#fateQuestionInput');
  const oddsSelect = modal.querySelector('#fateOddsSelect');
  const chaosSelect = modal.querySelector('#fateChaosSelect');
  const orderField = modal.querySelector('#checkOrderField');
  const rollButton = modal.querySelector('#checksRollButton');
  const diceOverlay = document.querySelector('#fateDiceOverlay');

  STORY_SKILLS.forEach((skill) => skillSelect.add(new Option(`${skill.name} (${skill.ability})`, skill.key, skill.key === DEFAULT_SKILL, skill.key === DEFAULT_SKILL)));
  FATE_ODDS_OPTIONS.forEach(({ value, label }) => oddsSelect.add(new Option(label, value, value === FATE_ODDS_DEFAULT, value === FATE_ODDS_DEFAULT)));
  FATE_CHAOS_OPTIONS.forEach(({ value, label }) => chaosSelect.add(new Option(label, value, value === FATE_CHAOS_FROM_SCENE, value === FATE_CHAOS_FROM_SCENE)));
  dcInput.min = String(SKILL_CHECK.DC_MIN);
  dcInput.max = String(SKILL_CHECK.DC_MAX);
  dcInput.value = String(SKILL_CHECK.DC_DEFAULT);
  fateQuestion.maxLength = FATE_CHECK_QUESTION_MAX_LENGTH;
  SKILL_DC_PRESETS.forEach(({ dc, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dc-preset';
    button.dataset.dc = String(dc);
    button.textContent = String(dc);
    button.title = label;
    button.setAttribute('aria-label', `${label} (DC ${dc})`);
    button.addEventListener('click', () => {
      dcInput.value = String(dc);
      sync();
    });
    dcPresets.append(button);
  });

  let busy = false;
  let fateDice = null;
  let diceHideTimer = null;

  const rollMode = () => (advantageInput.checked ? SKILL_ROLL_MODE.ADVANTAGE : disadvantageInput.checked ? SKILL_ROLL_MODE.DISADVANTAGE : SKILL_ROLL_MODE.NORMAL);
  const selectedOrder = () => form.querySelector('input[name="checkOrder"]:checked')?.value || CHECK_ORDER.SKILL_FIRST;

  const updateFormula = () => {
    const ability = findSkill(skillSelect.value).ability;
    const mode = rollMode();
    const roll = mode === SKILL_ROLL_MODE.ADVANTAGE
      ? `best of 2d20 + ${ability} bonus + proficiency`
      : mode === SKILL_ROLL_MODE.DISADVANTAGE
        ? `d20 + proficiency (no ${ability} bonus)`
        : `d20 + ${ability} bonus + proficiency`;
    formula.textContent = `Roll: ${roll}. Natural 20 always succeeds, natural 1 always fails.`;
  };

  const sync = () => {
    skillCard.disabled = busy || !skillEnabled.checked;
    fateCard.disabled = busy || !fateEnabled.checked;
    skillEnabled.disabled = busy;
    fateEnabled.disabled = busy;
    skillCard.classList.toggle('is-off', !skillEnabled.checked);
    fateCard.classList.toggle('is-off', !fateEnabled.checked);
    orderField.disabled = busy || !(skillEnabled.checked && fateEnabled.checked);
    orderField.classList.toggle('is-off', orderField.disabled);
    const dc = Number(dcInput.value);
    dcPresets.querySelectorAll('.dc-preset').forEach((button) => button.classList.toggle('is-active', Number(button.dataset.dc) === dc));
    actionInput.disabled = busy;
    rollButton.disabled = busy || !(skillEnabled.checked || fateEnabled.checked);
    updateFormula();
  };

  const hideDice = () => {
    clearTimeout(diceHideTimer);
    fateDice?.hide();
  };

  const open = () => {
    if (busy) return;
    if (!canUseChecks()) return;
    actionInput.value = getComposerText() || actionInput.value;
    sync();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    (skillEnabled.checked || fateEnabled.checked ? actionInput : skillEnabled).focus();
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  const validate = () => {
    const useSkill = skillEnabled.checked;
    const useFate = fateEnabled.checked;
    if (!useSkill && !useFate) return 'Turn on at least one check.';
    const question = fateQuestion.value.trim();
    if (useFate && !question) return 'Write a yes/no question for the fate check.';
    if (useFate && question.length > FATE_CHECK_QUESTION_MAX_LENGTH) return `Fate check questions must be ${FATE_CHECK_QUESTION_MAX_LENGTH} characters or fewer.`;
    const dc = Number(dcInput.value);
    if (useSkill && (!Number.isInteger(dc) || dc < SKILL_CHECK.DC_MIN || dc > SKILL_CHECK.DC_MAX)) return `DC must be a whole number from ${SKILL_CHECK.DC_MIN} to ${SKILL_CHECK.DC_MAX}.`;
    if (useSkill && !actionInput.value.trim()) return 'Describe what your character does for the skill check.';
    return '';
  };

  const rollFate = async (characterId, question) => {
    if (!fateDice) fateDice = createFateDice(diceOverlay);
    fateDice?.start(question);
    try {
      const response = await requestFateCheck(characterId, question, oddsSelect.value || FATE_ODDS_DEFAULT, chaosSelect.value ? Number(chaosSelect.value) : null);
      await fateDice?.settle(response.fateCheck);
      return response.fateCheck;
    } catch (error) {
      fateDice?.fail(error.message || 'Unable to roll the fate check.');
      diceHideTimer = setTimeout(hideDice, FATE_DICE_HIDE_DELAY_MS);
      throw error;
    }
  };

  const rollSkill = async (characterId) => {
    const response = await requestSkillCheck(characterId, skillSelect.value, Number(dcInput.value), rollMode());
    notify(describeSkillCheck(response.skillCheck));
    return response.skillCheck;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const problem = validate();
    if (problem) {
      notify(problem);
      return;
    }
    if (!canUseChecks()) return;
    const characterId = getCharacterId();
    if (!characterId) return;
    const useSkill = skillEnabled.checked;
    const useFate = fateEnabled.checked;
    const order = selectedOrder();
    const question = fateQuestion.value.trim();
    const actionText = actionInput.value.trim() || question;
    const steps = useSkill && useFate
      ? (order === CHECK_ORDER.FATE_FIRST ? ['fate', 'skill'] : ['skill', 'fate'])
      : [useSkill ? 'skill' : 'fate'];
    busy = true;
    sync();
    close();
    clearTimeout(diceHideTimer);
    let fateCheck = null;
    let skillCheck = null;
    try {
      for (const step of steps) {
        if (step === 'skill') skillCheck = await rollSkill(characterId);
        else fateCheck = await rollFate(characterId, question);
      }
    } catch (error) {
      notify(error.message || 'Unable to roll the check.');
      busy = false;
      sync();
      return;
    }
    actionInput.value = '';
    fateQuestion.value = '';
    busy = false;
    sync();
    try {
      await onReady?.(actionText, { fateCheck, skillCheck, checkOrder: useSkill && useFate ? order : null });
    } finally {
      if (fateCheck) diceHideTimer = setTimeout(hideDice, FATE_DICE_HIDE_DELAY_MS);
    }
  });

  [skillEnabled, fateEnabled, advantageInput, disadvantageInput, skillSelect, dcInput].forEach((control) => control.addEventListener('input', sync));
  advantageInput.addEventListener('change', () => {
    if (advantageInput.checked) disadvantageInput.checked = false;
    sync();
  });
  disadvantageInput.addEventListener('change', () => {
    if (disadvantageInput.checked) advantageInput.checked = false;
    sync();
  });
  [skillEnabled, fateEnabled, skillSelect].forEach((control) => control.addEventListener('change', sync));
  modal.querySelectorAll('[data-close-checks]').forEach((button) => button.addEventListener('click', close));
  diceOverlay?.querySelector('[data-close-fate-dice]')?.addEventListener('click', hideDice);
  sync();

  return { open, close, isOpen: () => modal.classList.contains('is-open'), isBusy: () => busy };
}
