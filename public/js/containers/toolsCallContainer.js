import { getMetNpcs } from '../logics/authApi.js';
import { PLAYER_TOOL, PLAYER_TOOL_NPC_NAME_MAX_LENGTH, PLAYER_TOOL_OPTIONS } from '../constants.js';

const OTHER_NPC_VALUE = '__other__';

export function describePlayerTools(playerTools = []) {
  if (!Array.isArray(playerTools) || !playerTools.length) return '';
  return `🧰 ${playerTools.map((entry) => {
    const option = PLAYER_TOOL_OPTIONS.find((item) => item.tool === entry.tool);
    return entry.npcName ? `${option?.label || entry.tool}: ${entry.npcName}` : (option?.label || entry.tool);
  }).join(' · ')}`;
}

export function initToolsCallContainer({ getTargetNpc = () => null, getComposerText = () => '', canUseTools = () => true, notify = () => {}, onReady }) {
  const modal = document.querySelector('#toolsCallModal');
  if (!modal) return { open() {}, close() {}, isOpen: () => false };
  const form = modal.querySelector('#toolsCallForm');
  const actionInput = modal.querySelector('#toolsCallActionInput');
  const targetNote = modal.querySelector('#toolsCallTargetNote');
  const list = modal.querySelector('#toolsCallList');
  const sendButton = modal.querySelector('#toolsCallSendButton');

  const controls = new Map();
  let npcSelect = null;
  let npcOtherInput = null;

  PLAYER_TOOL_OPTIONS.forEach((option) => {
    const card = document.createElement('fieldset');
    card.className = 'check-card';
    const legend = document.createElement('legend');
    const switchLabel = document.createElement('label');
    switchLabel.className = 'check-switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = option.tool;
    const code = document.createElement('span');
    code.className = 'muted';
    code.textContent = option.tool;
    switchLabel.append(checkbox, ` ${option.label} `, code);
    legend.append(switchLabel);
    const fields = document.createElement('div');
    fields.className = 'check-fields';
    const description = document.createElement('p');
    description.className = 'check-formula';
    description.textContent = option.description;
    fields.append(description);

    if (option.tool === PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC) {
      const selectLabel = document.createElement('label');
      selectLabel.textContent = 'NPC to ask about';
      npcSelect = document.createElement('select');
      npcSelect.id = 'toolsCallNpcSelect';
      selectLabel.htmlFor = npcSelect.id;
      npcOtherInput = document.createElement('input');
      npcOtherInput.type = 'text';
      npcOtherInput.maxLength = PLAYER_TOOL_NPC_NAME_MAX_LENGTH;
      npcOtherInput.placeholder = 'Type a name you heard in the story';
      npcOtherInput.hidden = true;
      fields.append(selectLabel, npcSelect, npcOtherInput);
      npcSelect.addEventListener('change', () => {
        npcOtherInput.hidden = npcSelect.value !== OTHER_NPC_VALUE;
        if (!npcOtherInput.hidden) npcOtherInput.focus();
      });
    }

    card.append(legend, fields);
    list.append(card);
    controls.set(option.tool, { option, card, checkbox });
    checkbox.addEventListener('change', () => sync());
  });

  const sync = () => {
    const target = getTargetNpc();
    targetNote.textContent = target
      ? `Target NPC: ${target.name}`
      : 'No target NPC selected. Select who you are talking to for the NPC tools.';
    controls.forEach(({ option, card, checkbox }) => {
      const blocked = option.needsTarget && !target;
      if (blocked) checkbox.checked = false;
      checkbox.disabled = blocked;
      card.title = blocked ? 'Select a target NPC first.' : '';
      card.classList.toggle('is-off', !checkbox.checked);
      card.querySelector('.check-fields').toggleAttribute('hidden', !checkbox.checked);
    });
    sendButton.disabled = ![...controls.values()].some(({ checkbox }) => checkbox.checked);
  };

  const loadMetNpcs = async () => {
    const target = getTargetNpc();
    npcSelect.replaceChildren(new Option('Choose an NPC you have met', ''));
    try {
      const response = await getMetNpcs();
      (response?.npcs || [])
        .filter((npc) => npc.id !== target?.id)
        .forEach((npc) => npcSelect.add(new Option(npc.name, npc.name)));
    } catch (error) {
      notify(error.message || 'Unable to load the NPCs you have met.');
    }
    npcSelect.add(new Option('Someone else (type a name)', OTHER_NPC_VALUE));
    npcOtherInput.hidden = true;
    npcOtherInput.value = '';
  };

  const selectedNpcName = () => (npcSelect.value === OTHER_NPC_VALUE ? npcOtherInput.value : npcSelect.value).replace(/\s+/g, ' ').trim();

  const open = async () => {
    if (!canUseTools()) return;
    actionInput.value = getComposerText() || actionInput.value;
    sync();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    actionInput.focus();
    await loadMetNpcs();
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  const collect = () => {
    const target = getTargetNpc();
    const tools = [];
    for (const { option, checkbox } of controls.values()) {
      if (!checkbox.checked) continue;
      if (option.needsTarget && !target) return { error: `${option.label} needs a target NPC.` };
      if (option.tool === PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC) {
        const npcName = selectedNpcName();
        if (!npcName) return { error: 'Choose or type the NPC to ask about.' };
        tools.push({ tool: option.tool, npcName });
      } else {
        tools.push({ tool: option.tool });
      }
    }
    if (!tools.length) return { error: 'Turn on at least one tool.' };
    if (!actionInput.value.trim()) return { error: 'Describe what your character does or says with the tool call.' };
    return { tools };
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { tools, error } = collect();
    if (error) {
      notify(error);
      return;
    }
    if (!canUseTools()) return;
    const actionText = actionInput.value.trim();
    close();
    actionInput.value = '';
    controls.forEach(({ checkbox }) => { checkbox.checked = false; });
    sync();
    notify(describePlayerTools(tools));
    await onReady?.(actionText, { playerTools: tools });
  });

  modal.querySelectorAll('[data-close-tools-call]').forEach((button) => button.addEventListener('click', close));
  sync();

  return { open, close, isOpen: () => modal.classList.contains('is-open') };
}
