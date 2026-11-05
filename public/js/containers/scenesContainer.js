import { createCharacterScene, deleteCharacterScene, getCharacterScenes, solveCharacterScene, updateCharacterScene } from '../logics/authApi.js';
import { MAX_ONGOING_SCENES, SCENE_AFFINITY_REWARD, SCENE_FIELD_MAX_LENGTHS } from '../constants.js';

const TABS = { ONGOING: 'ongoing', SOLVED: 'solved' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatAffinity(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export function initScenesContainer({ getCharacterId, getNpcs = () => [], notify = () => {} }) {
  const modal = document.querySelector('#scenesModal');
  if (!modal) return { open() {}, close() {}, refresh() {} };
  const list = modal.querySelector('#sceneList');
  const counter = modal.querySelector('#scenesCounter');
  const form = modal.querySelector('#sceneForm');
  const formTitle = modal.querySelector('#sceneFormTitle');
  const goalInput = modal.querySelector('#sceneGoalInput');
  const notesInput = modal.querySelector('#sceneNotesInput');
  const npcSelect = modal.querySelector('#sceneNpcSelect');
  const affinityInput = modal.querySelector('#sceneAffinityInput');
  const deleteButton = modal.querySelector('#sceneDeleteButton');
  const solveButton = modal.querySelector('#sceneSolveButton');
  const newButton = modal.querySelector('#newSceneButton');
  const tabButtons = modal.querySelectorAll('[data-scene-tab]');
  goalInput.maxLength = SCENE_FIELD_MAX_LENGTHS.scene_goal;
  notesInput.maxLength = SCENE_FIELD_MAX_LENGTHS.scene_notes;
  if (affinityInput) {
    affinityInput.min = String(SCENE_AFFINITY_REWARD.MIN);
    affinityInput.max = String(SCENE_AFFINITY_REWARD.MAX);
  }

  let activeTab = TABS.ONGOING;
  let state = { ongoing: [], solved: [] };
  let editingScene = null;
  let busy = false;

  const syncAffinityInput = () => {
    if (!affinityInput) return;
    const hasNpc = Boolean(npcSelect.value);
    if (!hasNpc) affinityInput.value = '0';
    affinityInput.disabled = busy || !hasNpc;
    affinityInput.title = hasNpc ? '' : 'Choose a canon NPC to set an affinity change.';
  };

  const setBusy = (value) => {
    busy = value;
    form.querySelectorAll('button, input, textarea, select').forEach((control) => { control.disabled = value; });
    newButton.disabled = value || state.ongoing.length >= MAX_ONGOING_SCENES;
    syncAffinityInput();
  };

  const fillNpcOptions = (selectedId = null, selectedName = null) => {
    npcSelect.replaceChildren(new Option('No canon NPC', ''));
    const seen = new Set();
    getNpcs().forEach((npc) => {
      const id = Number(npc.character_id || npc.character?.id || npc.id);
      const name = npc.name || npc.character?.name;
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      npcSelect.append(new Option(name, String(id)));
    });
    if (selectedId && !seen.has(Number(selectedId))) npcSelect.append(new Option(selectedName || `NPC #${selectedId}`, String(selectedId)));
    npcSelect.value = selectedId ? String(selectedId) : '';
  };

  const showForm = (scene = null) => {
    editingScene = scene;
    formTitle.textContent = scene ? 'Edit scene' : 'New scene';
    goalInput.value = scene?.scene_goal || '';
    notesInput.value = scene?.scene_notes || '';
    fillNpcOptions(scene?.npc_character_id || null, scene?.npc_name || null);
    if (affinityInput) affinityInput.value = String(scene?.affinity_reward || 0);
    syncAffinityInput();
    deleteButton.hidden = !scene;
    if (solveButton) solveButton.hidden = !scene;
    form.hidden = false;
    list.hidden = true;
    newButton.hidden = true;
    goalInput.focus();
  };

  const hideForm = () => {
    editingScene = null;
    form.hidden = true;
    list.hidden = false;
    newButton.hidden = activeTab !== TABS.ONGOING;
  };

  const renderList = () => {
    counter.textContent = `${state.ongoing.length}/${MAX_ONGOING_SCENES} on-going`;
    newButton.disabled = busy || state.ongoing.length >= MAX_ONGOING_SCENES;
    newButton.title = state.ongoing.length >= MAX_ONGOING_SCENES ? `You already have ${MAX_ONGOING_SCENES} on-going scenes.` : '';
    tabButtons.forEach((button) => {
      const selected = button.dataset.sceneTab === activeTab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    list.replaceChildren();
    const scenes = activeTab === TABS.ONGOING ? state.ongoing : state.solved;
    if (!scenes.length) {
      list.append(element('li', 'scene-empty', activeTab === TABS.ONGOING ? 'No on-going scenes. Create one to track a goal.' : 'No solved scenes yet.'));
      return;
    }
    scenes.forEach((scene) => {
      const item = element('li', `scene-card is-${scene.scene_stage}`);
      const body = element(activeTab === TABS.ONGOING ? 'button' : 'div', 'scene-card-body');
      if (activeTab === TABS.ONGOING) {
        body.type = 'button';
        body.setAttribute('aria-label', `Edit scene: ${scene.scene_goal}`);
        body.addEventListener('click', () => showForm(scene));
      }
      body.append(element('p', 'scene-card-goal', scene.scene_goal));
      if (scene.scene_notes) body.append(element('p', 'scene-card-notes', scene.scene_notes));
      const meta = element('p', 'scene-card-meta');
      if (scene.npc_name) meta.append(element('span', 'scene-tag scene-tag-npc', scene.npc_name));
      if (scene.npc_name && scene.affinity_reward) {
        meta.append(element('span', `scene-tag scene-tag-affinity ${scene.affinity_reward > 0 ? 'is-positive' : 'is-negative'}`, `${formatAffinity(scene.affinity_reward)} affinity`));
      }
      if (activeTab === TABS.ONGOING) meta.append(element('span', 'scene-tag', `Chaos ${scene.chaos_factor}`));
      else meta.append(element('span', 'scene-tag scene-tag-solved', `Solved ${formatDate(scene.updated_at)}`));
      body.append(meta);
      item.append(body);
      list.append(item);
    });
  };

  const refresh = async () => {
    const characterId = getCharacterId();
    if (!characterId) return;
    try {
      const result = await getCharacterScenes(characterId);
      state = { ongoing: result.ongoing || [], solved: result.solved || [] };
      renderList();
    } catch (error) {
      notify(error.message || 'Unable to load scenes.');
    }
  };

  const open = async () => {
    hideForm();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    renderList();
    await refresh();
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    hideForm();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const characterId = getCharacterId();
    const payload = {
      scene_goal: goalInput.value.trim(),
      scene_notes: notesInput.value.trim(),
      npc_character_id: npcSelect.value ? Number(npcSelect.value) : null,
      affinity_reward: npcSelect.value && affinityInput?.value ? Number(affinityInput.value) : 0
    };
    if (!payload.scene_goal) {
      notify('Give the scene a goal.');
      goalInput.focus();
      return;
    }
    if (!Number.isInteger(payload.affinity_reward) || payload.affinity_reward < SCENE_AFFINITY_REWARD.MIN || payload.affinity_reward > SCENE_AFFINITY_REWARD.MAX) {
      notify(`Affinity must be a whole number from ${SCENE_AFFINITY_REWARD.MIN} to ${SCENE_AFFINITY_REWARD.MAX}.`);
      affinityInput?.focus();
      return;
    }
    setBusy(true);
    try {
      if (editingScene) {
        await updateCharacterScene(characterId, editingScene.id, payload);
        notify('Scene updated.');
      } else {
        await createCharacterScene(characterId, payload);
        notify('Scene created.');
      }
      hideForm();
      await refresh();
    } catch (error) {
      notify(error.message || 'Unable to save the scene.');
    } finally {
      setBusy(false);
    }
  });

  deleteButton.addEventListener('click', async () => {
    if (!editingScene || busy) return;
    if (!window.confirm('Delete this scene? It will be marked as abandoned.')) return;
    setBusy(true);
    try {
      await deleteCharacterScene(getCharacterId(), editingScene.id);
      notify('Scene abandoned.');
      hideForm();
      await refresh();
    } catch (error) {
      notify(error.message || 'Unable to delete the scene.');
    } finally {
      setBusy(false);
    }
  });

  solveButton?.addEventListener('click', async () => {
    if (!editingScene || busy) return;
    const pending = editingScene.npc_name && editingScene.affinity_reward
      ? ` ${editingScene.npc_name} will get ${formatAffinity(editingScene.affinity_reward)} affinity.`
      : '';
    if (!window.confirm(`Mark this scene as solved?${pending}`)) return;
    setBusy(true);
    try {
      const result = await solveCharacterScene(getCharacterId(), editingScene.id);
      const change = result?.scene?.affinity_change;
      notify(change
        ? `Scene solved. ${change.npc_name}: ${formatAffinity(change.delta)} affinity (now ${change.affinity}, ${String(change.status).toLowerCase()}).`
        : 'Scene solved.');
      hideForm();
      await refresh();
    } catch (error) {
      notify(error.message || 'Unable to solve the scene.');
    } finally {
      setBusy(false);
    }
  });

  npcSelect.addEventListener('change', syncAffinityInput);
  modal.querySelector('#sceneCancelButton')?.addEventListener('click', hideForm);
  newButton.addEventListener('click', () => showForm(null));
  tabButtons.forEach((button) => button.addEventListener('click', () => {
    activeTab = button.dataset.sceneTab;
    hideForm();
    renderList();
  }));
  modal.querySelectorAll('[data-close-scenes]').forEach((button) => button.addEventListener('click', close));

  return { open, close, refresh, isOpen: () => modal.classList.contains('is-open') };
}
