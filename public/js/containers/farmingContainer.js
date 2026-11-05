import { getFarmingData, executeFarm, buyFarmingSeed } from '../logics/authApi.js';
import { createToast } from '../components/toast.js';
import {
  DEFAULT_FARMING_CYCLE_MS,
  DEFAULT_RECIPE_DURATION_SECONDS,
  IDLE_STATUS_LABEL,
  MIN_LIFESKILL_CYCLE_MS,
} from '../constants.js';

const state = {
  isOpen: false,
  isFarming: false,
  timerInterval: null,
  cycleDurationMs: DEFAULT_FARMING_CYCLE_MS,
  cycleStartTime: null,
  selectedRecipeId: null,
  data: null
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function updateElementText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text ?? '';
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(seconds) {
  const s = Math.max(1, Math.floor(Number(seconds) || 1));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0 && rem > 0) return `${m}m ${rem}s`;
  if (m > 0) return `${m}m`;
  return `${rem}s`;
}

function appendLogEntry(message, type = 'normal') {
  const logList = document.querySelector('#farmingLogList');
  if (!logList) return;
  const entry = document.createElement('div');
  entry.className = `farming-log-entry ${type === 'rare' ? 'has-rare' : type === 'free' ? 'is-free' : type === 'warn' ? 'is-warn' : ''}`;
  entry.innerHTML = `[${formatTime(new Date())}] ${message}`;
  logList.prepend(entry);

  while (logList.children.length > 50) {
    logList.removeChild(logList.lastChild);
  }
}

function updateHudVitals(character) {
  if (!character) return;
  const energyMeter = document.querySelector('.sidebar .vitals .meter.energy i') ||
    document.querySelectorAll('.vitals .meter i')[1];
  const energyLabel = document.querySelector('.vitals > div:nth-child(2) label b') ||
    document.querySelectorAll('.vitals label b')[1];
  if (energyLabel && character.current_energy != null && character.max_energy != null) {
    energyLabel.textContent = `${character.current_energy} / ${character.max_energy}`;
  }
  if (energyMeter && character.max_energy > 0) {
    const pct = Math.max(0, Math.min(100, (character.current_energy / character.max_energy) * 100));
    energyMeter.style.width = `${pct}%`;
  }
  const goldLabel = document.querySelector('.sidebar-bottom span');
  if (goldLabel && character.gold != null) {
    goldLabel.textContent = `◈ ${Number(character.gold).toLocaleString()}`;
  }
}

function getSelectedRecipe() {
  if (!state.data || !state.data.recipes) return null;
  return state.data.recipes.find((r) => r.id === state.selectedRecipeId) || state.data.recipes[0] || null;
}

function renderRecipeList() {
  const container = document.querySelector('#farmingRecipesContainer');
  if (!container || !state.data) return;
  container.replaceChildren();

  const recipes = state.data.recipes || [];
  if (!recipes.length) {
    container.innerHTML = '<p class="farming-empty">No farming crops available.</p>';
    return;
  }

  if (!state.selectedRecipeId && recipes.length > 0) {
    state.selectedRecipeId = recipes[0].id;
  }

  recipes.forEach((recipe) => {
    const isSelected = recipe.id === state.selectedRecipeId;
    const primaryIngredient = recipe.ingredients[0] || null;
    const ownedSeeds = primaryIngredient ? primaryIngredient.owned_quantity : 0;
    const hasEnoughSeeds = ownedSeeds >= (primaryIngredient?.quantity || 1);
    const card = document.createElement('div');
    card.className = `farming-recipe-card ${isSelected ? 'is-selected' : ''} ${!hasEnoughSeeds ? 'is-low-seed' : ''}`;
    card.dataset.recipeId = String(recipe.id);

    const header = document.createElement('div');
    header.className = 'farming-recipe-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = recipe.name;
    const desc = document.createElement('p');
    desc.className = 'farming-recipe-desc';
    desc.textContent = recipe.description || '';
    titleWrap.append(title, desc);

    const badge = document.createElement('span');
    badge.className = 'farming-time-badge';
    badge.textContent = `⏱ ${formatDuration(recipe.duration_seconds)}`;
    header.append(titleWrap, badge);

    const details = document.createElement('div');
    details.className = 'farming-recipe-details';

    const outputInfo = document.createElement('div');
    outputInfo.className = 'farming-detail-item';
    const yieldText = recipe.output_quantity === recipe.max_output_quantity
      ? `x${recipe.output_quantity}`
      : `${recipe.output_quantity}–${recipe.max_output_quantity}`;
    outputInfo.innerHTML = `<span>Harvest:</span> <b>${escapeHtml(recipe.output_item.name)} (${yieldText})</b>`;

    const seedInfo = document.createElement('div');
    seedInfo.className = 'farming-detail-item';
    seedInfo.innerHTML = `<span>Seed Needed:</span> <b class="${hasEnoughSeeds ? 'has-stock' : 'no-stock'}">${primaryIngredient ? primaryIngredient.name : 'None'} (Owned: ${ownedSeeds})</b>`;

    details.append(outputInfo, seedInfo);

    const footer = document.createElement('div');
    footer.className = 'farming-recipe-footer';

    if (primaryIngredient && primaryIngredient.is_buyable) {
      const buyWrap = document.createElement('div');
      buyWrap.className = 'farming-quickbuy-wrap';

      const buyLabel = document.createElement('span');
      buyLabel.className = 'farming-seed-price';
      buyLabel.textContent = `◈ ${primaryIngredient.price}g / seed`;

      const btnBuy1 = document.createElement('button');
      btnBuy1.type = 'button';
      btnBuy1.className = 'farming-btn-buy';
      btnBuy1.textContent = '+1 Seed';
      btnBuy1.disabled = state.isFarming;
      btnBuy1.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBuySeeds(primaryIngredient.item_id, 1);
      });

      const btnBuy5 = document.createElement('button');
      btnBuy5.type = 'button';
      btnBuy5.className = 'farming-btn-buy';
      btnBuy5.textContent = '+5 Seeds';
      btnBuy5.disabled = state.isFarming;
      btnBuy5.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBuySeeds(primaryIngredient.item_id, 5);
      });

      const btnBuy10 = document.createElement('button');
      btnBuy10.type = 'button';
      btnBuy10.className = 'farming-btn-buy';
      btnBuy10.textContent = '+10 Seeds';
      btnBuy10.disabled = state.isFarming;
      btnBuy10.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBuySeeds(primaryIngredient.item_id, 10);
      });

      buyWrap.append(buyLabel, btnBuy1, btnBuy5, btnBuy10);
      footer.append(buyWrap);
    }

    card.append(header, details, footer);

    card.addEventListener('click', () => {
      if (state.isFarming) {
        createToast('Stop auto-farming before changing seeds.', 'warning');
        return;
      }
      state.selectedRecipeId = recipe.id;
      updateCycleDuration();
      renderModalData();
    });

    container.append(card);
  });
}

function updateCycleDuration() {
  const selected = getSelectedRecipe();
  if (selected) {
    state.cycleDurationMs = Math.max(MIN_LIFESKILL_CYCLE_MS, Number(selected.duration_seconds || DEFAULT_RECIPE_DURATION_SECONDS) * 1000);
  }
}

function renderModalData() {
  if (!state.data) return;
  const { character, lifeskill } = state.data;
  const selected = getSelectedRecipe();

  updateElementText('#farmingLocationBadge', character.location_name);
  updateElementText('#farmingRankLabel', lifeskill.rank);
  updateElementText('#farmingLevel', lifeskill.level);
  updateElementText('#farmingEnergy', `${character.current_energy} / ${character.max_energy}`);
  updateElementText('#farmingBonusYieldChance', `${lifeskill.bonus_yield_chance_pct}%`);
  updateElementText('#farmingFreeChance', `${lifeskill.free_energy_chance_pct}%`);
  updateElementText('#farmingExpText', `${lifeskill.current_exp} / ${lifeskill.next_level_exp} XP`);

  const expFill = document.querySelector('#farmingExpFill');
  if (expFill && lifeskill.next_level_exp > 0) {
    const expPct = Math.min(100, Math.max(0, (lifeskill.current_exp / lifeskill.next_level_exp) * 100));
    expFill.style.width = `${expPct}%`;
  }

  if (!state.isFarming) {
    const timerText = document.querySelector('#farmingTimerText');
    if (timerText) {
      if (selected) {
        timerText.textContent = `Takes ${formatDuration(selected.duration_seconds)} · Consumes 1 ${selected.ingredients[0]?.name || 'Seed'} & ${selected.stamina_cost} Energy`;
      } else {
        timerText.textContent = 'Select a seed crop to begin farming.';
      }
    }
  }

  renderRecipeList();
  updateHudVitals(character);
}

async function handleBuySeeds(seedItemId, quantity) {
  try {
    const result = await buyFarmingSeed(seedItemId, quantity);
    if (!result || !result.success) {
      createToast(result?.message || 'Failed to buy seeds.', 'error');
      return;
    }
    createToast(result.message, 'success');
    appendLogEntry(result.message);

    if (state.data) {
      state.data.character.gold = result.gold;
      state.data.recipes.forEach((r) => {
        r.ingredients.forEach((ing) => {
          if (ing.item_id === seedItemId) {
            ing.owned_quantity = result.owned_quantity;
          }
        });
      });
      renderModalData();
    }
  } catch (error) {
    createToast(error.message || 'Failed to purchase seeds.', 'error');
  }
}

export async function openFarmingModal() {
  const modal = document.querySelector('#farmingModal');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  state.isOpen = true;

  try {
    state.data = await getFarmingData();
    updateCycleDuration();
    renderModalData();
  } catch (error) {
    createToast(error.message || 'Failed to load farming info.', 'error');
  }
}

export function closeFarmingModal() {
  const modal = document.querySelector('#farmingModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  state.isOpen = false;
}

async function performFarmTick() {
  if (!state.isFarming) return;

  const timerText = document.querySelector('#farmingTimerText');
  if (timerText) timerText.textContent = 'Harvesting crop…';

  try {
    const result = await executeFarm(state.selectedRecipeId);
    if (!result || !result.success) {
      stopAutoFarm();
      appendLogEntry(result?.message || 'Farming failed.', 'warn');
      return;
    }

    if (state.data) {
      state.data.character.current_energy = result.character.current_energy;
      state.data.character.max_energy = result.character.max_energy;
      state.data.character.gold = result.character.gold;
      state.data.character.used_slots = result.character.used_slots;
      state.data.lifeskill = result.lifeskill;

      if (result.consumed_seed) {
        state.data.recipes.forEach((r) => {
          r.ingredients.forEach((ing) => {
            if (ing.item_id === result.consumed_seed.item_id) {
              ing.owned_quantity = result.consumed_seed.remaining_quantity;
            }
          });
        });
      }

      renderModalData();
    }

    const item = result.harvested_item;
    let logMessage = `Harvested: ${item.quantity}x ${item.name}`;
    if (item.has_bonus_yield) logMessage += ' (★ Bonus Yield Proc!)';
    logMessage += ` (+${result.exp_gained} XP`;
    if (result.is_free_energy) {
      logMessage += ', ⚡ Free Energy Proc!)';
    } else {
      logMessage += `, -${result.energy_consumed} Energy)`;
    }

    const logType = item.has_bonus_yield ? 'rare' : result.is_free_energy ? 'free' : 'normal';
    appendLogEntry(logMessage, logType);

    if (result.leveled_up) {
      createToast(`Farming Level Up! You reached Level ${result.lifeskill.level} (${result.lifeskill.rank})!`, 'success');
      appendLogEntry(`🎉 Farming level up! Level ${result.lifeskill.level} reached!`, 'rare');
    }

    if (result.consumed_seed && result.consumed_seed.remaining_quantity <= 0) {
      stopAutoFarm();
      appendLogEntry(`Out of ${result.consumed_seed.name}! Auto-farming stopped.`, 'warn');
      createToast(`Ran out of ${result.consumed_seed.name}. Auto-farming stopped.`, 'warning');
      return;
    }

    if (result.character.current_energy < 1) {
      stopAutoFarm();
      appendLogEntry('Exhausted! You ran out of energy. Resting or food is needed.', 'warn');
      createToast('Out of energy! Auto-farming stopped.', 'warning');
      return;
    }

    if (state.isFarming) {
      startCycleCountdown();
    }
  } catch (error) {
    stopAutoFarm();
    appendLogEntry(`Farming stopped: ${error.message}`, 'warn');
    createToast(error.message || 'Farming halted.', 'error');
  }
}

function startCycleCountdown() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  updateCycleDuration();
  state.cycleStartTime = Date.now();
  const fill = document.querySelector('#farmingTimerFill');
  const timerText = document.querySelector('#farmingTimerText');
  const selected = getSelectedRecipe();

  state.timerInterval = setInterval(() => {
    if (!state.isFarming) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      return;
    }

    const elapsed = Date.now() - state.cycleStartTime;
    const progress = Math.min(1, elapsed / state.cycleDurationMs);
    const remainingSeconds = Math.max(0, Math.ceil((state.cycleDurationMs - elapsed) / 1000));

    if (fill) fill.style.width = `${progress * 100}%`;
    if (timerText) {
      timerText.textContent = `Cultivating ${selected?.name || 'crop'}… ${formatDuration(remainingSeconds)} remaining`;
    }

    if (elapsed >= state.cycleDurationMs) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      if (fill) fill.style.width = '100%';
      performFarmTick();
    }
  }, 100);
}

export function startAutoFarm() {
  if (state.isFarming) return;
  const selected = getSelectedRecipe();
  if (!selected) {
    createToast('Please select a seed crop to farm.', 'warning');
    return;
  }

  const primaryIngredient = selected.ingredients[0] || null;
  if (primaryIngredient && primaryIngredient.owned_quantity < primaryIngredient.quantity) {
    createToast(`You need ${primaryIngredient.name} to farm this crop. Please buy seeds first.`, 'warning');
    appendLogEntry(`Cannot start: No ${primaryIngredient.name} in inventory.`, 'warn');
    return;
  }

  if (state.data && state.data.character.current_energy < selected.stamina_cost) {
    createToast('You do not have enough energy to farm.', 'warning');
    appendLogEntry('Cannot start: No energy available.', 'warn');
    return;
  }

  state.isFarming = true;
  const statusPill = document.querySelector('#farmingStatusPill');
  if (statusPill) {
    statusPill.textContent = `FARMING (${formatDuration(selected.duration_seconds)} Loop)`;
    statusPill.className = 'farming-status-pill is-active';
  }

  const btnStart = document.querySelector('#btnStartFarming');
  const btnStop = document.querySelector('#btnStopFarming');
  if (btnStart) btnStart.disabled = true;
  if (btnStop) btnStop.disabled = false;

  appendLogEntry(`Auto-farming started for ${selected.name} (${formatDuration(selected.duration_seconds)} per harvest)…`);
  renderRecipeList();
  startCycleCountdown();
}

export function stopAutoFarm() {
  state.isFarming = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  const statusPill = document.querySelector('#farmingStatusPill');
  if (statusPill) {
    statusPill.textContent = IDLE_STATUS_LABEL;
    statusPill.className = 'farming-status-pill';
  }

  const fill = document.querySelector('#farmingTimerFill');
  if (fill) fill.style.width = '0%';

  const selected = getSelectedRecipe();
  const timerText = document.querySelector('#farmingTimerText');
  if (timerText) {
    if (selected) {
      timerText.textContent = `Takes ${formatDuration(selected.duration_seconds)} · Consumes 1 ${selected.ingredients[0]?.name || 'Seed'} & ${selected.stamina_cost} Energy`;
    } else {
      timerText.textContent = 'Select a seed crop to begin farming.';
    }
  }

  const btnStart = document.querySelector('#btnStartFarming');
  const btnStop = document.querySelector('#btnStopFarming');
  if (btnStart) btnStart.disabled = false;
  if (btnStop) btnStop.disabled = true;

  appendLogEntry('Auto-farming paused.');
  renderRecipeList();
}

export function initFarmingContainer() {
  const btnOpen = document.querySelector('#farmingButton');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => openFarmingModal());
  }

  const closeBtns = document.querySelectorAll('[data-close-farming]');
  closeBtns.forEach((btn) => {
    btn.addEventListener('click', () => closeFarmingModal());
  });

  const btnStart = document.querySelector('#btnStartFarming');
  if (btnStart) {
    btnStart.addEventListener('click', () => startAutoFarm());
  }

  const btnStop = document.querySelector('#btnStopFarming');
  if (btnStop) {
    btnStop.addEventListener('click', () => stopAutoFarm());
  }

  const lifeskillList = document.querySelector('.lifeskill-list');
  if (lifeskillList) {
    lifeskillList.addEventListener('click', (event) => {
      const row = event.target.closest('div');
      if (row && row.textContent.includes('Farming')) {
        openFarmingModal();
      }
    });
  }
}
