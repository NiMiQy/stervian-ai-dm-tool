import { getCraftingData, craftRecipe, upgradeItemLevel, logout } from './logics/authApi.js';
import { initializeSettingsMenu } from './components/settingsMenu.js';
import { createToast } from './components/toast.js';
import {
  ACCESSORY_ITEM_TYPES,
  CRAFTING_ANIMATION_DURATION_MS,
  PAGES,
  TRADING_SUBLOCATION_TYPES,
  WEAPON_ITEM_TYPES,
} from './constants.js';

const settingsIconPath = 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5 1.2 2.1 2.4.5 2-1.2 2.1 2.1-1.2 2 .5 2.5L21 12l-2.1 1.2-.5 2.4 1.2 2-2.1 2.1-2-1.2-2.5.5L12 23l-1.2-2.1-2.4-.5-2 1.2-2.1-2.1 1.2-2-.5-2.5L3 12l2.1-1.2.5-2.4-1.2-2 2.1-2.1 2 1.2 2.5-.5L12 3Z';

const state = { data: null, tab: 'craft' };
state.category = null;
state.upgradeCategory = null;
state.upgradeBusy = false;
state.batch = {};
state.continuous = null;
state.filters = { search: '', level: '', available: false };
state.page = 1;
const RECIPES_PER_PAGE = 10;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const inventoryQuantity = (itemId) => [...(state.data?.inventory || []), ...(state.data?.vault || [])].filter((entry) => entry.item_id === itemId).reduce((total, entry) => total + Number(entry.quantity || 0), 0);
// Recipe tabs and the life skill each one requires
const RECIPE_TABS = { craft: 'Crafting', cooking: 'Cooking', alchemy: 'Alchemy', processing: 'Processing' };
const isRecipeTab = () => Object.hasOwn(RECIPE_TABS, state.tab);
const tabSkill = () => RECIPE_TABS[state.tab] || 'Crafting';
const craftingSkillRecipes = () => (state.data?.recipes || []).filter((recipe) => recipe.lifeskill?.name?.trim().toLowerCase() === tabSkill().toLowerCase());

function categoryForItem(item) {
  if (WEAPON_ITEM_TYPES.includes(item?.type)) return 'Weapons';
  if (ACCESSORY_ITEM_TYPES.includes(item?.type)) return 'Accessories';
  return 'Armor';
}

function renderSidebar() {
  const eyebrow = $('#craftingSidebarEyebrow');
  const note = $('#craftingSidebarNote');
  const title = $('#craftingCategoryTitle');
  const categories = new Map();
  if (isRecipeTab()) {
    const recipes = craftingSkillRecipes().filter((recipe) => recipe.unlocked);
    recipes.forEach((recipe) => { const key = recipe.lifeskill?.name || 'General'; categories.set(key, (categories.get(key) || 0) + 1); });
    eyebrow.textContent = 'RECIPE CATEGORIES'; title.textContent = 'Recipes'; note.textContent = `Only recipes that require the ${tabSkill()} life skill are shown.`;
    $('#craftingCategories').innerHTML = categories.size ? `<button class="crafting-tab ${!state.category ? 'is-active' : ''}" type="button" aria-pressed="${!state.category}" data-category="">All <span class="muted">(${recipes.length})</span></button>${[...categories].map(([name, count]) => `<button class="crafting-tab ${state.category === name ? 'is-active' : ''}" type="button" aria-pressed="${state.category === name}" data-category="${escapeHtml(name)}">${escapeHtml(name)} <span class="muted">(${count})</span></button>`).join('')}` : '<p class="crafting-empty">No recipes are available yet.</p>';
  } else if (state.tab === 'upgrade') {
    const items = state.data?.upgradeable || [];
    items.forEach((entry) => { const key = categoryForItem(entry.item); categories.set(key, (categories.get(key) || 0) + 1); });
    eyebrow.textContent = 'EQUIPMENT FILTERS'; title.textContent = 'Upgrade equipment'; note.textContent = 'Choose a slot group to focus the equipment you can upgrade.';
    $('#craftingCategories').innerHTML = categories.size ? `<button class="crafting-tab ${!state.upgradeCategory ? 'is-active' : ''}" type="button" aria-pressed="${!state.upgradeCategory}" data-upgrade-category="">All <span class="muted">(${items.length})</span></button>${[...categories].map(([name, count]) => `<button class="crafting-tab ${state.upgradeCategory === name ? 'is-active' : ''}" type="button" aria-pressed="${state.upgradeCategory === name}" data-upgrade-category="${name}">${name} <span class="muted">(${count})</span></button>`).join('')}` : '<p class="crafting-empty">No upgradeable equipment is in your storage.</p>';
  } else {
    eyebrow.textContent = 'AFFIX SYSTEM'; title.textContent = 'Affixes'; note.textContent = 'Prefix and suffix rolling is still in development.'; $('#craftingCategories').innerHTML = '<p class="crafting-empty">Coming soon.</p>';
  }
  const character = state.data?.character || {};
  const resources = $('#craftingResources');
  if (state.tab === 'affix') { resources.innerHTML = ''; return; }
  const energy = Math.max(0, Number(character.energy || 0));
  const maxEnergy = Math.max(1, Number(character.max_energy || 100));
  const energyPct = Math.min(100, Math.round((energy / maxEnergy) * 100));
  const recipe = isRecipeTab() ? craftingSkillRecipes().find((entry) => entry.unlocked && Number(entry.stamina_cost) > 0) : null;
  const perCraft = recipe ? Number(recipe.stamina_cost) : 0;
  const craftsLeft = perCraft ? Math.floor(energy / perCraft) : null;
  const energyNote = energy <= 0 ? 'Out of energy — rest before crafting.' : craftsLeft !== null ? `Enough for about ${craftsLeft} craft${craftsLeft === 1 ? '' : 's'} (${perCraft} energy each).` : '';
  resources.innerHTML = `<span style="display:flex;justify-content:space-between;gap:8px"><span>⚡ Energy</span><b>${energy} / ${maxEnergy}</b></span><span class="meter energy" style="display:block;margin:6px 0 4px" role="progressbar" aria-label="Energy" aria-valuemin="0" aria-valuemax="${maxEnergy}" aria-valuenow="${energy}"><i style="width:${energyPct}%"></i></span>${energyNote ? `<small style="display:block;${energy <= 0 ? 'color:var(--gs-ember)' : ''}">${energyNote}</small>` : ''}<span style="display:flex;justify-content:space-between;gap:8px;margin-top:12px"><span>◈ Gold</span><b>${Number(character.gold || 0).toLocaleString()}</b></span>`;
}

const recipeBatch = (recipe) => (recipe.can_mass_process ? Math.min(Number(recipe.mass_process_max || 50), Math.max(1, Number(state.batch[recipe.id] || 1))) : 1);

function recipeMatchesFilters(recipe) {
  const query = state.filters.search.trim().toLowerCase();
  if (query) {
    const haystack = [recipe.name, recipe.output_item?.name, ...(recipe.ingredients || []).map((ingredient) => ingredient.item?.name)].join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  const required = Number(recipe.required_level || 1);
  if (state.filters.level === 'mine' && required > Number(recipe.current_level || 1)) return false;
  if (state.filters.level && state.filters.level !== 'mine' && required !== Number(state.filters.level)) return false;
  if (state.filters.available && craftBlocker(recipe, recipeBatch(recipe))) return false;
  return true;
}

function setupRecipeFilters() {
  const bar = $('#craftingFilters');
  if (!bar) return;
  bar.innerHTML = `<label class="muted" style="display:grid;gap:4px;flex:1 1 220px;font-size:12px">Search recipe or item<input id="recipeFilterSearch" type="search" placeholder="Recipe, output or ingredient name…" autocomplete="off"></label><label class="muted" style="display:grid;gap:4px;font-size:12px">Life skill level<select id="recipeFilterLevel"><option value="">Any level</option></select></label><label class="muted" style="display:flex;gap:6px;align-items:center;font-size:12px;padding-bottom:8px"><input id="recipeFilterAvailable" type="checkbox"> Only available</label><button class="crafting-tab" type="button" id="recipeFilterClear" style="margin-bottom:2px">Clear</button>`;
  $('#recipeFilterSearch').addEventListener('input', (event) => { state.filters.search = event.target.value; state.page = 1; render(); });
  $('#recipeFilterLevel').addEventListener('change', (event) => { state.filters.level = event.target.value; state.page = 1; render(); });
  $('#recipeFilterAvailable').addEventListener('change', (event) => { state.filters.available = event.target.checked; state.page = 1; render(); });
  $('#recipeFilterClear').addEventListener('click', () => {
    state.filters = { search: '', level: '', available: false };
    state.page = 1;
    $('#recipeFilterSearch').value = '';
    $('#recipeFilterAvailable').checked = false;
    render();
  });
}

function renderRecipeFilters() {
  const bar = $('#craftingFilters');
  if (!bar) return;
  bar.style.display = isRecipeTab() ? 'flex' : 'none';
  if (!isRecipeTab()) return;
  const select = $('#recipeFilterLevel');
  if (!select) return;
  const recipes = craftingSkillRecipes().filter((recipe) => recipe.unlocked);
  const levels = [...new Set(recipes.map((recipe) => Number(recipe.required_level || 1)))].sort((a, b) => a - b);
  const myLevel = Number(recipes[0]?.current_level || 1);
  if (state.filters.level && state.filters.level !== 'mine' && !levels.includes(Number(state.filters.level))) state.filters.level = '';
  select.innerHTML = `<option value="">Any level</option><option value="mine">Up to my level (Lv. ${myLevel})</option>${levels.map((level) => `<option value="${level}">Requires Lv. ${level}</option>`).join('')}`;
  select.value = state.filters.level;
}

function renderCraft() {
  const unlocked = craftingSkillRecipes().filter((recipe) => recipe.unlocked && (!state.category || (recipe.lifeskill?.name || 'General') === state.category));
  const filtered = unlocked.filter(recipeMatchesFilters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / RECIPES_PER_PAGE));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const recipes = filtered.slice((state.page - 1) * RECIPES_PER_PAGE, state.page * RECIPES_PER_PAGE);
  const pagination = filtered.length ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px"><button class="crafting-tab" type="button" data-recipe-page="prev" ${state.page <= 1 ? 'disabled' : ''}>‹ Prev</button><span class="muted" style="font-size:12px">Page ${state.page} of ${totalPages} · ${filtered.length} recipe${filtered.length === 1 ? '' : 's'}</span><button class="crafting-tab" type="button" data-recipe-page="next" ${state.page >= totalPages ? 'disabled' : ''}>Next ›</button></div>` : '';
  $('#craftingCategoryTitle').textContent = 'Recipes';
  $('#craftingList').innerHTML = recipes.length ? recipes.map((recipe) => {
    const batch = recipe.can_mass_process ? Math.min(Number(recipe.mass_process_max || 50), Math.max(1, Number(state.batch[recipe.id] || 1))) : 1;
    const ingredients = recipe.ingredients.map((ingredient) => { const have = inventoryQuantity(ingredient.item_id); const need = ingredient.quantity * batch; return `<span class="crafting-material ${have < need ? 'is-missing' : ''}">${escapeHtml(ingredient.item?.name)} · Owned ${have} / Need ${need}</span>`; }).join('');
    const missing = recipe.ingredients.some((ingredient) => inventoryQuantity(ingredient.item_id) < ingredient.quantity * batch);
    const lowSkill = recipe.lifeskill && recipe.current_level < recipe.required_level;
    const energyNeed = recipe.stamina_cost * batch;
    const lowEnergy = Number(state.data.character.energy) < energyNeed;
    const reason = missing ? 'Gather the missing materials shown above.' : lowSkill ? `Requires ${escapeHtml(recipe.lifeskill.name)} level ${recipe.required_level}.` : lowEnergy ? `Requires ${energyNeed} energy.` : '';
    const canCraft = !state.upgradeBusy && !missing && !lowSkill && !lowEnergy;
    const running = state.continuous && String(state.continuous.recipeId) === String(recipe.id);
    const continuousControl = running ? `<button class="crafting-tab" type="button" data-stop-continuous ${state.continuous.stop ? 'disabled' : ''}>${state.continuous.stop ? 'Stopping after this cycle…' : `Stop continuous (${state.continuous.cycles} done)`}</button>` : recipe.lifeskill ? `<button class="crafting-tab" type="button" data-continuous="${recipe.id}" data-duration="${recipe.duration_seconds || 30}" data-quantity="${batch}" ${canCraft ? '' : 'disabled'} title="Keep crafting cycle after cycle until materials or energy run out, or you press Stop.">Continuous</button>` : '';
    const bdoPerks = recipe.lifeskill ? ` · ${recipe.bdo_rank || 'Beginner'} Lv. ${recipe.current_level} (Mastery: ${recipe.bdo_mastery || 10}) · ⚡ Free: ${recipe.free_energy_chance_pct || 0}% · ✦ Bonus Yield: ${recipe.bonus_yield_chance_pct || 0}%${Number(recipe.max_output_quantity) > Number(recipe.output_quantity) ? ` · ◆ Max Yield: ${recipe.max_yield_chance_pct || 0}%` : ''}` : '';
    const outputRange = Number(recipe.max_output_quantity) > Number(recipe.output_quantity) ? `${recipe.output_quantity}–${recipe.max_output_quantity}` : `${recipe.output_quantity}`;
    const massControl = recipe.lifeskill ? (recipe.can_mass_process ? `<p class="muted">Mass process: <input type="number" min="1" max="${recipe.mass_process_max || 50}" step="1" value="${batch}" data-batch="${recipe.id}" aria-label="Mass process quantity" style="width:72px"> × (max ${recipe.mass_process_max || 50})</p>` : `<p class="muted">Mass processing (up to ${recipe.mass_process_max || 50}) unlocks at Master rank, Lv. ${recipe.mass_process_unlock_level || 51}.</p>`) : '';
    return `<article class="crafting-card ${canCraft ? 'is-ready' : 'is-unavailable'}"><header><div><h3>${escapeHtml(recipe.name)}</h3><p>${escapeHtml(recipe.description || 'A practical recipe.')}</p></div><b class="crafting-output">Output: ×${outputRange} ${escapeHtml(recipe.output_item?.name)}</b></header><div class="crafting-requirements"><p class="muted">${escapeHtml(recipe.lifeskill?.name || 'General')} ${recipe.lifeskill ? `level ${recipe.required_level}` : 'recipe'} · ${recipe.stamina_cost} energy · ${Math.round(Number(recipe.effective_success_rate ?? recipe.success_rate ?? 1) * 100)}% success${bdoPerks}</p><div class="crafting-materials">${ingredients}</div></div>${massControl}${reason ? `<p class="crafting-reason">${reason}</p>` : `<p class="muted">Ready · takes ${recipe.duration_seconds || 30}s.</p>`}<button class="crafting-action" data-craft="${recipe.id}" data-duration="${recipe.duration_seconds || 30}" data-quantity="${batch}" ${canCraft ? '' : 'disabled'} aria-disabled="${!canCraft}">${canCraft || running ? (batch > 1 ? `Process ×${batch}` : 'Craft output') : 'Unavailable'}</button> ${continuousControl}</article>`;
  }).join('') + pagination : unlocked.length ? '<p class="crafting-empty">No recipes match your filters.</p>' : `<p class="crafting-empty">No ${tabSkill()} recipes are unlocked. Learn recipes through play.</p>`;
}

function renderUpgrade() {
  $('#craftingCategoryTitle').textContent = 'Upgrade equipment';
  const items = (state.data?.upgradeable || []).filter((entry) => !state.upgradeCategory || categoryForItem(entry.item) === state.upgradeCategory);
  $('#craftingList').innerHTML = items.length ? items.map((entry) => { const material = entry.material; const maxed = Number(entry.current_level_upgraded || 0) >= Number(entry.item?.max_upgrade_level || 0); const enoughMaterial = material && material.available >= material.required; const enoughGold = Number(state.data.character.gold) >= entry.gold_cost; const ready = !maxed && enoughMaterial && enoughGold; const reason = maxed ? 'This item has reached its maximum upgrade level.' : !material ? escapeHtml(entry.upgrade_blocked_reason || 'The required upgrade material is not available.') : !enoughMaterial ? `Need ${material.required - material.available} more ${escapeHtml(material.name)}.` : !enoughGold ? `Need ${(entry.gold_cost - Number(state.data.character.gold)).toLocaleString()} more gold.` : 'Ready to upgrade.'; return `<article class="crafting-card ${ready ? 'is-ready' : 'is-unavailable'}"><header><div><h3>${escapeHtml(entry.item?.name)}</h3><p>${escapeHtml(entry.item?.rarity)} · ${escapeHtml(entry.location)}</p></div><b class="crafting-output">+${entry.current_level_upgraded || 0} → +${entry.next_level} / max +${entry.item?.max_upgrade_level || 0}</b></header><p class="muted">Gold: ${Number(entry.gold_cost).toLocaleString()} · ${material ? `${escapeHtml(material.name)}: ${material.available} owned / ${material.required} needed` : 'Required material unavailable'}</p><p class="crafting-reason">${reason}</p><button class="crafting-action" data-upgrade="${entry.id}" ${state.upgradeBusy || !ready ? 'disabled' : ''} aria-disabled="${!ready}">${maxed ? 'Max level reached' : ready ? `Upgrade to +${entry.next_level}` : 'Unavailable'}</button></article>`; }).join('') : '<p class="crafting-empty">No upgradeable equipment is in your storage.</p>';
}

function render() { renderRecipeFilters(); const intro = { craft: 'Choose a recipe, check the materials you own, then craft. Material counts include your backpack and vault. Crafting spends energy and can fail when a recipe has a success chance below 100%.', upgrade: 'Select equipment to preview its exact next-level cost. Upgrades spend gold and materials from your backpack and vault.', cooking: 'Choose a Cooking recipe, check the ingredients you own, then cook. Ingredient counts include your backpack and vault. Cooking spends energy and can fail when a recipe has a success chance below 100%.', alchemy: 'Choose an Alchemy recipe, check the reagents you own, then brew. Reagent counts include your backpack and vault. Alchemy spends energy and can fail when a recipe has a success chance below 100%.', processing: 'Choose a Processing recipe, check the raw materials you own, then process them into refined goods. Material counts include your backpack and vault. Processing spends energy and can fail when a recipe has a success chance below 100%.', affix: 'Affixes will let you roll prefixes and suffixes onto equipment. This system is in development.' }; $('#craftingIntro').textContent = intro[state.tab]; renderSidebar(); if (isRecipeTab()) renderCraft(); else if (state.tab === 'upgrade') renderUpgrade(); else $('#craftingList').innerHTML = '<p class="crafting-empty">Affix rolling is in development. This tab will be enabled in a future update.</p>'; }

async function load() { $('#craftingStatus').textContent = 'Loading workshop…'; try { state.data = await getCraftingData(); $('#craftingStatus').textContent = ''; render(); } catch (error) { if (error.message.includes('Authentication')) location.replace(PAGES.LOGIN); else { $('#craftingStatus').textContent = error.message; $('#craftingList').innerHTML = '<p class="crafting-empty">The workshop could not be loaded. <button type="button" class="crafting-action" id="retryCrafting">Try again</button></p>'; } } }

document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { if (state.upgradeBusy) return; state.tab = button.dataset.tab; state.category = null; state.page = 1; document.querySelectorAll('[data-tab]').forEach((tab) => tab.setAttribute('aria-selected', tab === button ? 'true' : 'false')); render(); }));
$('#craftingCategories').addEventListener('click', (event) => { if (state.upgradeBusy) return; const button = event.target.closest('[data-category], [data-upgrade-category]'); if (!button) return; if (button.dataset.category !== undefined) { state.category = button.dataset.category || null; state.page = 1; } else state.upgradeCategory = button.dataset.upgradeCategory || null; render(); });
$('#craftingList').addEventListener('click', (event) => { if (event.target.closest('#retryCrafting')) load(); });
$('#craftingList').addEventListener('click', (event) => { const pageButton = event.target.closest('[data-recipe-page]'); if (!pageButton || pageButton.disabled) return; state.page += pageButton.dataset.recipePage === 'next' ? 1 : -1; render(); $('#craftingList').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
function upgradeProgress(button, duration = CRAFTING_ANIMATION_DURATION_MS, label = 'Upgrading…') {
  const started = performance.now();
  button.disabled = true;
  button.innerHTML = `<span class="upgrade-progress"><i></i></span>${label}`;
  const timer = setInterval(() => { const progress = Math.min(100, ((performance.now() - started) / duration) * 100); const bar = button.querySelector('i'); if (bar) bar.style.width = `${progress}%`; }, 40);
  return new Promise((resolve) => setTimeout(() => { clearInterval(timer); const bar = button.querySelector('i'); if (bar) bar.style.width = '100%'; resolve(); }, duration));
}

function craftBlocker(recipe, batch) {
  if (!recipe || !recipe.unlocked) return 'The recipe is no longer available.';
  if (recipe.ingredients.some((ingredient) => inventoryQuantity(ingredient.item_id) < ingredient.quantity * batch)) return 'Out of materials.';
  if (recipe.lifeskill && recipe.current_level < recipe.required_level) return `Requires ${recipe.lifeskill.name} level ${recipe.required_level}.`;
  if (Number(state.data.character.energy) < recipe.stamina_cost * batch) return 'Out of energy.';
  return '';
}

async function runCraftCycles(recipeId, quantity, durationSeconds, continuous) {
  state.upgradeBusy = true;
  state.continuous = continuous ? { recipeId, cycles: 0, stop: false } : null;
  let lastMessage = '';
  try {
    while (true) {
      render();
      const button = document.querySelector(`[data-craft="${recipeId}"]`);
      const label = quantity > 1 ? `Processing ×${quantity}…` : 'Crafting…';
      $('#craftingStatus').textContent = continuous ? `Continuous crafting · cycle ${state.continuous.cycles + 1}${lastMessage ? ` · last: ${lastMessage}` : ''}` : 'Crafting… keep this page open until it finishes.';
      if (button) await upgradeProgress(button, durationSeconds * 1000, label); else await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
      const result = await craftRecipe(recipeId, quantity);
      state.data = result.crafting;
      lastMessage = result.message;
      if (!continuous) { $('#craftingStatus').textContent = result.message; break; }
      state.continuous.cycles += 1;
      if (state.continuous.stop) { $('#craftingStatus').textContent = `Continuous crafting stopped after ${state.continuous.cycles} cycle${state.continuous.cycles === 1 ? '' : 's'}. Last: ${result.message}`; break; }
      const recipe = (state.data.recipes || []).find((entry) => String(entry.id) === String(recipeId));
      const blocker = craftBlocker(recipe, quantity);
      if (blocker) { $('#craftingStatus').textContent = `Continuous crafting finished after ${state.continuous.cycles} cycle${state.continuous.cycles === 1 ? '' : 's'}: ${blocker} Last: ${result.message}`; break; }
    }
  } catch (error) {
    $('#craftingStatus').textContent = state.continuous ? `Continuous crafting stopped after ${state.continuous.cycles} cycle${state.continuous.cycles === 1 ? '' : 's'}: ${error.message}` : error.message;
  } finally {
    state.upgradeBusy = false;
    state.continuous = null;
    render();
  }
}

$('#craftingList').addEventListener('click', (event) => { const stopButton = event.target.closest('[data-stop-continuous]'); if (!stopButton || !state.continuous) return; state.continuous.stop = true; stopButton.disabled = true; stopButton.textContent = 'Stopping after this cycle…'; });
$('#craftingList').addEventListener('click', async (event) => { if (state.upgradeBusy) return; const continuousButton = event.target.closest('[data-continuous]'); const singleButton = event.target.closest('[data-craft]'); const craftTrigger = continuousButton || singleButton; if (craftTrigger) { await runCraftCycles(craftTrigger.dataset.continuous || craftTrigger.dataset.craft, Number(craftTrigger.dataset.quantity || 1), Number(craftTrigger.dataset.duration || 30), Boolean(continuousButton)); return; } const upgradeButton = event.target.closest('[data-upgrade]'); if (!upgradeButton) return; const button = upgradeButton; button.disabled = true; state.upgradeBusy = true; $('#craftingStatus').textContent = 'Working…'; let progressPromise = null; try { const resultPromise = upgradeItemLevel(upgradeButton.dataset.upgrade); progressPromise = upgradeProgress(button); const result = (await Promise.all([resultPromise, progressPromise]))[0]; state.data = result.crafting; $('#craftingStatus').textContent = result.message; state.upgradeBusy = false; render(); } catch (error) { if (progressPromise) await progressPromise; state.upgradeBusy = false; $('#craftingStatus').textContent = error.message; render(); } });
$('#craftingList').addEventListener('change', (event) => { const input = event.target.closest('[data-batch]'); if (!input || state.upgradeBusy) return; const max = Number(input.max || 50); state.batch[input.dataset.batch] = Math.min(max, Math.max(1, Math.floor(Number(input.value) || 1))); render(); });
setupRecipeFilters();
load();
initializeSettingsMenu(async () => { try { await logout(); } finally { window.location.assign(PAGES.LOGIN); } });
const settingsIcon = document.querySelector('#settingsMenuButton path');
if (settingsIcon) settingsIcon.setAttribute('d', settingsIconPath);

const toastElement = document.querySelector('#toast');
const notify = toastElement ? createToast(toastElement) : () => {};

document.querySelector('#topShopButton')?.addEventListener('click', (event) => {
  event.preventDefault();
  const sublocationType = state.data?.character?.sublocation?.sublocation_type;
  if (!state.data?.character?.sublocation_id || !TRADING_SUBLOCATION_TYPES.includes(sublocationType)) {
    notify('A shop is not available at this location.');
    return;
  }
  window.location.assign(PAGES.SHOP);
});

