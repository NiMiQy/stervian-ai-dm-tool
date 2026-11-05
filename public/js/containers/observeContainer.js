import { OBSERVE_MODE } from '../constants.js';

export function observeBlockReason({ npcs = [], partyTurn = false, nonLeader = false, busy = false } = {}) {
  if (busy) return 'Wait for the current turn to finish.';
  if (nonLeader) return 'Only the party leader can observe for the party.';
  if (partyTurn) return 'Observe uses your own turn. Leave party turn mode first.';
  if (npcs.filter((npc) => npc.is_speakable).length < 2) return 'Observe needs at least two NPCs here who talk.';
  return '';
}

export function initObserveContainer({ getNpcs = () => [], getBlockReason = () => '', notify = () => {}, onReady }) {
  const modal = document.querySelector('#observeModal');
  const button = document.querySelector('#observeButton');
  if (!modal) return { open() {}, close() {}, refresh() {}, isOpen: () => false };
  const form = modal.querySelector('#observeForm');
  const selectA = modal.querySelector('#observeNpcASelect');
  const selectB = modal.querySelector('#observeNpcBSelect');
  const repeatInput = modal.querySelector('#observeRepeatInput');
  const directionInput = modal.querySelector('#observeDirectionInput');
  const preview = modal.querySelector('#observeOrderPreview');
  const note = modal.querySelector('#observeNote');
  const watchButton = modal.querySelector('#observeWatchButton');

  repeatInput.min = String(OBSERVE_MODE.MIN_REPEAT);
  repeatInput.max = String(OBSERVE_MODE.MAX_REPEAT);
  directionInput.maxLength = OBSERVE_MODE.DIRECTION_MAX_LENGTH;

  const speakableNpcs = () => (getNpcs() || []).filter((npc) => npc.is_speakable);
  const npcById = (id) => speakableNpcs().find((npc) => String(npc.id) === String(id)) || null;

  const repeatValue = () => {
    const value = Number(repeatInput.value);
    return Number.isInteger(value) && value >= OBSERVE_MODE.MIN_REPEAT && value <= OBSERVE_MODE.MAX_REPEAT ? value : null;
  };

  const fillSelect = (select, npcs, keepValue) => {
    select.replaceChildren(new Option('Choose an NPC', ''));
    npcs.forEach((npc) => select.add(new Option(npc.name, String(npc.id))));
    select.value = npcs.some((npc) => String(npc.id) === keepValue) ? keepValue : '';
  };

  const sync = () => {
    const npcs = speakableNpcs();
    const keepA = selectA.value;
    fillSelect(selectA, npcs, keepA);
    if (!selectA.value && npcs[0]) selectA.value = String(npcs[0].id);
    const keepB = selectB.value;
    const others = npcs.filter((npc) => String(npc.id) !== selectA.value);
    fillSelect(selectB, others, keepB);
    if (!selectB.value && others[0]) selectB.value = String(others[0].id);

    const npcA = npcById(selectA.value);
    const npcB = npcById(selectB.value);
    const repeat = repeatValue();
    if (npcA && npcB && repeat) {
      const order = [];
      for (let round = 0; round < repeat; round += 1) order.push(npcA.name, npcB.name);
      preview.textContent = `Order: ${order.join(' → ')} (${order.length} lines)`;
    } else {
      preview.textContent = repeat ? 'Pick two NPCs to see the order.' : `Repeat count must be ${OBSERVE_MODE.MIN_REPEAT} to ${OBSERVE_MODE.MAX_REPEAT}.`;
    }
    note.textContent = `${directionInput.value.length}/${OBSERVE_MODE.DIRECTION_MAX_LENGTH} characters`;
    watchButton.disabled = !(npcA && npcB && repeat);
  };

  const refresh = () => {
    if (!button) return;
    const reason = getBlockReason();
    button.disabled = Boolean(reason);
    button.title = reason || 'Watch two NPCs here talk to each other';
    if (modal.classList.contains('is-open')) sync();
  };

  const open = () => {
    const reason = getBlockReason();
    if (reason) {
      notify(reason);
      refresh();
      return;
    }
    sync();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    selectA.focus();
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  selectA.addEventListener('change', sync);
  selectB.addEventListener('change', sync);
  repeatInput.addEventListener('input', sync);
  directionInput.addEventListener('input', sync);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const reason = getBlockReason();
    if (reason) {
      notify(reason);
      return;
    }
    const npcA = npcById(selectA.value);
    const npcB = npcById(selectB.value);
    const repeat = repeatValue();
    const direction = directionInput.value.replace(/\s+/g, ' ').trim();
    if (!npcA || !npcB) return notify('Pick two NPCs to observe.');
    if (npcA.id === npcB.id) return notify('Pick two different NPCs.');
    if (!repeat) return notify(`Repeat count must be ${OBSERVE_MODE.MIN_REPEAT} to ${OBSERVE_MODE.MAX_REPEAT}.`);
    if (direction.length > OBSERVE_MODE.DIRECTION_MAX_LENGTH) return notify('Direction is too long.');
    close();
    directionInput.value = '';
    await onReady?.({ npcA, npcB, repeatCount: repeat, direction });
  });

  modal.querySelectorAll('[data-close-observe]').forEach((element) => element.addEventListener('click', close));
  button?.addEventListener('click', open);
  refresh();

  return { open, close, refresh, isOpen: () => modal.classList.contains('is-open') };
}
