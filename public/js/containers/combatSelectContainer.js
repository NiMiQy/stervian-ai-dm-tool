import { getAreaCombatTargets } from '../logics/authApi.js';
import { MAX_ENCOUNTER_ENEMIES } from '../constants.js';

const describeTarget = (target) => [target.race, target.job].filter(Boolean).join(' · ');

export function initCombatSelectContainer({ canStartCombat = () => true, notify = () => {}, onStart }) {
  const modal = document.querySelector('#combatSelectModal');
  if (!modal) return { open() {}, close() {}, isOpen: () => false };
  const form = modal.querySelector('#combatSelectForm');
  const note = modal.querySelector('#combatSelectNote');
  const list = modal.querySelector('#combatSelectList');
  const startButton = modal.querySelector('#combatSelectStartButton');

  let monsterControls = [];
  let npcControls = [];
  let busy = false;

  const monsterTotal = () => monsterControls.reduce((sum, { input }) => sum + (Number(input.value) || 0), 0);
  const chosenNpc = () => npcControls.find(({ checkbox }) => checkbox.checked) || null;

  const sync = () => {
    const npc = chosenNpc();
    const total = monsterTotal();
    monsterControls.forEach(({ input, card }) => {
      const own = Number(input.value) || 0;
      input.disabled = Boolean(npc);
      input.max = String(Math.max(own, MAX_ENCOUNTER_ENEMIES - (total - own)));
      card.classList.toggle('is-off', own === 0);
    });
    npcControls.forEach(({ checkbox, card }) => {
      checkbox.disabled = total > 0 || Boolean(npc && !checkbox.checked);
      card.classList.toggle('is-off', !checkbox.checked);
    });
    if (!monsterControls.length && !npcControls.length) note.textContent = 'Nothing here to fight.';
    else if (npc) note.textContent = `You will fight ${npc.target.name} alone.`;
    else note.textContent = `Monsters selected: ${total} / ${MAX_ENCOUNTER_ENEMIES}. An NPC can only be fought alone.`;
    startButton.disabled = busy || (!npc && total === 0);
  };

  const buildCard = (target) => {
    const card = document.createElement('fieldset');
    card.className = 'check-card is-off';
    const legend = document.createElement('legend');
    const fields = document.createElement('div');
    fields.className = 'check-fields';
    const details = describeTarget(target);
    if (details) {
      const description = document.createElement('p');
      description.className = 'check-formula';
      description.textContent = details;
      fields.append(description);
    }
    card.append(legend, fields);
    return { card, legend, fields };
  };

  const render = ({ monsters = [], npcs = [] } = {}) => {
    list.replaceChildren();
    monsterControls = monsters.map((target) => {
      const { card, legend, fields } = buildCard(target);
      legend.textContent = `${target.name} · Lv ${target.level}`;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(MAX_ENCOUNTER_ENEMIES);
      input.step = '1';
      input.value = '0';
      input.id = `combatSelectCount${target.id}`;
      label.htmlFor = input.id;
      label.textContent = 'How many';
      fields.append(label, input);
      input.addEventListener('input', () => {
        const own = Math.max(0, Math.floor(Number(input.value) || 0));
        const others = monsterTotal() - (Number(input.value) || 0);
        input.value = String(Math.min(own, Math.max(0, MAX_ENCOUNTER_ENEMIES - others)));
        sync();
      });
      list.append(card);
      return { target, input, card };
    });
    npcControls = npcs.map((target) => {
      const { card, legend } = buildCard(target);
      const switchLabel = document.createElement('label');
      switchLabel.className = 'check-switch';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(target.id);
      const tag = document.createElement('span');
      tag.className = 'muted';
      tag.textContent = 'NPC';
      switchLabel.append(checkbox, ` ${target.name} · Lv ${target.level} `, tag);
      legend.append(switchLabel);
      checkbox.addEventListener('change', sync);
      list.append(card);
      return { target, checkbox, card };
    });
    sync();
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  const open = async () => {
    if (!canStartCombat()) return;
    render();
    note.textContent = 'Looking around for foes…';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    try {
      render(await getAreaCombatTargets());
    } catch (error) {
      notify(error.message || 'Unable to load the targets here.');
      close();
    }
  };

  const collect = () => {
    const npc = chosenNpc();
    if (npc) return [{ id: npc.target.id, count: 1 }];
    return monsterControls
      .map(({ target, input }) => ({ id: target.id, count: Number(input.value) || 0 }))
      .filter((entry) => entry.count > 0);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const targets = collect();
    if (!targets.length) {
      notify('Choose at least one target to fight.');
      return;
    }
    if (!canStartCombat()) return;
    busy = true;
    sync();
    try {
      const started = await onStart?.(targets);
      if (started) close();
    } finally {
      busy = false;
      sync();
    }
  });

  modal.querySelectorAll('[data-close-combat-select]').forEach((button) => button.addEventListener('click', close));

  return { open, close, isOpen: () => modal.classList.contains('is-open') };
}
