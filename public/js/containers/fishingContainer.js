import { getFishingData, executeFish } from '../logics/authApi.js';
import { createToast } from '../components/toast.js';
import { DEFAULT_FISHING_CYCLE_MS, IDLE_STATUS_LABEL, LOOT_GROUP_RARITY, PAGES } from '../constants.js';

const state = {
  isOpen: false,
  isFishing: false,
  timerInterval: null,
  cycleDurationMs: DEFAULT_FISHING_CYCLE_MS,
  cycleStartTime: null,
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

function appendLogEntry(message, type = 'normal') {
  const logList = document.querySelector('#fishingLogList');
  if (!logList) return;
  const entry = document.createElement('div');
  entry.className = `gathering-log-entry ${type === 'rare' ? 'has-rare' : type === 'free' ? 'is-free' : type === 'warn' ? 'is-warn' : ''}`;
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

function renderLootGroups(lootGroups) {
  const container = document.querySelector('#fishingLootGroupsContainer');
  if (!container) return;
  container.replaceChildren();

  (lootGroups || []).forEach((group) => {
    const rarity = group.loot_group_rarity || (group.is_rare ? LOOT_GROUP_RARITY.RARE : LOOT_GROUP_RARITY.COMMON);
    const isRare = group.is_rare || rarity === LOOT_GROUP_RARITY.RARE || rarity === LOOT_GROUP_RARITY.LEGENDARY;
    const isUncommon = rarity === LOOT_GROUP_RARITY.UNCOMMON;
    const card = document.createElement('div');
    card.className = `gathering-group-card ${isRare ? 'is-rare-card' : isUncommon ? 'is-uncommon-card' : ''}`;

    const titleRow = document.createElement('div');
    titleRow.className = 'gathering-group-title';

    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = `<span>${escapeHtml(group.name)}</span> <span class="badge ${rarity.toLowerCase()}" style="margin-left: 6px; font-size: 11px;">${rarity}</span>`;

    const chanceSpan = document.createElement('span');
    chanceSpan.className = 'gathering-group-chance';
    chanceSpan.textContent = rarity !== LOOT_GROUP_RARITY.COMMON
      ? `★ ${rarity} Proc: ${group.activation_chance_pct}%`
      : `✓ ${group.activation_chance_pct}% Group Chance`;

    titleRow.append(nameSpan, chanceSpan);
    card.append(titleRow);

    const chipContainer = document.createElement('div');
    chipContainer.className = 'gathering-item-chips';

    if (group.min_gold > 0 || group.max_gold > 0) {
      const goldChip = document.createElement('span');
      goldChip.className = 'gathering-item-chip';
      goldChip.innerHTML = `◈ Gold <small>(${group.min_gold}–${group.max_gold})</small>`;
      chipContainer.append(goldChip);
    }

    (group.items || []).forEach((item) => {
      const chip = document.createElement('span');
      chip.className = `gathering-item-chip ${isRare ? 'is-rare' : isUncommon ? 'is-uncommon' : ''}`;
      const qtyText = item.min_quantity === item.max_quantity
        ? `x${item.min_quantity}`
        : `${item.min_quantity}–${item.max_quantity}`;
      chip.innerHTML = `${escapeHtml(item.name)} <small>(${item.chance_pct}% · ${qtyText})</small>`;
      chipContainer.append(chip);
    });

    card.append(chipContainer);
    container.append(card);
  });
}

function renderModalData() {
  if (!state.data) return;
  const { character, lifeskill, loot_groups } = state.data;

  updateElementText('#fishingLocationBadge', character.location_name);
  updateElementText('#fishingRankLabel', lifeskill.rank);
  updateElementText('#fishingLevel', lifeskill.level);
  updateElementText('#fishingEnergy', `${character.current_energy} / ${character.max_energy}`);
  updateElementText('#fishingRareChance', `+${lifeskill.drop_bonus_pct ?? 0}%`);
  updateElementText('#fishingFreeChance', `${lifeskill.free_gather_chance_pct}%`);
  updateElementText('#fishingExpText', `${lifeskill.current_exp} / ${lifeskill.next_level_exp} XP`);

  const expFill = document.querySelector('#fishingExpFill');
  if (expFill && lifeskill.next_level_exp > 0) {
    const expPct = Math.min(100, Math.max(0, (lifeskill.current_exp / lifeskill.next_level_exp) * 100));
    expFill.style.width = `${expPct}%`;
  }

  renderLootGroups(loot_groups);
  updateHudVitals(character);
}

export async function openFishingModal() {
  const modal = document.querySelector('#fishingModal');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  state.isOpen = true;

  try {
    state.data = await getFishingData();
    renderModalData();
  } catch (error) {
    createToast(error.message || 'Failed to load fishing info.', 'error');
  }
}

export function closeFishingModal() {
  const modal = document.querySelector('#fishingModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  state.isOpen = false;
}

async function performFishTick() {
  if (!state.isFishing) return;

  const timerText = document.querySelector('#fishingTimerText');
  if (timerText) timerText.textContent = 'Reeling in…';

  try {
    const result = await executeFish();
    if (!result || !result.success) {
      stopAutoFish();
      appendLogEntry(result?.message || 'Fishing failed.', 'warn');
      return;
    }

    if (state.data) {
      state.data.character.current_energy = result.character.current_energy;
      state.data.character.max_energy = result.character.max_energy;
      state.data.character.gold = result.character.gold;
      state.data.character.used_slots = result.character.used_slots;
      state.data.lifeskill = result.lifeskill;
      renderModalData();
    }

    const itemDrops = (result.gathered_items || [])
      .map((i) => `${i.quantity}x ${i.name}${i.is_rare ? ' (Rare!)' : i.rarity === LOOT_GROUP_RARITY.UNCOMMON ? ' (Uncommon)' : ''}`)
      .join(', ');

    let logMessage = `Caught: ${itemDrops || 'Nothing'}`;
    if (result.gold_gained > 0) logMessage += ` +${result.gold_gained}g`;
    logMessage += ` (+${result.exp_gained} XP`;
    if (result.is_free_gather) {
      logMessage += `, Free Cast Proc!)`;
    } else {
      logMessage += `, -1 Energy)`;
    }

    const logType = result.rare_proc ? 'rare' : result.is_free_gather ? 'free' : 'normal';
    appendLogEntry(logMessage, logType);

    if (result.ambush) {
      stopAutoFish();
      appendLogEntry(`⚔️ Ambush! A ${result.ambush.monster_name} attacks you (${Number(result.ambush.chance_pct || 0).toFixed(1)}% ambush chance).`, 'warn');
      if (result.ambush.started) {
        createToast(`Ambushed by ${result.ambush.monster_name}! Entering combat…`, 'warning');
        setTimeout(() => window.location.replace(PAGES.COMBAT), 1200);
      } else {
        appendLogEntry(result.ambush.error || 'The ambush could not start.', 'warn');
      }
      return;
    }
    if (result.ambush_chance_pct) appendLogEntry(`Danger: next ambush chance ${Number(result.ambush_chance_pct).toFixed(1)}%.`, 'warn');

    if (result.leveled_up) {
      createToast(`Fishing Level Up! You reached Level ${result.lifeskill.level} (${result.lifeskill.rank})!`, 'success');
      appendLogEntry(`🎉 Fishing level up! Level ${result.lifeskill.level} reached!`, 'rare');
    }

    if (result.character.current_energy < 1) {
      stopAutoFish();
      appendLogEntry('Exhausted! You ran out of energy. Resting or food is needed.', 'warn');
      createToast('Out of energy! Auto-fishing stopped.', 'warning');
      return;
    }

    if (state.isFishing) {
      startCycleCountdown();
    }
  } catch (error) {
    stopAutoFish();
    appendLogEntry(`Fishing stopped: ${error.message}`, 'warn');
    createToast(error.message || 'Fishing halted.', 'error');
  }
}

function startCycleCountdown() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  state.cycleStartTime = Date.now();
  const fill = document.querySelector('#fishingTimerFill');
  const timerText = document.querySelector('#fishingTimerText');

  state.timerInterval = setInterval(() => {
    if (!state.isFishing) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      return;
    }

    const elapsed = Date.now() - state.cycleStartTime;
    const progress = Math.min(1, elapsed / state.cycleDurationMs);
    const remainingSeconds = Math.max(0, Math.ceil((state.cycleDurationMs - elapsed) / 1000));

    if (fill) fill.style.width = `${progress * 100}%`;
    if (timerText) timerText.textContent = `Fishing in progress… ${remainingSeconds}s remaining`;

    if (elapsed >= state.cycleDurationMs) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      if (fill) fill.style.width = '100%';
      performFishTick();
    }
  }, 100);
}

export function startAutoFish() {
  if (state.isFishing) return;
  if (state.data && state.data.character.current_energy < 1) {
    createToast('You do not have enough energy to fish.', 'warning');
    appendLogEntry('Cannot start: No energy available.', 'warn');
    return;
  }

  state.isFishing = true;
  const statusPill = document.querySelector('#fishingStatusPill');
  if (statusPill) {
    statusPill.textContent = 'FISHING (20s Loop)';
    statusPill.className = 'gathering-status-pill is-active';
  }

  const btnStart = document.querySelector('#btnStartFishing');
  const btnStop = document.querySelector('#btnStopFishing');
  if (btnStart) btnStart.disabled = true;
  if (btnStop) btnStop.disabled = false;

  appendLogEntry('Auto-fishing started. Casting every 20 seconds…');
  startCycleCountdown();
}

export function stopAutoFish() {
  state.isFishing = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  const statusPill = document.querySelector('#fishingStatusPill');
  if (statusPill) {
    statusPill.textContent = IDLE_STATUS_LABEL;
    statusPill.className = 'gathering-status-pill';
  }

  const fill = document.querySelector('#fishingTimerFill');
  if (fill) fill.style.width = '0%';

  const timerText = document.querySelector('#fishingTimerText');
  if (timerText) timerText.textContent = 'Take 20s per cast · Consumes 1 Energy';

  const btnStart = document.querySelector('#btnStartFishing');
  const btnStop = document.querySelector('#btnStopFishing');
  if (btnStart) btnStart.disabled = false;
  if (btnStop) btnStop.disabled = true;

  appendLogEntry('Auto-fishing paused.');
}

export function initFishingContainer() {
  const btnOpen = document.querySelector('#fishingButton');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => openFishingModal());
  }

  const closeBtns = document.querySelectorAll('[data-close-fishing]');
  closeBtns.forEach((btn) => {
    btn.addEventListener('click', () => closeFishingModal());
  });

  const btnStart = document.querySelector('#btnStartFishing');
  if (btnStart) {
    btnStart.addEventListener('click', () => startAutoFish());
  }

  const btnStop = document.querySelector('#btnStopFishing');
  if (btnStop) {
    btnStop.addEventListener('click', () => stopAutoFish());
  }

  const lifeskillList = document.querySelector('.lifeskill-list');
  if (lifeskillList) {
    lifeskillList.addEventListener('click', (event) => {
      const row = event.target.closest('div');
      if (row && row.textContent.includes('Fishing')) {
        openFishingModal();
      }
    });
  }
}
