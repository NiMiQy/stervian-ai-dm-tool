import { getActiveBattle, getCharacter, getCurrentUser, getEncounterBattle, startAreaEncounter, logout, upgradeCharacterStat, getVault, depositVaultItem, withdrawVaultItem, transferVaultGold, equipItem, unequipItem, useItem, getShop, enterSublocation, getWorldTravelMap, getWorldTime, getWorldWeather, travelToLocation, buyShopItem, sellShopItem, takeInnLongRest, fulfillInnFoodAndWater, sendGameAction, getContextCheck, getStoryHistory, createStoryTurn, updateStoryTurn, deleteStoryTurn, clearStoryHistory, getParty, getNearbyNpcs, getAllNpcs, getQuestBoard, startTraining, acceptQuest, completeQuest, abandonQuest, createParty, invitePartyMember, respondPartyInvite, recruitNpc, dismissCompanion, leaveParty, updateCompanionTactics, updateCharacterAvatar , getCampfire, restAtCampfire, getDialogueLeaveCheck, getResumableDialogues, resumeDialogues, endDialogue, sendObserveAction } from '../logics/authApi.js';
import { initChecksContainer } from './checksContainer.js';
import { initToolsCallContainer } from './toolsCallContainer.js';
import { initCombatSelectContainer } from './combatSelectContainer.js';
import { initObserveContainer, observeBlockReason } from './observeContainer.js';
import { initScenesContainer } from './scenesContainer.js';
import { appendNarration, appendPlayerAction, appendStoryStatus, createStoryEntryElement } from '../components/storyEntry.js';
import { createToast } from '../components/toast.js';
import { initAiApiKeyControl } from '../components/aiApiKeyControl.js';
import { initialiseEquipmentTooltips } from '../components/equipmentTooltips.js';
import { initializeSettingsMenu } from '../components/settingsMenu.js';
import { initialiseCharacterCreation } from './characterCreationContainer.js';
import { initGatheringContainer, closeGatheringModal } from './gatheringContainer.js';
import { initFishingContainer, closeFishingModal } from './fishingContainer.js';
import { initFarmingContainer, closeFarmingModal } from './farmingContainer.js';
import {
  ACTION_MODES,
  BATTLE_STATUS,
  CHARACTER_TYPE,
  DEFAULT_TACTICS_ROLE,
  EQUIPPABLE_ITEM_TYPES,
  EXPERIENCE_THRESHOLDS,
  ITEM_LOCATION,
  ITEM_TYPE,
  LIFESKILL_EXP_PER_LEVEL,
  LONG_TERM_MEMORY_TTL_MS,
  MAX_EXPERIENCE,
  MAX_LEVEL,
  MEMORY_TYPE,
  PAGES,
  PARTY_MEMBER_ROLE,
  SHORT_TERM_MEMORY_TTL_MS,
  STORAGE_KEY_PREFIXES,
  SUBLOCATION_TYPE,
  TACTICS_ROLE,
  TRADING_SUBLOCATION_TYPES,
  VAULT_TRANSFER_DIRECTION,
  WEBSOCKET_EVENTS,
  WEBSOCKET_INITIAL_RECONNECT_DELAY_MS,
  WEBSOCKET_MAX_RECONNECT_DELAY_MS,
  WEBSOCKET_PATH,
  WEBSOCKET_STORY_CHANNEL,
} from '../constants.js';

function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value ?? ''; }

function numericValue(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function percentage(current, max) { return max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0; }
function experienceForLevel(level) { const normalizedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(numericValue(level, 1)))); return EXPERIENCE_THRESHOLDS[normalizedLevel] ?? MAX_EXPERIENCE; }
function nextExperienceTarget(level) { const normalizedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(numericValue(level, 1)))); return normalizedLevel >= MAX_LEVEL ? MAX_EXPERIENCE : EXPERIENCE_THRESHOLDS[normalizedLevel + 1]; }
function lifeSkillExperienceForLevel(level) { return Math.max(1, numericValue(level, 1)) * LIFESKILL_EXP_PER_LEVEL; }

const attributeInfo = {
  strength: { label: 'STR · Strength', desc: 'Increases Physical Attack / Damage, Max HP, and Status Resistance.' },
  intelligent: { label: 'INT · Intelligence', desc: 'Increases Magical Attack / Damage and Spell Amplification.' },
  dexterity: { label: 'DEX · Dexterity', desc: 'Increases Armor, Initiative, and Physical Attack / Damage.' },
  charisma: { label: 'CHA · Charisma', desc: 'Increases Magical Attack / Damage and Convince / Persuasion Chance.' },
  constitution: { label: 'CON · Constitution', desc: 'Greatly increases Max HP and Status Resistance.' },
  wisdom: { label: 'WIS · Wisdom', desc: 'Increases Magical Armor, all Elemental Resistances, and Magical Attack / Damage.' }
};

function attachStatTooltip(button, statKey) {
  const info = attributeInfo[statKey];
  if (!info) return;
  button.title = `${info.label} — ${info.desc}`;
  let tooltip = button.querySelector('.stat-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('span');
    tooltip.className = 'stat-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML = `<strong>${info.label}</strong><span>${info.desc}</span>`;
    button.append(tooltip);
  }
  const show = () => {
    tooltip.classList.add('is-visible');
    document.body.append(tooltip);
    const bounds = button.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, bounds.left + (bounds.width - width) / 2))}px`;
    tooltip.style.top = `${Math.max(8, bounds.top - tooltip.offsetHeight - 8)}px`;
  };
  const hide = () => {
    tooltip.classList.remove('is-visible');
    button.append(tooltip);
    tooltip.removeAttribute('style');
  };
  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('focus', show);
  button.addEventListener('blur', hide);
}

function promptItemAction({ eyebrow = 'INVENTORY', title, message, details = '', confirmText = 'Confirm', onConfirm, secondaryText = '', onSecondary = null, confirmDisabled = false, secondaryDisabled = false }) {
  const modal = document.querySelector('#itemActionModal');
  if (!modal) return;
  setText('#itemActionEyebrow', eyebrow);
  setText('#itemActionTitle', title);
  setText('#itemActionMessage', message);
  const detailsEl = document.querySelector('#itemActionDetails');
  if (detailsEl) {
    if (details) {
      detailsEl.innerHTML = details;
      detailsEl.style.display = 'block';
    } else {
      detailsEl.innerHTML = '';
      detailsEl.style.display = 'none';
    }
  }
  const confirmBtn = document.querySelector('#itemActionConfirmButton');
  document.querySelector('#itemActionSecondaryButton')?.remove();
  if (confirmBtn && onSecondary) {
    const secondaryBtn = document.createElement('button');
    secondaryBtn.type = 'button';
    secondaryBtn.className = 'action-btn-confirm';
    secondaryBtn.id = 'itemActionSecondaryButton';
    secondaryBtn.textContent = secondaryText;
    secondaryBtn.disabled = secondaryDisabled;
    secondaryBtn.onclick = async () => {
      secondaryBtn.disabled = true;
      try {
        await onSecondary();
        closeItemActionModal();
      } catch (error) {
        secondaryBtn.disabled = false;
      }
    };
    confirmBtn.before(secondaryBtn);
  }
  if (confirmBtn) {
    confirmBtn.textContent = confirmText;
    confirmBtn.disabled = confirmDisabled;
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try {
        await onConfirm();
        closeItemActionModal();
      } catch (error) {
        confirmBtn.disabled = false;
      }
    };
  }
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeItemActionModal() {
  const modal = document.querySelector('#itemActionModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function attachInventoryTooltip(button) {
  const tooltip = button.querySelector('.inventory-tooltip');
  if (!tooltip) return;
  const show = () => {
    tooltip.classList.add('is-visible');
    document.body.append(tooltip);
    const bounds = button.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, bounds.left + (bounds.width - width) / 2))}px`;
    tooltip.style.top = `${Math.max(8, bounds.top - tooltip.offsetHeight - 8)}px`;
  };
  const hide = () => {
    tooltip.classList.remove('is-visible');
    button.append(tooltip);
    tooltip.removeAttribute('style');
  };
  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('focus', show);
  button.addEventListener('blur', hide);
}

function renderSpellPoints(character) {
  const container = document.querySelector('.sheet-spell-points');
  if (!container) return;
  container.replaceChildren();
  const spellRows = (character.character_spellpoints || []).filter((spell) => spell.level != null).sort((left, right) => numericValue(left.level) - numericValue(right.level));
  const rows = spellRows.length ? spellRows : [{ level: 1, current: 0, max_current: 0 }];
  rows.forEach((spell) => {
    const level = Math.max(1, numericValue(spell.level, 1));
    const max = Math.max(0, numericValue(spell.max_current));
    const current = Math.min(max, Math.max(0, numericValue(spell.current)));
    const row = document.createElement('div');
    row.className = 'spell-level';
    const label = document.createElement('span');
    label.textContent = `LV${level}`;
    label.setAttribute('aria-label', `Spell level ${level}`);
    const squares = document.createElement('span');
    squares.className = 'spell-squares';
    squares.setAttribute('aria-label', `${current} of ${max} spell points available`);
    for (let index = 0; index < max; index += 1) {
      const square = document.createElement('i');
      square.className = `spell-square ${index < current ? 'is-available' : 'is-used'}`;
      square.setAttribute('aria-hidden', 'true');
      squares.append(square);
    }
    row.append(label, squares);
    container.append(row);
  });
}

function getBdoRankTitle(level) {
  const lvl = Math.max(1, Number(level) || 1);
  if (lvl > 80) return 'Guru';
  if (lvl > 50) return 'Master';
  if (lvl > 40) return 'Artisan';
  if (lvl > 30) return 'Professional';
  if (lvl > 20) return 'Skilled';
  if (lvl > 10) return 'Apprentice';
  return 'Beginner';
}

const ITEM_BONUS_LABELS = [
  ['max_hp_bonus', 'Max HP'], ['proficiency_bonus', 'Proficiency'], ['strength_bonus', 'STR'], ['dexterity_bonus', 'DEX'],
  ['intelligent_bonus', 'INT'], ['constitution_bonus', 'CON'], ['wisdom_bonus', 'WIS'], ['charisma_bonus', 'CHA'],
  ['physical_attack_bonus', 'Physical ATK'], ['magical_attack_bonus', 'Magical ATK'], ['armor_bonus', 'Armor'], ['magical_armor_bonus', 'Magic Armor'],
  ['effect_resistant_bonus', 'Status Resist'], ['fire_element_resistant', 'Fire Resist'], ['ice_element_resistant', 'Ice Resist'],
  ['earth_element_resistant', 'Earth Resist'], ['lightning_element_resistant', 'Lightning Resist'], ['wind_element_resistant', 'Wind Resist'],
  ['holy_element_resistant', 'Holy Resist'], ['dark_element_resistant', 'Dark Resist'], ['crit_chance_bonus', 'Crit Chance'], ['crit_damage_bonus', 'Crit Damage']
];

function describeItemStatBonus(bonus = {}) {
  return ITEM_BONUS_LABELS
    .map(([field, label]) => [label, Number(bonus?.[field] || 0)])
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${value > 0 ? '+' : ''}${value} ${label}`)
    .join(', ');
}

function formatBonusTimeLeft(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return '<1m left';
}

function renderItemBonuses(character) {
  const list = document.querySelector('#itemBonusList');
  const title = document.querySelector('#itemBonusTitle');
  if (!list) return;
  const bonuses = character.active_item_bonuses || [];
  list.replaceChildren();
  list.hidden = bonuses.length === 0;
  if (title) title.hidden = bonuses.length === 0;
  bonuses.forEach((bonus) => {
    const summary = (bonus.bonuses || []).map(({ label, value }) => `${value > 0 ? '+' : ''}${value} ${label}`).join(', ');
    const row = document.createElement('div');
    row.title = `${bonus.name}: ${summary}`;
    const name = document.createElement('span');
    name.textContent = bonus.name;
    const details = document.createElement('b');
    details.textContent = bonus.is_permanent ? 'Permanent' : formatBonusTimeLeft(bonus.remaining_seconds);
    const effect = document.createElement('small');
    effect.textContent = summary;
    details.append(' ', effect);
    row.append(name, details);
    list.append(row);
  });
}

function renderLifeSkills(character) {
  const skillList = document.querySelector('.lifeskill-list');
  if (!skillList) return;
  skillList.replaceChildren();
  (character.character_lifeskills || []).forEach(({ lifeskill, current_level, current_exp, bdo_rank, bdo_mastery, free_energy_chance_pct, rare_chance_pct, bonus_yield_chance_pct }) => {
    const level = Math.max(1, numericValue(current_level, 1));
    const currentExp = Math.max(0, numericValue(current_exp));
    const nextLevelExp = lifeSkillExperienceForLevel(level);
    const rank = bdo_rank || getBdoRankTitle(level);
    const mastery = bdo_mastery ?? (level * 10);
    const freeEnergy = free_energy_chance_pct ?? Math.min(35, Math.round(Math.floor(level / 5) * 3.5 * 10) / 10);
    const rareChance = rare_chance_pct ?? Math.min(45, Math.round((5 + (level - 1) * 1.0) * 10) / 10);
    const bonusYield = bonus_yield_chance_pct ?? Math.min(50, Math.round((level - 1) * 1.2 * 10) / 10);

    const row = document.createElement('div');
    row.title = `${lifeskill?.name || 'Life Skill'} · ${rank} Lv. ${level}\nMastery: ${mastery}\n⚡ Free Energy Chance: ${freeEnergy}%\n★ Rare Proc Chance: ${rareChance}%\n✦ Bonus Yield Chance: ${bonusYield}%`;
    const name = document.createElement('span');
    name.textContent = lifeskill?.name || 'Unknown';
    const details = document.createElement('b');
    details.textContent = `${rank} Lv. ${level}`;
    const exp = document.createElement('small');
    exp.textContent = `${currentExp.toLocaleString()} XP`;
    const meter = document.createElement('span');
    meter.className = 'lifeskill-bar';
    meter.setAttribute('aria-label', `${currentExp} of ${nextLevelExp} life skill XP`);
    const fill = document.createElement('i');
    fill.style.width = `${percentage(currentExp, nextLevelExp)}%`;
    meter.append(fill);
    details.append(exp, meter);
    row.append(name, details);
    skillList.append(row);
  });
}

function renderStory(character, feed, npcs = []) {
  feed.replaceChildren();
  if (character.story?.story) appendNarration(feed, character.story.story, { character, npcs });
}


let selectedWorldDestinationId = null;
let worldMapTooltipLocationId = null;

function buildWorldAreaTooltip(location, onClose) {
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const area = location.area || { monster_count: 0, average_level: null, monsters: [], sublocations: [] };
  const tooltip = el('div', 'world-area-tooltip');
  tooltip.dataset.mapX = location.map_x;
  tooltip.dataset.mapY = location.map_y;
  tooltip.setAttribute('role', 'dialog');
  tooltip.setAttribute('aria-label', `${location.name} area info`);
  const header = el('div', 'world-area-tooltip-header');
  header.append(el('strong', 'world-area-tooltip-title', location.name));
  const close = el('button', 'world-area-tooltip-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close area info');
  close.addEventListener('click', (event) => { event.stopPropagation(); onClose(); });
  header.append(close);
  tooltip.append(header);
  tooltip.append(el('p', 'world-area-tooltip-level', area.average_level ? `Avg. monster level: ${area.average_level}` : 'Avg. monster level: —'));
  const monsterLine = (monster) => `${monster.name} (Lv ${monster.level})`;
  if (!area.monster_count) {
    tooltip.append(el('p', 'world-area-tooltip-empty', 'No monsters reported in this area.'));
    return tooltip;
  }
  if (area.monsters.length) {
    tooltip.append(el('p', 'world-area-tooltip-heading', 'In the area'));
    const list = el('ul', 'world-area-tooltip-list');
    area.monsters.forEach((monster) => list.append(el('li', '', monsterLine(monster))));
    tooltip.append(list);
  }
  area.sublocations.forEach((sublocation) => {
    tooltip.append(el('p', 'world-area-tooltip-heading', sublocation.name));
    const list = el('ul', 'world-area-tooltip-list');
    sublocation.monsters.forEach((monster) => list.append(el('li', '', monsterLine(monster))));
    tooltip.append(list);
  });
  return tooltip;
}
const worldTravelMapViewState = { scale: 1, x: 0, y: 0, drag: null };

function applyWorldTravelMapView() {
  const stage = document.querySelector('#worldTravelMap');
  const content = document.querySelector('#worldTravelTransform');
  if (!stage || !content) return;
  const view = worldTravelMapViewState;
  const image = content.querySelector('img');
  if (image && !image.complete && image.dataset.mapLoadBound !== 'true') {
    image.dataset.mapLoadBound = 'true';
    image.addEventListener('load', applyWorldTravelMapView, { once: true });
  }
  if (image?.naturalWidth && image?.naturalHeight) {
    stage.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  }
  view.scale = Math.max(1, Math.min(4, view.scale));
  content.style.width = `${view.scale * 100}%`;
  view.x = Math.max(Math.min(0, stage.clientWidth - content.offsetWidth), Math.min(0, view.x));
  view.y = Math.max(Math.min(0, stage.clientHeight - content.offsetHeight), Math.min(0, view.y));
  if (view.scale === 1) {
    view.x = 0;
    view.y = 0;
  }
  stage.classList.toggle('is-zoomed', view.scale > 1);
  content.style.transform = `translate(${view.x}px, ${view.y}px)`;
  const pins = document.querySelector('#worldTravelPins');
  if (pins) {
    for (const pin of pins.children) {
      pin.style.left = `${view.x + content.offsetWidth * Number(pin.dataset.mapX) / 100}px`;
      pin.style.top = `${view.y + content.offsetHeight * Number(pin.dataset.mapY) / 100}px`;
    }
  }
  setText('#worldTravelZoomLevel', `${Math.round(view.scale * 100)}%`);
  const zoomOut = document.querySelector('#worldTravelZoomOut');
  const zoomIn = document.querySelector('#worldTravelZoomIn');
  const reset = document.querySelector('#worldTravelZoomReset');
  if (zoomOut) zoomOut.disabled = view.scale <= 1;
  if (zoomIn) zoomIn.disabled = view.scale >= 4;
  if (reset) reset.disabled = view.scale === 1 && view.x === 0 && view.y === 0;
}

function setWorldTravelMapZoom(nextScale, clientX, clientY) {
  const stage = document.querySelector('#worldTravelMap');
  if (!stage) return;
  const bounds = stage.getBoundingClientRect();
  const pointX = clientX - bounds.left - stage.clientLeft;
  const pointY = clientY - bounds.top - stage.clientTop;
  const view = worldTravelMapViewState;
  const mapX = (pointX - view.x) / view.scale;
  const mapY = (pointY - view.y) / view.scale;
  view.scale = Math.max(1, Math.min(4, nextScale));
  view.x = pointX - mapX * view.scale;
  view.y = pointY - mapY * view.scale;
  applyWorldTravelMapView();
}

function setupWorldTravelMapView() {
  const stage = document.querySelector('#worldTravelMap');
  if (!stage) return;
  if (stage.dataset.resizeBound !== 'true') {
    stage.dataset.resizeBound = 'true';
    window.addEventListener('resize', applyWorldTravelMapView);
  }
  const zoomAtCenter = (factor) => {
    const bounds = stage.getBoundingClientRect();
    setWorldTravelMapZoom(worldTravelMapViewState.scale * factor, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  };
  document.querySelector('#worldTravelZoomIn').onclick = () => zoomAtCenter(1.25);
  document.querySelector('#worldTravelZoomOut').onclick = () => zoomAtCenter(0.8);
  document.querySelector('#worldTravelZoomReset').onclick = () => {
    worldTravelMapViewState.scale = 1;
    worldTravelMapViewState.x = 0;
    worldTravelMapViewState.y = 0;
    applyWorldTravelMapView();
  };
  stage.onwheel = (event) => {
    event.preventDefault();
    setWorldTravelMapZoom(worldTravelMapViewState.scale * (event.deltaY < 0 ? 1.12 : 0.89), event.clientX, event.clientY);
  };
  stage.ondragstart = (event) => event.preventDefault();
  stage.onpointerdown = (event) => {
    if (event.button !== 0 || event.target.closest('.world-travel-pin') || event.target.closest('.world-area-tooltip')) return;
    worldTravelMapViewState.drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: worldTravelMapViewState.x, y: worldTravelMapViewState.y };
    stage.classList.add('is-panning');
    stage.setPointerCapture(event.pointerId);
  };
  stage.onpointermove = (event) => {
    const drag = worldTravelMapViewState.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    worldTravelMapViewState.x = drag.x + event.clientX - drag.clientX;
    worldTravelMapViewState.y = drag.y + event.clientY - drag.clientY;
    applyWorldTravelMapView();
  };
  const finishPan = (event) => {
    if (worldTravelMapViewState.drag?.pointerId !== event.pointerId) return;
    worldTravelMapViewState.drag = null;
    stage.classList.remove('is-panning');
  };
  stage.onpointerup = finishPan;
  stage.onpointercancel = finishPan;
  applyWorldTravelMapView();
}

function renderWorldTravelPanel(character, travelMap, onTravel) {
  const container = document.querySelector('#worldTravelMap');
  const pins = document.querySelector('#worldTravelPins');
  const lines = document.querySelector('#worldTravelRouteLines');
  const destinationButton = document.querySelector('#worldTravelButton');
  const summary = document.querySelector('#worldTravelRouteSummary');
  if (!container || !pins || !lines || !destinationButton || !summary) return;
  const destinations = travelMap?.destinations || [];
  const destinationsById = new Map(destinations.map((destination) => [destination.location_id, destination]));
  const locations = travelMap?.locations || [];
  const current = locations.find((location) => location.id === travelMap?.current_location_id);
  const selected = destinationsById.get(selectedWorldDestinationId);
  if (!selected) selectedWorldDestinationId = null;
  const activeDestination = selected ? destinationsById.get(selectedWorldDestinationId) : null;
  const resources = travelMap?.resources;
  setupWorldTravelMapView();
  setText('#worldTravelResources', resources ? `Your supplies — Energy ${resources.energy} · Food ${resources.food} · Water ${resources.water}` : 'Resources unavailable');
  pins.replaceChildren();
  lines.replaceChildren();
  const svgNamespace = 'http://www.w3.org/2000/svg';
  for (const route of travelMap?.routes || []) {
    const from = locations.find((location) => location.id === route.location_a_id);
    const to = locations.find((location) => location.id === route.location_b_id);
    if (!from || !to) continue;
    const line = document.createElementNS(svgNamespace, 'line');
    line.setAttribute('x1', from.map_x);
    line.setAttribute('y1', from.map_y);
    line.setAttribute('x2', to.map_x);
    line.setAttribute('y2', to.map_y);
    lines.append(line);
  }
  for (const location of locations) {
    const isCurrent = location.id === travelMap?.current_location_id;
    const destination = destinationsById.get(location.id);
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = `world-travel-pin${isCurrent ? ' is-current' : ''}${location.id === selectedWorldDestinationId ? ' is-selected' : ''}`;
    pin.dataset.mapX = location.map_x;
    pin.dataset.mapY = location.map_y;
    const label = document.createElement('span');
    label.className = 'world-travel-pin-label';
    label.textContent = location.name;
    pin.append(label);
    pin.title = isCurrent ? `${location.name} · Current location` : destination ? `${location.name} · Select destination` : `${location.name} · No connected route`;
    pin.setAttribute('aria-label', pin.title);
    if (!isCurrent && !destination) pin.classList.add('is-unreachable');
    if (isCurrent || !destination) pin.setAttribute('aria-disabled', 'true');
    pin.addEventListener('click', () => {
      if (destination) selectedWorldDestinationId = location.id;
      worldMapTooltipLocationId = worldMapTooltipLocationId === location.id && !destination ? null : location.id;
      renderWorldTravelPanel(character, travelMap, onTravel);
    });
    pins.append(pin);
  }
  const tooltipLocation = locations.find((location) => location.id === worldMapTooltipLocationId);
  if (tooltipLocation) {
    pins.append(buildWorldAreaTooltip(tooltipLocation, () => {
      worldMapTooltipLocationId = null;
      renderWorldTravelPanel(character, travelMap, onTravel);
    }));
  } else {
    worldMapTooltipLocationId = null;
  }
  applyWorldTravelMapView();
  if (!travelMap) {
    summary.textContent = 'Loading connected locations…';
  } else if (!current) {
    summary.textContent = 'Your current location has not been pinned on the world map yet.';
  } else if (!activeDestination) {
    summary.textContent = `Current location: ${current.name}. Select a reachable pin to preview the connected route.`;
  } else {
    renderTravelCostSummary(summary, activeDestination, resources);
  }
  destinationButton.disabled = !activeDestination;
  destinationButton.textContent = activeDestination ? `Travel to ${activeDestination.location_name}` : 'Travel';
  destinationButton.onclick = () => activeDestination && onTravel?.(activeDestination.location_id);
}

function renderTravelCostSummary(summary, destination, resources) {
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const path = destination.path || [];
  const stops = Math.max(0, path.length - 1);
  const route = el('p', 'travel-cost-route');
  route.append(el('b', '', path.join(' → ')));
  if (stops > 1) route.append(el('span', 'muted', ` (${stops} legs)`));
  const heading = el('p', 'travel-cost-heading', `This journey will use:`);
  const list = el('ul', 'travel-cost-list');
  let short = false;
  [['energy', 'Energy', '⚡'], ['food', 'Food', '🍖'], ['water', 'Water', '💧']].forEach(([key, name, icon]) => {
    const cost = Number(destination.costs?.[`${key}_cost`] || 0);
    const have = resources ? Number(resources[key] || 0) : null;
    const item = el('li', 'travel-cost-item');
    item.append(el('span', 'travel-cost-icon', icon), el('span', 'travel-cost-name', name), el('b', 'travel-cost-amount', `−${cost}`));
    if (have !== null) {
      const after = have - cost;
      const enough = after >= 0;
      if (!enough) short = true;
      item.classList.toggle('is-short', !enough);
      item.append(el('span', 'travel-cost-after', enough ? `${have} → ${after} left` : `you have ${have}, need ${cost - have} more`));
    }
    list.append(item);
  });
  const parts = [route, heading, list];
  if (short) parts.push(el('p', 'travel-cost-warning', 'You do not have enough supplies for this journey. Rest, eat or drink before travelling.'));
  summary.replaceChildren(...parts);
}

function renderMoveModal(character, { onEnter, onExit, travelMap = null, onTravel, mode = 'sublocation' }) {
  const currentSublocation = character.sublocation && !character.sublocation.deleted ? character.sublocation : null;
  const sublocations = character.location?.sublocations || [];
  const isWorldTravel = mode === 'world';
  document.querySelector('#moveModal')?.classList.toggle('is-world-travel', isWorldTravel);
  setText('#moveModalEyebrow', isWorldTravel ? 'WORLD TRAVEL' : 'LOCAL MOVEMENT');
  setText('#moveTitle', isWorldTravel ? 'Travel between locations' : 'Move within this location');
  setText('#moveCurrentLocationDesc', isWorldTravel ? 'Choose a connected location on the world map.' : character.location?.description || 'Choose an area to explore or enter.');
  if (isWorldTravel) renderWorldTravelPanel(character, travelMap, onTravel);

  const statusContainer = document.querySelector('#moveCurrentStatus');
  if (statusContainer) {
    if (currentSublocation) {
      statusContainer.innerHTML = `
        <span>Currently inside: <b>${currentSublocation.name}</b> (${currentSublocation.sublocation_type})</span>
        <button type="button" id="btnExitSublocation">Exit to ${character.location?.name || 'Main Area'}</button>
      `;
      document.querySelector('#btnExitSublocation')?.addEventListener('click', onExit);
    } else {
      statusContainer.innerHTML = `
        <span>Currently in: <b>${character.location?.name || 'Open Area'}</b> (Main Location)</span>
      `;
    }
  }

  const listContainer = document.querySelector('#moveSublocationsList');
  if (listContainer) {
    listContainer.innerHTML = '';
    if (!sublocations.length) {
      listContainer.innerHTML = '<div class="move-empty">No sublocations discovered in this area yet.</div>';
      return;
    }
    sublocations.forEach((sub) => {
      const isHere = currentSublocation && currentSublocation.id === sub.id;
      const card = document.createElement('div');
      card.className = `sublocation-card${isHere ? ' is-current' : ''}`;
      const badgeClass = sub.sublocation_type === SUBLOCATION_TYPE.INN ? 'type-inn' : sub.sublocation_type === SUBLOCATION_TYPE.SHOP ? 'type-shop' : sub.sublocation_type === SUBLOCATION_TYPE.GUILD_OFFICE ? 'type-guild' : '';
      card.innerHTML = `
        <div class="sublocation-card-head">
          <h4 class="sublocation-card-title">${sub.name}</h4>
          <span class="sublocation-badge ${badgeClass}">${sub.sublocation_type}</span>
        </div>
        <p>${sub.description || 'No description available.'}</p>
        <button type="button" ${isHere ? 'disabled' : ''}>${isHere ? 'Currently Here' : 'Enter'}</button>
      `;
      if (!isHere) {
        card.querySelector('button').addEventListener('click', () => onEnter(sub.id));
      }
      listContainer.append(card);
    });
  }
}

function renderShopModal(shopData, playerGold, { onBuy, onSell, character, mode = 'buy' }) {
  const selling = mode === 'sell';
  document.querySelector('#shopBuyMode')?.setAttribute('aria-pressed', String(!selling));
  document.querySelector('#shopSellMode')?.setAttribute('aria-pressed', String(selling));
  const isInn = shopData.sublocation_type === SUBLOCATION_TYPE.INN;
  setText('#shopEyebrow', isInn ? 'INN & TAVERN' : 'MERCHANT COMMERCE');
  setText('#shopTitle', shopData.name || (isInn ? 'The Inn' : 'The Shop'));
  setText('#shopSubtitle', shopData.hostile ? `${shopData.owner_name || 'The shopkeeper'} is hostile toward you and refuses service.` : isInn ? 'Rest, replenish provisions, or acquire supplies.' : 'Browse fine wares and equipment for your journey.');
  setText('#shopPlayerGold', `◈ ${(playerGold || 0).toLocaleString()}`);
  const sellModeButton = document.querySelector('#shopSellMode');
  if (sellModeButton) sellModeButton.disabled = Boolean(shopData.hostile);

  const grid = document.querySelector('#shopItemsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (shopData.hostile) {
    grid.innerHTML = '<div class="shop-empty">The shopkeeper refuses to serve you.</div>';
    return;
  }
  if (selling) {
    setText('#shopSubtitle', 'Sell backpack items for 70% of their base price, rounded down per item.');
    const entries = (character?.character_inventory?.item_inventory || []).filter(entry => !entry.deleted && entry.item && !entry.item.deleted && (entry.quantity ?? 1) > 0);
    if (!entries.length) grid.innerHTML = '<div class="shop-empty">Your backpack has no items to sell.</div>';
    entries.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'shop-item-card';
      const title = document.createElement('h4');
      title.className = 'shop-item-name';
      title.textContent = [entry.prefix?.name, entry.item.name, entry.suffix?.name].filter(Boolean).join(' ') + (entry.current_level_upgraded ? ' +' + entry.current_level_upgraded : '');
      const details = document.createElement('p');
      details.className = 'shop-item-desc';
      details.textContent = 'Owned: ×' + (entry.quantity ?? 1) + ' · Sell price: ◈ ' + Math.floor((entry.item.price ?? 0) * 7 / 10).toLocaleString() + ' each';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-item-buy-btn';
      button.disabled = Boolean(entry.equipped || entry.is_equipped);
      button.textContent = button.disabled ? 'Equipped' : 'Sell';
      button.addEventListener('click', () => onSell(entry, title.textContent));
      card.append(title, details, button);
      grid.append(card);
    });
    return;
  }
  const items = shopData.items || [];
  if (!items.length) {
    grid.innerHTML = '<div class="shop-empty">The merchant has no items for sale at this moment.</div>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    const price = Number(item.price || 0);
    const canAfford = playerGold >= price;
    card.innerHTML = `
      <div>
        <h4 class="shop-item-name">${item.name}</h4>
        <div class="shop-item-type">${item.type}${item.weapon_type ? ` · ${item.weapon_type}` : ''} · ${item.rarity || 'NORMAL'}</div>
      </div>
      <p class="shop-item-desc">${item.description || 'A valuable commodity.'}</p>
      <div class="shop-item-footer">
        <span class="shop-item-price">◈ ${price.toLocaleString()}</span>
        <button type="button" class="shop-item-buy-btn" ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Buy this item' : 'Not enough gold'}">
          ${canAfford ? 'Buy' : 'Need Gold'}
        </button>
      </div>
    `;
    if (canAfford) {
      card.querySelector('.shop-item-buy-btn').addEventListener('click', () => onBuy(item));
    }
    grid.append(card);
  });
}

const INVENTORY_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'weapon', label: 'Weapons', match: (item) => [ITEM_TYPE.MAIN_HAND, ITEM_TYPE.TWO_HAND, ITEM_TYPE.SUB_HAND].includes(item?.type) },
  { key: 'armor', label: 'Armor', match: (item) => [ITEM_TYPE.HELMET, ITEM_TYPE.ARMOR, ITEM_TYPE.SHOES, ITEM_TYPE.GLOVES, ITEM_TYPE.BELT].includes(item?.type) },
  { key: 'accessory', label: 'Accessories', match: (item) => [ITEM_TYPE.EARRING, ITEM_TYPE.RING, ITEM_TYPE.NECKLACE].includes(item?.type) },
  { key: 'consumable', label: 'Consumables', match: (item) => Boolean(item?.is_consumable) || [ITEM_TYPE.FOOD, ITEM_TYPE.POTION].includes(item?.type) },
  { key: 'material', label: 'Materials', match: (item) => Boolean(item?.is_material) || item?.type === ITEM_TYPE.FISH },
  { key: 'scroll', label: 'Skill Scrolls', match: (item) => item?.type === ITEM_TYPE.SKILL_SCROLL },
  { key: 'quest', label: 'Quest', match: (item) => item?.type === ITEM_TYPE.QUEST_ITEMS },
  { key: 'misc', label: 'Misc', match: (item) => item?.type === ITEM_TYPE.MISCS && !item?.is_consumable && !item?.is_material }
];
const INVENTORY_RARITY_ORDER = ['ANCIENT', 'LEGENDARY', 'MYSTIC', 'UNIQUE', 'RARE', 'UNCOMMON', 'NORMAL'];
const inventoryViewState = { search: '', category: 'all', sort: 'default' };
let lastInventoryRender = null;

function inventoryDisplayName(entry) {
  return [entry.prefix?.name, entry.item?.name || 'Unknown item', entry.suffix?.name].filter(Boolean).join(' ') + (entry.current_level_upgraded ? ` +${entry.current_level_upgraded}` : '');
}

function sortInventoryEntries(entries, sort) {
  const list = [...entries];
  const byName = (a, b) => inventoryDisplayName(a).localeCompare(inventoryDisplayName(b));
  if (sort === 'name') return list.sort(byName);
  if (sort === 'rarity') return list.sort((a, b) => {
    const rank = (entry) => { const index = INVENTORY_RARITY_ORDER.indexOf(entry.item?.rarity); return index === -1 ? INVENTORY_RARITY_ORDER.length : index; };
    return rank(a) - rank(b) || byName(a, b);
  });
  if (sort === 'type') return list.sort((a, b) => String(a.item?.type || '').localeCompare(String(b.item?.type || '')) || byName(a, b));
  if (sort === 'quantity') return list.sort((a, b) => (Number(b.quantity) || 1) - (Number(a.quantity) || 1) || byName(a, b));
  if (sort === 'newest') return list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  return list;
}

function setupInventoryControls() {
  const search = document.querySelector('#inventorySearch');
  const sort = document.querySelector('#inventorySort');
  const rerender = () => lastInventoryRender && renderInventoryPanel(lastInventoryRender.character, lastInventoryRender.options);
  if (search && !search.dataset.bound) {
    search.dataset.bound = 'true';
    search.addEventListener('input', () => { inventoryViewState.search = search.value; rerender(); });
  }
  if (sort && !sort.dataset.bound) {
    sort.dataset.bound = 'true';
    sort.addEventListener('change', () => { inventoryViewState.sort = sort.value; rerender(); });
  }
  if (search && search.value !== inventoryViewState.search) search.value = inventoryViewState.search;
  if (sort && sort.value !== inventoryViewState.sort) sort.value = inventoryViewState.sort;
}

function renderInventoryPanel(character, options = {}) {
  lastInventoryRender = { character, options };
  const inventoryGrid = document.querySelector('.inventory-grid');
  if (!inventoryGrid) return;
  setupInventoryControls();
  inventoryGrid.innerHTML = '';
  const items = (character.character_items || []).filter((entry) => !entry.deleted && entry.location === ITEM_LOCATION.BACKPACK).map((entry) => ({ ...entry, item: entry.item || entry.items, equipped: false }));
  const slots = character.character_inventory?.max_slots || 40;
  setText('.inventory-heading h3 span', `${items.length} / ${slots} slots`);

  const categoryList = document.querySelector('#inventoryCategories');
  if (categoryList) {
    categoryList.replaceChildren();
    INVENTORY_CATEGORIES.forEach((category) => {
      const count = category.match ? items.filter((entry) => category.match(entry.item)).length : items.length;
      if (category.key !== 'all' && !count && inventoryViewState.category !== category.key) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `inventory-category${inventoryViewState.category === category.key ? ' is-active' : ''}`;
      chip.setAttribute('aria-pressed', String(inventoryViewState.category === category.key));
      chip.textContent = `${category.label} ${count}`;
      chip.addEventListener('click', () => {
        inventoryViewState.category = category.key;
        renderInventoryPanel(character, options);
      });
      categoryList.append(chip);
    });
  }

  const activeCategory = INVENTORY_CATEGORIES.find((category) => category.key === inventoryViewState.category) || INVENTORY_CATEGORIES[0];
  const query = inventoryViewState.search.trim().toLowerCase();
  const filtered = items.filter((entry) => {
    if (activeCategory.match && !activeCategory.match(entry.item)) return false;
    if (!query) return true;
    return [inventoryDisplayName(entry), entry.item?.type, entry.item?.rarity, entry.item?.description].filter(Boolean).join(' ').toLowerCase().includes(query);
  });
  const visible = sortInventoryEntries(filtered, inventoryViewState.sort);
  const isFiltered = Boolean(query) || activeCategory.key !== 'all';
  const note = document.querySelector('#inventoryResultNote');
  if (note) {
    note.textContent = isFiltered ? (visible.length ? `Showing ${visible.length} of ${items.length} items` : 'No items match this filter.') : '';
    note.hidden = !isFiltered;
  }

    visible.forEach((entry) => {
      const { item, quantity, equipped } = entry;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `inventory-item${equipped ? ' is-equipped' : ''}`;
      button.title = item ? `${item.name || 'Unknown item'}${item.description ? ` — ${item.description}` : ''}` : 'Unknown item';
      const effect = item?.item_bonus || {};
      const statsText = Object.entries(effect).filter(([key, value]) => key.endsWith('_bonus') && value).map(([key, value]) => `${key.replace('_bonus', '').replaceAll('_', ' ')}: ${value > 0 ? '+' : ''}${value}`).join(' · ');
      button.innerHTML = `<b>${equipped ? '<i class="equipped-dot" aria-label="Equipped"></i>' : ''}${item?.name || 'Unknown item'}</b><small>${item?.type || ''} · ×${quantity || 1}</small><span class="inventory-tooltip" role="tooltip"><strong>${item?.name || 'Unknown item'}</strong><span>${item?.description || 'No description.'}</span>${statsText ? `<span>${statsText}</span>` : ''}</span>`;
      if (typeof options.onItemClick === 'function') {
        button.addEventListener('click', () => options.onItemClick(entry));
      }
      inventoryGrid.append(button);
      attachInventoryTooltip(button);
    });
  if (!isFiltered) {
    for (let index = items.length; index < slots; index += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'inventory-slot empty-slot';
      slot.setAttribute('aria-label', 'Empty inventory slot');
      inventoryGrid.append(slot);
    }
  }
}

function renderCharacter(character, options = {}) {
  const stats = character.character_stat || {};
  const equipment = character.character_equipment || {};
  setText('.character-summary .eyebrow', `Level ${character.level || 1} ${character.job || 'Adventurer'}`);
  setText('.character-summary h2', character.name || 'Unnamed character');
  setText('.character-summary .muted', `${character.race || 'Unknown'} · ${character.alignment || 'Unaligned'}`);
  const avatar = document.querySelector('.character-summary .avatar');
  if (avatar) {
    const uploadInput = avatar.querySelector('input[type="file"]');
    avatar.textContent = character.image_data ? '' : initials(character.name);
    if (uploadInput) avatar.append(uploadInput);
    avatar.style.backgroundImage = character.image_data ? `url("${character.image_data}")` : '';
    avatar.style.backgroundSize = character.image_data ? 'cover' : '';
    avatar.style.backgroundPosition = character.image_data ? 'center' : '';
    avatar.title = 'Click to upload your avatar';
    avatar.setAttribute('role', 'button');
    avatar.tabIndex = 0;
    if (!avatar.dataset.avatarUploadBound) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/png,image/jpeg,image/gif,image/webp'; input.hidden = true;
      input.addEventListener('click', (event) => event.stopPropagation());
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const imageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Unable to read that image.'));
            reader.readAsDataURL(file);
          });
          const result = await updateCharacterAvatar(character.id, imageData);
          character.image_data = result.image_data;
          renderCharacter(character, options);
          if (typeof options.onAvatarUpdated === 'function') {
            options.onAvatarUpdated();
          }
        } catch (error) { notify(error.message); }
        input.value = '';
      });
      avatar.append(input);
      avatar.addEventListener('click', (event) => { if (event.target === avatar) input.click(); });
      avatar.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
      avatar.dataset.avatarUploadBound = 'true';
    }
  }
  setText('.sidebar-bottom span', `◈ ${(character.player?.gold || 0).toLocaleString()}`);
  syncWorldWeatherLocation(character.location_id);
  const vitals = document.querySelectorAll('.vitals label b');
  const vitalBars = document.querySelectorAll('.vitals .meter i');
  [[stats.current_hp, stats.max_hp], [stats.current_energy, stats.max_energy], [stats.current_food, stats.max_food], [stats.current_water, stats.max_water]].forEach(([current, max], index) => {
    if (vitals[index]) vitals[index].textContent = (current ?? 0) + ' / ' + (max ?? 0);
    if (vitalBars[index]) vitalBars[index].style.width = percentage(current, max) + '%';
  });
  const foodLabel = document.querySelector('.vitals > div:nth-child(3) label span');
  if (foodLabel) foodLabel.textContent = character.hunger ? 'FOOD · ' + character.hunger.name : 'FOOD';
  const foodSheetLabel = document.querySelector('.sheet-resources > div:nth-child(4) > span');
  if (foodSheetLabel) foodSheetLabel.textContent = character.hunger ? 'FOOD · ' + character.hunger.name : 'FOOD';
  const waterLabel = document.querySelector('.vitals > div:nth-child(4) label span');
  if (waterLabel) waterLabel.textContent = character.thirst ? 'WATER · ' + character.thirst.name.replaceAll('_', ' ') : 'WATER';
  const waterSheetLabel = document.querySelector('.sheet-resources > div:nth-child(5) > span');
  if (waterSheetLabel) waterSheetLabel.textContent = character.thirst ? 'WATER · ' + character.thirst.name.replaceAll('_', ' ') : 'WATER';
  const sheetTitle = document.querySelector('#characterSheetTitle'); if (sheetTitle) { const title = sheetTitle.querySelector('span'); sheetTitle.firstChild.textContent = character.name || 'Unnamed character'; if (title) title.textContent = `Level ${character.level || 1} ${character.job || 'Adventurer'}`; }
  const portrait = document.querySelector('.sheet-portrait p'); if (portrait) portrait.innerHTML = `${character.race || 'Unknown'}<br><small>${character.alignment || 'Unaligned'}</small>`;
  setText('.sheet-portrait > span', initials(character.name));

  const currentSublocation = character.sublocation && !character.sublocation.deleted ? character.sublocation : null;
  const locationName = currentSublocation ? `${character.location?.name || 'Unknown'} · ${currentSublocation.name}` : (character.location?.name || 'Unknown location');
  const locationDesc = currentSublocation ? (currentSublocation.description || character.location?.description || 'Your current location is not described.') : (character.location?.description || 'Your current location is not described.');

  setText('#sceneRegion', character.location?.region?.name || '');
  setText('.scene-header h1', locationName);
  setText('.scene-header p:not(.eyebrow)', locationDesc);
  setText('#sceneLocationTitle', locationName);
  setText('#sceneLocationDesc', locationDesc);
  const vaultButton = document.querySelector('#vaultButton');
  if (vaultButton) vaultButton.hidden = !character.location?.is_safe_zone;
  const farmingButton = document.querySelector('#farmingButton');
  if (farmingButton) farmingButton.hidden = !character.location?.is_safe_zone;
  const campfireButton = document.querySelector('#campfireButton');
  if (campfireButton) campfireButton.hidden = !character.location || Boolean(character.location.is_safe_zone);
  const trainingButton = document.querySelector('#trainingButton');
  if (trainingButton) trainingButton.hidden = !character.location?.is_safe_zone;

  const shopTabButton = document.querySelector('#shopTabButton');
  const shopTabTitle = document.querySelector('#shopTabTitle');
  if (shopTabButton) {
    if (currentSublocation && TRADING_SUBLOCATION_TYPES.includes(currentSublocation.sublocation_type)) {
      shopTabButton.hidden = false;
      const isInn = currentSublocation.sublocation_type === SUBLOCATION_TYPE.INN;
      if (shopTabTitle) shopTabTitle.textContent = isInn ? 'Inn' : 'Shop';
      const iconSpan = shopTabButton.querySelector('span:first-child');
      if (iconSpan) iconSpan.textContent = isInn ? '🍺' : '🛍';
    } else {
      shopTabButton.hidden = true;
    }
  }
  const resources = document.querySelectorAll('.sheet-resources > div');
  const experience = Math.max(0, numericValue(character.current_exp));
  const experienceTarget = nextExperienceTarget(character.level);
  [[stats.current_hp, stats.max_hp], [stats.current_energy, stats.max_energy], [character.level >= MAX_LEVEL ? experienceTarget : Math.max(0, experience - experienceForLevel(character.level)), character.level >= MAX_LEVEL ? experienceTarget : experienceTarget - experienceForLevel(character.level)], [stats.current_food, stats.max_food], [stats.current_water, stats.max_water]].forEach(([current, max], index) => { if (!resources[index]) return; const currentValue = Math.max(0, numericValue(current)); const maxValue = Math.max(0, numericValue(max)); resources[index].querySelector('b').textContent = index === 2 && character.level >= MAX_LEVEL ? 'MAX' : `${currentValue.toLocaleString()} / ${maxValue.toLocaleString()}`; const bar = resources[index].querySelector('i'); if (bar) bar.style.width = `${index === 2 && character.level >= MAX_LEVEL ? 100 : percentage(currentValue, maxValue)}%`; });
  setText('[data-sheet-summary="attack"] b', Math.round(stats.atkDamage ?? stats.physicalPower ?? 0));
  setText('[data-sheet-summary="magic-attack"] b', Math.round(stats.magicAtkDamage ?? stats.magicPower ?? 0));
  setText('[data-sheet-summary="armor"] b', stats.armor ?? 0);
  setText('[data-sheet-summary="magic-armor"] b', stats.magicArmor ?? 0);
  setText('[data-sheet-summary="crit-chance"] b', `${stats.critChance ?? 0}%`);
  setText('[data-sheet-summary="crit-damage"] b', `${stats.critDamage ?? 0}%`);
  setText('[data-sheet-summary="accuracy"] b', `${Math.round(stats.accuracy ?? 1)}%`);
  setText('[data-sheet-summary="evade-chance"] b', `${Math.round(stats.evadeChance ?? 10)}%`);
  setText('[data-sheet-summary="gold"] b', numericValue(character.player?.gold).toLocaleString());
  const pointsLeft = numericValue(character.player?.current_point_spend ?? character.current_point_spend);
  setText('.point-spend-box b', pointsLeft.toLocaleString());
  const upgradeHint = document.querySelector('.attributes-title small');
  if (upgradeHint) upgradeHint.hidden = pointsLeft <= 0;
  const statFields = ['intelligent', 'strength', 'dexterity', 'charisma', 'constitution', 'wisdom']; document.querySelectorAll('.stat-grid b').forEach((element, index) => { element.textContent = stats[statFields[index]] ?? 0; });
  document.querySelectorAll('.stat-grid [data-stat]').forEach((button) => {
    button.disabled = pointsLeft <= 0;
    attachStatTooltip(button, button.dataset.stat);
  });
  const resistanceFields = [['fireResist', 'Fire'], ['iceResist', 'Ice'], ['earthResist', 'Earth'], ['lightningResist', 'Lightning'], ['windResist', 'Wind'], ['holyResist', 'Holy'], ['darkResist', 'Dark'], ['statusResist', 'Status']]; const resistanceGrid = document.querySelector('.resistance-grid'); if (resistanceGrid) { resistanceGrid.replaceChildren(); resistanceFields.forEach(([field, label]) => { const row = document.createElement('div'); row.innerHTML = `<span>${label}</span><b>${Math.round(stats[field] ?? 0)}</b>`; resistanceGrid.append(row); }); }
  renderSpellPoints(character);
  renderLifeSkills(character);
  renderItemBonuses(character);
  renderInventoryPanel(character, options);
  const memoryList = document.querySelector('#memoryList'); if (memoryList) { memoryList.replaceChildren(); const memories = character.character_memories || []; memories.forEach((record) => { const memory = record?.content || record?.memory; if (!memory || record?.is_secret || record?.memory_type === MEMORY_TYPE.SECRET) return; const age = Date.now() - new Date(record?.created_at || Date.now()).getTime(); if (record?.memory_type === MEMORY_TYPE.SHORT_TERM && age > SHORT_TERM_MEMORY_TTL_MS) return; if (record?.memory_type === MEMORY_TYPE.LONG_TERM && age > LONG_TERM_MEMORY_TTL_MS) return; const item = document.createElement('li'); item.textContent = memory; memoryList.append(item); }); if (!memoryList.children.length) { const item = document.createElement('li'); item.textContent = 'No memories recorded.'; memoryList.append(item); } }
  setText('#storyLastUpdated', character.story?.updated_at ? `Story updated ${new Date(character.story.updated_at).toLocaleString()}` : 'No story saved yet.');
  initialiseEquipmentTooltips(character, options.onSlotClick);
}

function initials(name) { return (name || 'Adventurer').trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function renderVault(data, notify, refreshCharacter) {
  const vault = data.vault || {}; const inventory = data.inventory || {};
  setText('#vaultLocation', data.location?.name || 'Safe zone');
  setText('#vaultGoldBalance', Number(vault.stored_gold || 0).toLocaleString());
  setText('#vaultUsage', `${(vault.vault_items || []).length} / ${vault.max_slots || 60} slots`);
  setText('#vaultBackpackUsage', `${(inventory.item_inventory || []).length} / ${inventory.max_slots || 40} slots`);
  const renderItems = (selector, rows, action, isDeposit = false) => {
    const grid = document.querySelector(selector); if (!grid) return; grid.replaceChildren();
    if (!rows.length) { const empty = document.createElement('p'); empty.className = 'vault-empty'; empty.textContent = 'No items stored here.'; grid.append(empty); return; }
    rows.forEach((row) => {
      const button = document.createElement('button');
      const name = row.item?.name || 'Unknown item';
      button.title = `${isDeposit ? 'Store' : 'Withdraw'} ${name}`;
      const title = document.createElement('b');
      title.textContent = name;
      const detail = document.createElement('small');
      detail.textContent = `${row.item?.type || 'Item'} · ×${row.quantity || 1}`;
      button.append(title, detail);
      button.addEventListener('click', async () => {
        const currentQty = Math.max(1, Number(row.quantity) || 1);
        const actionVerb = isDeposit ? 'Store' : 'Withdraw';
        if (currentQty > 1) {
          promptItemAction({
            eyebrow: 'SAFE ZONE STORAGE',
            title: isDeposit ? 'Store In Vault' : 'Withdraw From Vault',
            message: `How many ${name} do you want to ${actionVerb.toLowerCase()}?`,
            details: `<strong>${name}</strong><span>${isDeposit ? 'In Backpack' : 'In Vault'}: ×${currentQty}</span>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #3d343e;">
                <label for="vaultTransferQty" style="color:#cfc4b7;font-size:11px;font-family:'DM Mono',monospace;">Quantity:</label>
                <div style="display:flex;align-items:center;gap:6px;">
                  <button type="button" id="vaultQtyDec" style="width:28px;height:28px;background:#28232a;border:1px solid #554a51;color:#d7c8b7;border-radius:4px;cursor:pointer;font-size:14px;line-height:1;">−</button>
                  <input id="vaultTransferQty" type="number" min="1" max="${currentQty}" value="${currentQty}" style="width:60px;padding:5px;border:1px solid #554a51;background:#17131a;color:#fff;text-align:center;font-size:13px;font-family:'DM Mono',monospace;border-radius:4px;" />
                  <button type="button" id="vaultQtyInc" style="width:28px;height:28px;background:#28232a;border:1px solid #554a51;color:#d7c8b7;border-radius:4px;cursor:pointer;font-size:14px;line-height:1;">+</button>
                  <button type="button" id="vaultQtyAll" style="padding:5px 8px;background:#352c34;border:1px solid #806746;color:#edcf94;border-radius:4px;cursor:pointer;font-size:11px;font-family:'DM Mono',monospace;">All</button>
                </div>
              </div>`,
            confirmText: actionVerb,
            onConfirm: async () => {
              const input = document.querySelector('#vaultTransferQty');
              const chosen = Number.parseInt(input?.value, 10);
              const transferQty = Number.isInteger(chosen) ? Math.max(1, Math.min(currentQty, chosen)) : 1;
              await action(row.item_id, transferQty);
              await refreshCharacter();
              await loadVault();
              notify(isDeposit ? `Stored ×${transferQty} ${name} in vault.` : `Withdrew ×${transferQty} ${name} from vault.`);
            }
          });
          const qtyInput = document.querySelector('#vaultTransferQty');
          const decBtn = document.querySelector('#vaultQtyDec');
          const incBtn = document.querySelector('#vaultQtyInc');
          const allBtn = document.querySelector('#vaultQtyAll');
          if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
            decBtn?.addEventListener('click', () => {
              const cur = Number.parseInt(qtyInput.value, 10) || 1;
              qtyInput.value = Math.max(1, cur - 1);
            });
            incBtn?.addEventListener('click', () => {
              const cur = Number.parseInt(qtyInput.value, 10) || 1;
              qtyInput.value = Math.min(currentQty, cur + 1);
            });
            allBtn?.addEventListener('click', () => {
              qtyInput.value = currentQty;
            });
            qtyInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                document.querySelector('#itemActionConfirmButton')?.click();
              }
            });
          }
          return;
        }
        button.disabled = true;
        try {
          await action(row.item_id, currentQty);
          await refreshCharacter();
          await loadVault();
          notify(isDeposit ? `Stored ×${currentQty} ${name} in vault.` : `Withdrew ×${currentQty} ${name} from vault.`);
        } catch (error) {
          notify(error.message);
          button.disabled = false;
        }
      });
      grid.append(button);
    });
  };
  const loadVault = async () => { const latest = await getVault(); renderVault(latest, notify, refreshCharacter); };
  renderItems('#vaultBackpackGrid', inventory.item_inventory || [], (itemId, quantity) => depositVaultItem(itemId, quantity), true);
  renderItems('#vaultItemsGrid', vault.vault_items || [], (itemId, quantity) => withdrawVaultItem(itemId, quantity), false);
  const gold = document.querySelector('#vaultGoldAmount');
  ['vaultDepositGold', 'vaultWithdrawGold'].forEach((id) => { const button = document.querySelector(`#${id}`); if (!button || button.dataset.bound) return; button.dataset.bound = 'true'; button.addEventListener('click', async () => { const amount = Number(gold?.value); if (!Number.isInteger(amount) || amount < 1) return notify('Enter a positive gold amount.'); button.disabled = true; try { await transferVaultGold(amount, id === 'vaultDepositGold' ? VAULT_TRANSFER_DIRECTION.DEPOSIT : VAULT_TRANSFER_DIRECTION.WITHDRAW); await refreshCharacter(); await loadVault(); notify('Gold transferred.'); } catch (error) { notify(error.message); } finally { button.disabled = false; } }); });
}

const WORLD_TIME_ICONS = { MORNING: '🌅', AFTERNOON: '☀', EVENING: '🌆', NIGHT: '🌙' };
const worldClockState = { time: null, offsetMs: 0, timer: null, refreshing: false };

const WORLD_WEATHER_ICONS = { CLEAR: '🌤', SUNNY: '☀', RAIN: '🌧', HEAVYRAIN: '⛈', STORM: '🌩', FOG: '🌫' };
const WORLD_WEATHER_NIGHT_ICONS = { CLEAR: '✨', SUNNY: '✨' };
const worldWeatherState = { data: null, locationId: null, refreshing: false };

function applyWorldWeather(weather) {
  if (!weather?.weather) return;
  if (worldWeatherState.locationId && weather.locationId && weather.locationId !== worldWeatherState.locationId) return;
  worldWeatherState.data = weather;
  const element = document.querySelector('#worldWeather');
  if (!element) return;
  const isNight = ['EVENING', 'NIGHT'].includes(worldClockState.time?.slot);
  const icon = (isNight && WORLD_WEATHER_NIGHT_ICONS[weather.weather]) || WORLD_WEATHER_ICONS[weather.weather] || '';
  element.textContent = `${icon} ${weather.label}`;
  element.title = `Weather: ${weather.label}`;
}

async function refreshWorldWeather() {
  if (worldWeatherState.refreshing) return;
  worldWeatherState.refreshing = true;
  try { applyWorldWeather(await getWorldWeather()); } catch { /* Keep the last known weather until the next refresh. */ } finally { worldWeatherState.refreshing = false; }
}

function syncWorldWeatherLocation(locationId) {
  if (!locationId || locationId === worldWeatherState.locationId) return;
  worldWeatherState.locationId = locationId;
  refreshWorldWeather();
}

function applyWorldTime(gameTime) {
  if (!gameTime?.slot) return;
  const slotChanged = worldClockState.time && worldClockState.time.slot !== gameTime.slot;
  worldClockState.time = gameTime;
  if (slotChanged) refreshWorldWeather();
  worldClockState.offsetMs = new Date(gameTime.serverTime).getTime() - Date.now();
  renderWorldClock();
}

async function refreshWorldTime() {
  if (worldClockState.refreshing) return;
  worldClockState.refreshing = true;
  try { applyWorldTime(await getWorldTime()); } catch { /* Keep the last known time until the next refresh. */ } finally { worldClockState.refreshing = false; }
}

function renderWorldClock() {
  const time = worldClockState.time;
  if (!time) return;
  const remainingMs = new Date(time.endsAt).getTime() - (Date.now() + worldClockState.offsetMs);
  if (remainingMs <= 0) { refreshWorldTime(); return; }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const countdown = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  const element = document.querySelector('#worldTimeClock');
  if (!element) return;
  element.textContent = `${WORLD_TIME_ICONS[time.slot] || ''} ${time.label} · ${countdown}`;
  element.title = `${time.nextLabel} in ${countdown}`;
}

function startWorldClock() {
  refreshWorldTime();
  window.clearInterval(worldClockState.timer);
  worldClockState.timer = window.setInterval(renderWorldClock, 1000);
}

function connectStorySocket({ userId, onStoryAvailable, onPartyEvent, onCombatEvent, onAmbienceNotice, onStatus }) {
  let socket;
  let reconnectTimer;
  let stopped = false;
  let reconnectDelay = WEBSOCKET_INITIAL_RECONNECT_DELAY_MS;
  const socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${WEBSOCKET_PATH}`;
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(socketUrl);
    socket.addEventListener('open', () => {
      reconnectDelay = WEBSOCKET_INITIAL_RECONNECT_DELAY_MS;
      socket.send(JSON.stringify({ type: WEBSOCKET_EVENTS.SUBSCRIBE, channel: WEBSOCKET_STORY_CHANNEL, requestId: `story-${userId}` }));
      onStatus('live');
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === WEBSOCKET_EVENTS.STORY_AVAILABLE) onStoryAvailable?.(message.data || {});
        else if (message.type === WEBSOCKET_EVENTS.WORLD_TIME_CHANGED) applyWorldTime(message.data);
        else if (message.type === WEBSOCKET_EVENTS.LOCATION_WEATHER_CHANGED) applyWorldWeather(message.data);
        else if (message.type === WEBSOCKET_EVENTS.AMBIENCE_NOTICE) onAmbienceNotice?.(message.data || {});
        else if (message.type?.startsWith(WEBSOCKET_EVENTS.PARTY_COMBAT_PREFIX)) onCombatEvent?.(message.type, message.data || {});
        else if (message.type?.startsWith(WEBSOCKET_EVENTS.PARTY_PREFIX)) onPartyEvent?.(message.type, message.data || {});
      } catch { /* Ignore malformed server data and keep the live connection available. */ }
    });
    socket.addEventListener('close', () => {
      onStatus('reconnecting');
      if (stopped) return;
      reconnectTimer = window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, WEBSOCKET_MAX_RECONNECT_DELAY_MS);
    });
    socket.addEventListener('error', () => socket.close());
  };
  connect();
  return () => { stopped = true; window.clearTimeout(reconnectTimer); socket?.close(); };
}

export async function initialiseGame() {
  let currentUser;
  try { ({ user: currentUser } = await getCurrentUser()); }
  catch { window.location.replace(PAGES.LOGIN); return; }
  if (currentUser.hasCharacter) {
    try {
      const activeBattle = await getActiveBattle();
      if (activeBattle?.inCombat && activeBattle.battle) {
        window.location.replace(PAGES.COMBAT);
        return;
      }
    } catch { /* The normal game view can still load if the session check is temporarily unavailable. */ }
  }
  const feed = document.querySelector('#storyFeed');
  const form = document.querySelector('#actionForm');
  const input = document.querySelector('#actionInput');
  const submitButton = form?.querySelector('#actionSubmitButton') || form?.querySelector('button[type="submit"]');
  const notify = createToast(document.querySelector('#toast'));
  const aiKeyUi = initAiApiKeyControl({ notify });
  let currentCharacter;
  let nearbyNpcs = [];
  let observeUi = null;
  let observeBusy = false;
  let allNpcs = [];
  let combatStartPending = false;
  const enterCombatRoute = async (encounter) => {
    if (combatStartPending) return;
    combatStartPending = true;
    try {
      const battle = await getEncounterBattle(encounter.monsterNames || encounter.name);
      if (battle?.status === BATTLE_STATUS.IN_PROGRESS) {
        window.location.replace(PAGES.COMBAT);
        return;
      }
    } finally {
      combatStartPending = false;
    }
  };

  const npcsButton = document.querySelector('#npcsButton');
  const npcsModal = document.querySelector('#npcsModal');
  const nearbyNpcsList = document.querySelector('#nearbyNpcsList');
  const npcChatChipsBar = document.querySelector('#npcChatChipsBar');
  const npcChatChips = document.querySelector('#npcChatChips');
  let selectedTargetNpcId = null;
  const questsButton = document.querySelector('#questsButton');
  const questsModal = document.querySelector('#questsModal');
  const questOffersList = document.querySelector('#questOffersList');
  const repeatQuestOffersList = document.querySelector('#repeatQuestOffersList');
  const activeQuestsList = document.querySelector('#activeQuestsList');
  let questBoard = { has_local_offers: false, offers: [], active: [], active_limit: 5, active_count: 0 };

  const closeNpcsModal = () => {
    npcsModal?.classList.remove('is-open');
    npcsModal?.setAttribute('aria-hidden', 'true');
  };

  const renderNpcChatChips = () => {
    if (!npcChatChipsBar || !npcChatChips) return;
    if (!nearbyNpcs.length) {
      npcChatChipsBar.setAttribute('hidden', '');
      selectedTargetNpcId = null;
      return;
    }

    npcChatChipsBar.removeAttribute('hidden');
    npcChatChips.replaceChildren();

    if (selectedTargetNpcId && !nearbyNpcs.some((n) => n.id === selectedTargetNpcId)) {
      selectedTargetNpcId = null;
    }

    const noneChip = document.createElement('button');
    noneChip.type = 'button';
    noneChip.className = `npc-chip ${selectedTargetNpcId === null ? 'is-active' : ''}`;
    noneChip.setAttribute('role', 'radio');
    noneChip.setAttribute('aria-checked', selectedTargetNpcId === null ? 'true' : 'false');
    const noneName = document.createElement('span');
    noneName.className = 'npc-chip-name';
    noneName.textContent = 'None';
    noneChip.append(noneName);
    noneChip.addEventListener('click', () => {
      selectedTargetNpcId = null;
      renderNpcChatChips();
    });
    npcChatChips.append(noneChip);

    nearbyNpcs.forEach((npc) => {
      const isSelected = selectedTargetNpcId === npc.id;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `npc-chip ${isSelected ? 'is-active is-npc-target' : ''}`;
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', isSelected ? 'true' : 'false');

      const name = document.createElement('span');
      name.className = 'npc-chip-name';
      name.textContent = npc.name || 'NPC';

      chip.append(name);
      chip.addEventListener('click', () => {
        selectedTargetNpcId = selectedTargetNpcId === npc.id ? null : npc.id;
        renderNpcChatChips();
      });
      npcChatChips.append(chip);
    });

    const targetNpc = nearbyNpcs.find((n) => n.id === selectedTargetNpcId);
    if (targetNpc) {
      const endChip = document.createElement('button');
      endChip.type = 'button';
      endChip.className = 'npc-chip npc-chip-end';
      endChip.title = `End your conversation with ${targetNpc.name || 'this NPC'}`;
      const endName = document.createElement('span');
      endName.className = 'npc-chip-name';
      endName.textContent = 'End conversation';
      endChip.append(endName);
      endChip.addEventListener('click', async () => {
        endChip.disabled = true;
        try {
          const result = await endDialogue(currentUser.id, targetNpc.id);
          notify(result.message || 'Conversation ended.');
        } catch (error) {
          notify(error.message);
        } finally {
          endChip.disabled = false;
        }
      });
      npcChatChips.append(endChip);

      const partyForReveal = cachedPartyData?.party;
      const isNonLeaderMember = Boolean(partyForReveal && Array.isArray(partyForReveal.members) && partyForReveal.members.length > 1 && !partyForReveal.is_leader);
      if (!targetNpc.name_revealed && !isNonLeaderMember) {
        const revealChip = document.createElement('button');
        revealChip.type = 'button';
        revealChip.className = `npc-chip npc-chip-end ${partyTurnMode() && leaderRevealSelected ? 'is-active' : ''}`;
        revealChip.title = `Tell ${targetNpc.name || 'this NPC'} your real name`;
        const revealName = document.createElement('span');
        revealName.className = 'npc-chip-name';
        revealName.textContent = 'Reveal real name';
        revealChip.append(revealName);
        revealChip.addEventListener('click', async () => {
          if (partyTurnMode()) {
            leaderRevealSelected = !leaderRevealSelected;
            revealChip.classList.toggle('is-active', leaderRevealSelected);
            return;
          }
          revealChip.disabled = true;
          await act(`I tell ${targetNpc.name || 'them'} my real name: ${currentCharacter?.name || ''}.`, { revealNpcId: targetNpc.id });
        });
        npcChatChips.append(revealChip);
      }
    }
    if (typeof renderPartyRows === 'function') renderPartyRows();
  };

  const dialogueLeaveModal = document.querySelector('#dialogueLeaveModal');
  const dialogueResumeModal = document.querySelector('#dialogueResumeModal');
  const DIALOGUE_RESUME_MIN_DISPLAY_MS = 800;
  const npcNameList = (sessions) => [...new Set(sessions.map((session) => session.npcName))].join(', ');

  const setDialogueModalOpen = (modal, open) => {
    modal?.classList.toggle('is-open', open);
    modal?.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const confirmDialogueLeave = async (leaveQuery) => {
    let sessions = [];
    try {
      sessions = (await getDialogueLeaveCheck(currentUser.id, leaveQuery)).sessions || [];
    } catch (error) {
      console.warn('Unable to check conversations before leaving:', error);
      return 'PAUSE';
    }
    if (!sessions.length || !dialogueLeaveModal) return 'PAUSE';
    setText('#dialogueLeaveMessage', `You are leaving an open conversation. Pause it to continue within 15 minutes, or close it now.`);
    const list = document.querySelector('#dialogueLeaveList');
    list?.replaceChildren(...sessions.map((session) => {
      const item = document.createElement('li');
      item.textContent = `${session.npcName} · ${session.messageCount} messages`;
      return item;
    }));
    setDialogueModalOpen(dialogueLeaveModal, true);
    return new Promise((resolve) => {
      const buttons = [...dialogueLeaveModal.querySelectorAll('[data-dialogue-leave]')];
      const finish = (choice) => {
        buttons.forEach((button) => button.removeEventListener('click', handlers.get(button)));
        document.removeEventListener('keydown', onKey);
        setDialogueModalOpen(dialogueLeaveModal, false);
        resolve(choice === 'STAY' ? null : choice);
      };
      const handlers = new Map(buttons.map((button) => [button, () => finish(button.dataset.dialogueLeave)]));
      const onKey = (event) => { if (event.key === 'Escape') finish('STAY'); };
      buttons.forEach((button) => button.addEventListener('click', handlers.get(button)));
      document.addEventListener('keydown', onKey);
    });
  };

  const notifyDialogueLeave = (dialogue) => {
    if (dialogue?.paused?.length) notify(`Conversation with ${npcNameList(dialogue.paused)} paused, 15:00 to return.`);
    else if (dialogue?.closed?.length) notify(`Conversation with ${npcNameList(dialogue.closed)} closed.`);
  };

  const resumeDialoguesIfAny = async () => {
    let sessions = [];
    try {
      sessions = (await getResumableDialogues(currentUser.id)).sessions || [];
    } catch (error) {
      console.warn('Unable to check paused conversations:', error);
      return;
    }
    if (!sessions.length || !dialogueResumeModal) return;
    setText('#dialogueResumeMessage', `The system is resuming your previous conversation with ${npcNameList(sessions)}…`);
    setDialogueModalOpen(dialogueResumeModal, true);
    const startedAt = Date.now();
    try {
      const result = await resumeDialogues(currentUser.id);
      const waitMs = DIALOGUE_RESUME_MIN_DISPLAY_MS - (Date.now() - startedAt);
      if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
      if (result.sessions?.length) notify(`Resumed conversation with ${npcNameList(result.sessions)}.`);
    } catch (error) {
      notify(error.message || 'Unable to resume your conversation.');
    } finally {
      setDialogueModalOpen(dialogueResumeModal, false);
    }
  };

  const renderNearbyNpcs = () => {
    if (!nearbyNpcsList) return;
    nearbyNpcsList.replaceChildren();

    if (!nearbyNpcs.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No NPCs are nearby.';
      nearbyNpcsList.append(empty);
      return;
    }

    const areaName = currentCharacter?.sublocation?.name || currentCharacter?.location?.name;
    setText('#npcsSubtitle', areaName ? `Characters currently in ${areaName}.` : 'Characters currently in your area.');

    nearbyNpcs.forEach((npc) => {
      const card = document.createElement('article');
      card.className = 'nearby-npc-card';

      const info = document.createElement('div');
      info.className = 'nearby-npc-info';

      const name = document.createElement('strong');
      name.className = 'nearby-npc-name';
      name.textContent = npc.name || 'Unnamed NPC';
      info.append(name);

      const meta = document.createElement('span');
      meta.className = 'nearby-npc-meta';
      meta.textContent = [npc.race, npc.job].filter(Boolean).join(' · ') || 'Local NPC';
      info.append(meta);

      if (npc.appearance) {
        const appearance = document.createElement('span');
        appearance.className = 'nearby-npc-appearance';
        appearance.textContent = npc.appearance;
        info.append(appearance);
      }

      const actions = document.createElement('div');
      actions.className = 'nearby-npc-actions';
      const inviteButton = document.createElement('button');
      inviteButton.type = 'button';
      inviteButton.className = 'nearby-npc-invite';
      inviteButton.textContent = 'Invite to Party';
      inviteButton.addEventListener('click', () => {
        notify('NPC party invitations will be available after more party features are implemented.');
      });
      actions.append(inviteButton);

      card.append(info, actions);
      nearbyNpcsList.append(card);
    });
  };

  const loadNpcDirectory = async () => {
    try {
      const response = await getAllNpcs();
      if (Array.isArray(response?.npcs)) {
        allNpcs = response.npcs;
      }
    } catch (error) {
      console.warn('Failed to load NPC directory:', error.message);
    }
  };

  const loadNearbyNpcs = async () => {
    try {
      const response = await getNearbyNpcs();
      nearbyNpcs = Array.isArray(response?.npcs) ? response.npcs : [];
      nearbyNpcs.forEach((n) => {
        const existingIdx = allNpcs.findIndex((item) => item.id === n.id);
        if (existingIdx >= 0) allNpcs[existingIdx] = n;
        else allNpcs.push(n);
      });
      npcsButton?.toggleAttribute('hidden', nearbyNpcs.length === 0);
      renderNearbyNpcs();
      renderNpcChatChips();
      observeUi?.refresh();
      await loadQuestBoard();
      if (conversationHistory.length > 0) renderHistoryFeed();
      if (!nearbyNpcs.length) closeNpcsModal();
    } catch (error) {
      nearbyNpcs = [];
      npcsButton?.setAttribute('hidden', '');
      closeNpcsModal();
      renderNearbyNpcs();
      renderNpcChatChips();
      observeUi?.refresh();
      await loadQuestBoard();
      console.warn('Failed to load nearby NPCs:', error.message);
    }
  };

  const openNpcsModal = () => {
    if (!nearbyNpcs.length) return;
    renderNearbyNpcs();
    npcsModal?.classList.add('is-open');
    npcsModal?.setAttribute('aria-hidden', 'false');
  };

  const closeQuestsModal = () => {
    questsModal?.classList.remove('is-open');
    questsModal?.setAttribute('aria-hidden', 'true');
  };

  const renderQuestCards = (container, quests, action, emptyText = '') => {
    if (!container) return;
    container.replaceChildren();
    if (!quests.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = action === 'accept' ? emptyText || 'No quests are available here.' : 'You have no active quests.';
      container.append(empty);
      return;
    }
    quests.forEach((quest) => {
      const card = document.createElement('article');
      card.className = 'nearby-npc-card';
      const info = document.createElement('div');
      info.className = 'nearby-npc-info';
      const name = document.createElement('strong');
      name.className = 'nearby-npc-name';
      name.textContent = quest.name;
      info.append(name);
      const issuer = document.createElement('span');
      issuer.className = 'nearby-npc-meta';
      issuer.textContent = `Quest giver: ${quest.issuer_name} (${quest.repeatable ? 'Repeatable quest' : 'One-time quest'})`;
      info.append(issuer);
      const rewardParts = [];
      if (quest.gold_reward) rewardParts.push(`${Number(quest.gold_reward).toLocaleString()} Gold`);
      if (quest.exp_reward) rewardParts.push(`${Number(quest.exp_reward).toLocaleString()} EXP`);
      if (quest.affinity_reward) rewardParts.push(`+${Number(quest.affinity_reward).toLocaleString()} Affinity`);
      const rewards = document.createElement('span');
      rewards.className = 'nearby-npc-meta';
      rewards.textContent = rewardParts.length ? `Rewards: ${rewardParts.join(', ')}` : 'Rewards: None';
      info.append(rewards);
      const description = document.createElement('span');
      description.className = 'nearby-npc-appearance';
      description.textContent = quest.description;
      info.append(description);
      const objective = document.createElement('span');
      objective.className = 'nearby-npc-meta';
      objective.textContent = `${quest.objective_type}: ${quest.progress}/${quest.required_quantity} · ${quest.target_name}`;
      info.append(objective);
      const actions = document.createElement('div');
      actions.className = 'nearby-npc-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nearby-npc-invite';
      if (action === 'accept') {
        button.textContent = quest.is_active ? 'Accepted' : quest.has_been_completed && !quest.repeatable ? 'Completed' : 'Accept';
        const lockedOut = quest.is_active || (quest.has_been_completed && !quest.repeatable);
        const logFull = questBoard.active_count >= questBoard.active_limit;
        if (!lockedOut && logFull) button.textContent = 'Quest Log Full';
        button.disabled = !quest.can_accept || (!lockedOut && logFull);
      } else {
        button.textContent = 'Turn In';
        button.disabled = !quest.can_complete;
      }
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          if (action === 'accept') {
            await acceptQuest(quest.id);
            notify(`Accepted ${quest.name}.`);
          } else {
            const result = await completeQuest(quest.run_id);
            await refreshCharacter();
            const rewardGains = [];
            if (result.gold_reward) rewardGains.push(`+${Number(result.gold_reward).toLocaleString()} gold`);
            if (result.exp_reward) rewardGains.push(`+${Number(result.exp_reward).toLocaleString()} EXP`);
            if (result.affinity_reward) rewardGains.push(`+${Number(result.affinity_reward).toLocaleString()} affinity`);
            notify(`Completed ${result.quest_name}.${rewardGains.length ? ' ' + rewardGains.join('; ') : ''}`);
          }
          await loadQuestBoard();
        } catch (error) {
          button.disabled = false;
          notify(error.message);
        }
      });
      actions.append(button);
      if (action !== 'accept') {
        const abandonButton = document.createElement('button');
        abandonButton.type = 'button';
        abandonButton.className = 'nearby-npc-invite';
        abandonButton.textContent = 'Abandon';
        abandonButton.addEventListener('click', async () => {
          if (!window.confirm(`Abandon ${quest.name}? Your progress will be lost.`)) return;
          abandonButton.disabled = true;
          button.disabled = true;
          try {
            const result = await abandonQuest(quest.run_id);
            notify(`Abandoned ${result.quest_name || quest.name}.`);
            await loadQuestBoard();
          } catch (error) {
            abandonButton.disabled = false;
            button.disabled = !quest.can_complete;
            notify(error.message);
          }
        });
        actions.append(abandonButton);
      }
      card.append(info, actions);
      container.append(card);
    });
  };

  const renderQuestBoard = () => {
    setText('#questsSubtitle', `${questBoard.active_count} of ${questBoard.active_limit} active quest slots used.`);
    const offers = questBoard.offers || [];
    renderQuestCards(questOffersList, offers.filter((quest) => !quest.repeatable), 'accept', 'No one-time quests are available here.');
    renderQuestCards(repeatQuestOffersList, offers.filter((quest) => quest.repeatable), 'accept', 'No repeatable quests are available here.');
    renderQuestCards(activeQuestsList, questBoard.active || [], 'complete');
  };

  const loadQuestBoard = async () => {
    try {
      questBoard = await getQuestBoard();
      const hasQuests = Boolean(questBoard.has_local_offers || (questBoard.active && questBoard.active.length > 0));
      questsButton?.toggleAttribute('hidden', !hasQuests);
      renderQuestBoard();
      if (!hasQuests) closeQuestsModal();
    } catch (error) {
      questBoard = { has_local_offers: false, offers: [], active: [], active_limit: 5, active_count: 0 };
      questsButton?.setAttribute('hidden', '');
      closeQuestsModal();
      console.warn('Failed to load quests:', error.message);
    }
  };

  const openQuestsModal = async () => {
    await loadQuestBoard();
    if (!questBoard.has_local_offers && !(questBoard.active && questBoard.active.length > 0)) return;
    renderQuestBoard();
    questsModal?.classList.add('is-open');
    questsModal?.setAttribute('aria-hidden', 'false');
  };

  let conversationHistory = [];
  const historyStorageKey = `${STORAGE_KEY_PREFIXES.HISTORY}${currentUser.id}`;
  const defeatActionStorageKey = `${STORAGE_KEY_PREFIXES.DEFEAT_ACTION}${currentUser.id}`;
  const fleeActionStorageKey = `${STORAGE_KEY_PREFIXES.FLEE_ACTION}${currentUser.id}`;
  const contextCheckModal = document.querySelector('#contextCheckModal');
  const contextCheckButton = document.querySelector('#contextCheckBtn');
  let lastTurnContextCheck = null;

  const formatContextPercent = (value) => value === null || value === undefined
    ? 'unknown'
    : `${value.toFixed(value < 0.01 && value > 0 ? 4 : 2)}%`;
  const formatContextTotal = (measurement) => measurement
    ? `${measurement.characters.toLocaleString()} characters · ~${measurement.estimatedTokens.toLocaleString()} tokens · ${formatContextPercent(measurement.percent)} of window`
    : 'No AI DM response yet.';
  const renderContextCheck = (report) => {
    if (!report) return;
    setText('#contextCheckStatus', report.isFallback
      ? 'AI DM did not respond; this turn used a fallback.'
      : report.after ? 'AI DM turn complete.' : 'Preview of the next AI DM request.');
    const categories = document.querySelector('#contextCheckCategories');
    categories.replaceChildren();
    report.categories.forEach((category) => {
      const row = document.createElement('div');
      row.className = 'context-check-category';
      const label = document.createElement('span');
      label.textContent = category.label;
      const value = document.createElement('span');
      value.textContent = `${category.characters.toLocaleString()} chars · ~${category.estimatedTokens.toLocaleString()} tokens · ${formatContextPercent(category.percent)}`;
      row.append(label, value);
      categories.append(row);
    });
    setText('#contextCheckBeforeTotal', formatContextTotal(report.before));
    setText('#contextCheckBeforeText', report.before?.text || '');
    setText('#contextCheckAfterTotal', formatContextTotal(report.after));
    setText('#contextCheckAfterText', report.after?.text || '');
    setText('#contextCheckNote', report.note || '');
  };
  const closeContextCheck = () => {
    if (!contextCheckModal?.classList.contains('is-open')) return;
    contextCheckModal?.classList.remove('is-open');
    contextCheckModal?.setAttribute('aria-hidden', 'true');
    contextCheckButton?.focus();
  };
  const previewCurrentContext = async () => {
    setText('#contextCheckStatus', 'Loading context…');
    try {
      const report = await getContextCheck(currentUser.id, input.value.trim() || 'Look around.', conversationHistory, ACTION_MODES.STORY, selectedTargetNpcId);
      if (contextCheckModal?.classList.contains('is-open')) renderContextCheck(report);
    } catch (error) {
      setText('#contextCheckStatus', error.message || 'Unable to check AI context.');
    }
  };
  const openContextCheck = async () => {
    contextCheckModal?.classList.add('is-open');
    contextCheckModal?.setAttribute('aria-hidden', 'false');
    contextCheckModal?.querySelector('.modal-close')?.focus();
    if (input.value.trim() || !lastTurnContextCheck) await previewCurrentContext();
    else renderContextCheck(lastTurnContextCheck);
  };
  contextCheckButton?.addEventListener('click', openContextCheck);
  document.querySelector('#contextCheckRefreshBtn')?.addEventListener('click', previewCurrentContext);
  contextCheckModal?.querySelectorAll('[data-close-context-check]').forEach((button) => button.addEventListener('click', closeContextCheck));

  const mapDbStoriesToHistory = (stories = []) => {
    const list = [];
    stories.forEach((record) => {
      if (record.action_from_player && record.action_from_player.trim()) {
        list.push({
          id: `action_${record.id}`,
          dbId: record.id,
          field: 'action_from_player',
          role: 'user',
          text: record.action_from_player,
          partyTurn: Array.isArray(record.party_turn) ? record.party_turn : null,
          fateCheck: record.fate_check || null,
          skillCheck: record.skill_check || null,
          dialogueSessionId: record.dialogue_session_id || null,
          dialogueMessageIds: Array.isArray(record.dialogue_message_ids) ? record.dialogue_message_ids : [],
          timestamp: record.created_at ? new Date(record.created_at).getTime() : Date.now()
        });
      }
      if (record.story && record.story.trim()) {
        list.push({
          id: `narration_${record.id}`,
          dbId: record.id,
          field: 'story',
          role: 'assistant',
          text: record.story,
          dialogueSessionId: record.dialogue_session_id || null,
          dialogueMessageIds: Array.isArray(record.dialogue_message_ids) ? record.dialogue_message_ids : [],
          timestamp: record.created_at ? new Date(record.created_at).getTime() : Date.now()
        });
      }
    });
    return list;
  };

  const loadConversationHistory = async () => {
    try {
      if (currentCharacter?.id) {
        const response = await getStoryHistory(currentCharacter.id);
        if (Array.isArray(response?.stories) && response.stories.length > 0) {
          const list = mapDbStoriesToHistory(response.stories);
          conversationHistory = list;
          saveConversationHistory(list);
          return list;
        }
      }
    } catch (err) {
      console.warn('Unable to load history from database, falling back to local cache:', err);
    }

    try {
      const stored = localStorage.getItem(historyStorageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          conversationHistory = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Unable to load history from localStorage:', err);
    }

    const initial = [];
    const starterStoryText = `You stand at ${currentCharacter?.location?.name || "Warden's Crossing"}. The cold wind whispers across the old stone road. What do you do?`;
    try {
      if (currentCharacter?.id) {
        const created = await createStoryTurn(currentCharacter.id, {
          action_from_player: '',
          story: starterStoryText
        });
        if (created?.story) {
          const starterTurn = {
            id: `narration_${created.story.id}`,
            dbId: created.story.id,
            field: 'story',
            role: 'assistant',
            text: created.story.story,
            timestamp: Date.now()
          };
          initial.push(starterTurn);
          conversationHistory = initial;
          saveConversationHistory(initial);
          return initial;
        }
      }
    } catch (err) {
      console.warn('Failed to seed starter story in DB:', err);
    }

    const fallbackTurn = {
      id: `starter_dm_${Date.now()}`,
      role: 'assistant',
      text: starterStoryText,
      timestamp: Date.now()
    };
    initial.push(fallbackTurn);
    conversationHistory = initial;
    saveConversationHistory(initial);
    return initial;
  };

  const saveConversationHistory = (history) => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch (err) {
      console.warn('Unable to save history to localStorage:', err);
    }
  };

  const handleEditEntry = async (id, newText) => {
    const entry = conversationHistory.find((item) => item.id === id);
    if (!entry) return;

    entry.text = newText;
    entry.editedAt = Date.now();
    saveConversationHistory(conversationHistory);

    if (entry.dbId) {
      try {
        const updatePayload = entry.field === 'action_from_player'
          ? { action_from_player: newText }
          : { story: newText };
        await updateStoryTurn(entry.dbId, updatePayload);
        notify('Story updated in database.');
      } catch (err) {
        notify(`Failed to update database: ${err.message}`);
      }
    } else {
      notify('Story updated locally.');
    }
  };

  const handleDeleteEntry = async (id) => {
    const entry = conversationHistory.find((item) => item.id === id);
    if (!entry) return;

    conversationHistory = conversationHistory.filter((item) => item.id !== id);
    saveConversationHistory(conversationHistory);

    if (entry.dbId) {
      try {
        const remainingWithSameDbId = conversationHistory.filter((item) => item.dbId === entry.dbId);
        if (remainingWithSameDbId.length === 0) {
          await deleteStoryTurn(entry.dbId);
        } else {
          const updatePayload = entry.field === 'action_from_player'
            ? { action_from_player: '' }
            : { story: '' };
          await updateStoryTurn(entry.dbId, updatePayload);
        }
        notify('Entry deleted from database.');
      } catch (err) {
        notify(`Failed to delete from database: ${err.message}`);
      }
    } else {
      notify('Entry deleted locally.');
    }

    if (conversationHistory.length === 0) {
      renderHistoryFeed();
    }
  };

  const renderHistoryFeed = () => {
    if (!feed) return;
    feed.replaceChildren();
    if (!conversationHistory || conversationHistory.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'story-history-empty';
      emptyNotice.textContent = 'No messages in conversation. Enter an action below to begin!';
      feed.append(emptyNotice);
      return;
    }
    conversationHistory.forEach((item) => {
      const element = createStoryEntryElement({
        entry: item,
        character: currentCharacter,
        npcs: allNpcs.length ? allNpcs : nearbyNpcs,
        onEdit: handleEditEntry,
        onDelete: handleDeleteEntry
      });
      feed.append(element);
    });
    feed.scrollTop = feed.scrollHeight;
  };

  const renderStory = async () => {
    if (!conversationHistory || conversationHistory.length === 0) {
      await loadConversationHistory();
    }
    renderHistoryFeed();
  };

  const handleSlotClick = ({ slot, field, isBlocked, item }) => {
    if (isBlocked) {
      notify('You are already equipped with a two-handed weapon.');
      return;
    }
    if (!item) return;
    promptItemAction({
      eyebrow: 'EQUIPMENT',
      title: 'Confirm Unequip',
      message: `Do you want to unequip ${item.name}?`,
      details: `<strong>${item.name}</strong><span>Slot: ${slot.replace('-', ' ')}</span>${item.description ? `<span>${item.description}</span>` : ''}`,
      confirmText: 'Unequip',
      onConfirm: async () => {
        try {
          const result = await unequipItem(currentUser.id, { slot, itemId: item.id });
          currentCharacter = result.character;
          render(currentCharacter);
          notify(result.message || `${item.name} unequipped.`);
        } catch (error) {
          notify(error.message);
          throw error;
        }
      }
    });
  };

  const equippableTypes = EQUIPPABLE_ITEM_TYPES;

  const handleItemClick = (entry) => {
    const item = entry.item;
    if (!item) return;
    const effect = item.item_bonus || {};

    if (item.type === ITEM_TYPE.SKILL_SCROLL) {
      const taught = (item.skills_in_items || []).map((link) => link.skill).filter((skill) => skill && !skill.deleted);
      const knownIds = new Set((currentCharacter?.skills || []).filter((row) => !row.deleted).map((row) => row.skill_id ?? row.skill?.id));
      const unknown = taught.filter((skill) => !knownIds.has(skill.id));
      const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      const skillList = taught.length ? taught.map((skill) => `${escapeText(skill.name)}${knownIds.has(skill.id) ? ' (already known)' : ''}`).join(', ') : 'No skill linked';
      promptItemAction({
        eyebrow: 'SKILL SCROLL',
        title: 'Study Scroll',
        message: unknown.length ? `Study ${item.name} to learn ${unknown.map((skill) => skill.name).join(', ')}? The scroll is used up.` : (taught.length ? `You already know everything ${item.name} teaches.` : `${item.name} does not teach a skill.`),
        details: `<strong>${escapeText(item.name)}</strong><span>${escapeText(item.description || 'A scroll that teaches a skill.')}</span><span>Teaches: ${skillList}</span>`,
        confirmText: 'Learn Skill',
        confirmDisabled: !unknown.length,
        onConfirm: async () => {
          try {
            const result = await useItem(currentUser.id, { itemId: item.id });
            currentCharacter = result.character;
            render(currentCharacter);
            notify(result.message || `Learned from ${item.name}.`);
          } catch (error) {
            notify(error.message);
            throw error;
          }
        }
      });
    } else if (item.is_consumable) {
      const heal = Number(effect.healing_current_hp || 0);
      const healNote = heal > 0 ? `Restores up to ${heal} HP.` : '';
      const cureNote = effect.cure_effect_type && effect.cure_effect_type !== 'NONE' ? `Cures ${effect.cure_effect_type}.` : '';
      const statNote = describeItemStatBonus(effect);
      const bonusMode = effect.consume_bonus_mode || 'NONE';
      const alreadyAbsorbed = (currentCharacter?.active_item_bonuses || []).some((bonus) => bonus.item_id === item.id && bonus.is_permanent);
      const buffNote = !statNote || bonusMode === 'NONE' ? ''
        : bonusMode === 'PERMANENT_ONCE' ? (alreadyAbsorbed ? 'Permanent bonus already absorbed.' : `Permanently grants ${statNote} (first use only).`)
          : Number(effect.buff_duration_minutes || 0) > 0 ? `Grants ${statNote} for ${Number(effect.buff_duration_minutes)} min.` : '';
      promptItemAction({
        eyebrow: 'CONSUMABLE',
        title: 'Use Consumable',
        message: `Do you want to use ${item.name}? (Owned: ×${entry.quantity || 1})`,
        details: `<strong>${item.name}</strong><span>${item.description || 'A consumable item.'}</span>${healNote || cureNote || buffNote ? `<span>${[healNote, cureNote, buffNote].filter(Boolean).join(' ')}</span>` : ''}`,
        confirmText: 'Use',
        onConfirm: async () => {
          try {
            const result = await useItem(currentUser.id, { itemId: item.id });
            currentCharacter = result.character;
            render(currentCharacter);
            notify(result.message || `Used ${item.name}.`);
          } catch (error) {
            notify(error.message);
            throw error;
          }
        }
      });
    } else if (equippableTypes.includes(item.type)) {
      if (entry.equipped) {
        promptItemAction({
          eyebrow: 'EQUIPMENT',
          title: 'Item Already Equipped',
          message: `${item.name} is currently equipped. Do you want to unequip it?`,
          details: `<strong>${item.name}</strong><span>Type: ${item.type}</span>${item.description ? `<span>${item.description}</span>` : ''}`,
          confirmText: 'Unequip',
          onConfirm: async () => {
            try {
              const equipRecord = currentCharacter.character_equipment || {};
              const slotKey = Object.keys(equipRecord).find((k) => equipRecord[k]?.id === item.id);
              const result = await unequipItem(currentUser.id, { slot: slotKey || item.type, itemId: item.id });
              currentCharacter = result.character;
              render(currentCharacter);
              notify(result.message || `${item.name} unequipped.`);
            } catch (error) {
              notify(error.message);
              throw error;
            }
          }
        });
      } else {
        const equipRecord = currentCharacter?.character_equipment || {};
        const isTwoHandWielded = equipRecord.left_hand?.type === ITEM_TYPE.TWO_HAND;

        if (item.type === ITEM_TYPE.TWO_HAND) {
          if (equipRecord.left_hand_id) {
            notify('Your main hand is occupied. You need to unequip it first.');
            return;
          }
          if (equipRecord.right_hand_id) {
            notify('A two-handed weapon requires both hands. You need to unequip your off-hand item first.');
            return;
          }
        } else if (item.type === ITEM_TYPE.MAIN_HAND) {
          if (isTwoHandWielded) {
            notify('You are already equipped with a two-handed weapon. You need to unequip it first.');
            return;
          }
          if (equipRecord.left_hand_id && equipRecord.right_hand_id) {
            notify('Both hands are occupied by weapons. You need to unequip first.');
            return;
          }
        } else if (item.type === ITEM_TYPE.RING || item.type === ITEM_TYPE.EARRING) {
          const pairField = item.type === ITEM_TYPE.RING ? 'ring' : 'earring';
          if (equipRecord[`left_${pairField}_id`] && equipRecord[`right_${pairField}_id`]) {
            notify(`Both ${pairField} slots are occupied. Unequip one first.`);
            return;
          }
        }

        const equipTo = (slot) => async () => {
          try {
            const result = await equipItem(currentUser.id, slot ? { itemId: item.id, slot } : { itemId: item.id });
            currentCharacter = result.character;
            render(currentCharacter);
            notify(result.message || `Equipped ${item.name}.`);
          } catch (error) {
            notify(error.message);
            throw error;
          }
        };
        const isOneHand = item.type === ITEM_TYPE.MAIN_HAND;
        promptItemAction({
          eyebrow: 'EQUIPMENT',
          title: 'Confirm Equip',
          message: isOneHand ? `Equip ${item.name} to your main hand or sub hand? Only the main-hand weapon adds its accuracy.` : `Do you want to equip ${item.name}?`,
          details: `<strong>${item.name}</strong><span>Type: ${item.type}</span>${item.description ? `<span>${item.description}</span>` : ''}`,
          confirmText: isOneHand ? 'Equip to Main Hand' : 'Equip',
          confirmDisabled: isOneHand && Boolean(equipRecord.left_hand_id),
          onConfirm: equipTo(isOneHand ? 'LEFT_HAND' : null),
          ...(isOneHand ? { secondaryText: 'Equip to Sub Hand', secondaryDisabled: !equipRecord.left_hand_id || Boolean(equipRecord.right_hand_id), onSecondary: equipTo('RIGHT_HAND') } : {})
        });
      }
    } else {
      notify(`${item.name} cannot be equipped or consumed.`);
    }
  };

  const render = (c) => renderCharacter(c, { onSlotClick: handleSlotClick, onItemClick: handleItemClick, onAvatarUpdated: renderHistoryFeed });

  // ── Party UI State & Render ──
  let cachedPartyData = null;
  const partyRowDrafts = new Map();
  let leaderRevealSelected = false;

  function partyTurnMode() {
    const party = cachedPartyData?.party;
    return Boolean(party && party.is_leader && Array.isArray(party.members) && party.members.filter((member) => member.is_player).length > 1);
  }

  function onlinePartyMembers() {
    const party = cachedPartyData?.party;
    if (!party) return [];
    return party.members.filter((member) => member.is_player && !member.is_leader && member.is_online);
  }

  function renderPartyRows() {
    if (!form) return;
    form.querySelectorAll('.party-member-row').forEach((row) => row.remove());
    const mainRow = form.querySelector('.action-composer-row');
    mainRow?.querySelector('.party-row-label')?.remove();
    mainRow?.classList.remove('party-composer-row');
    if (!partyTurnMode()) return;
    mainRow?.classList.add('party-composer-row');
    const leaderLabel = document.createElement('span');
    leaderLabel.className = 'npc-chips-label party-row-label';
    leaderLabel.textContent = 'You (leader)';
    mainRow?.prepend(leaderLabel);
    const targetNpc = nearbyNpcs.find((npc) => npc.id === selectedTargetNpcId) || null;
    let anchor = mainRow;
    onlinePartyMembers().forEach((member) => {
      const draft = partyRowDrafts.get(member.character_id) || { text: '', reveal: false };
      const row = document.createElement('div');
      row.className = 'action-composer-row party-member-row party-composer-row';
      const label = document.createElement('span');
      label.className = 'npc-chips-label party-row-label';
      label.textContent = member.name;
      const area = document.createElement('textarea');
      area.rows = 2;
      area.value = draft.text;
      area.placeholder = `${member.name}: describe their action and speech…`;
      area.dataset.characterId = String(member.character_id);
      area.addEventListener('input', () => partyRowDrafts.set(member.character_id, { ...(partyRowDrafts.get(member.character_id) || { reveal: false }), text: area.value }));
      row.append(label, area);
      const alreadyRevealed = targetNpc && Array.isArray(targetNpc.revealed_character_ids) && targetNpc.revealed_character_ids.includes(member.character_id);
      if (targetNpc && !alreadyRevealed) {
        const revealChip = document.createElement('button');
        revealChip.type = 'button';
        revealChip.className = `npc-chip npc-chip-end ${draft.reveal ? 'is-active' : ''}`;
        revealChip.title = `Reveal ${member.name}'s real name to ${targetNpc.name || 'this NPC'} this turn`;
        const chipName = document.createElement('span');
        chipName.className = 'npc-chip-name';
        chipName.textContent = 'Reveal real name';
        revealChip.append(chipName);
        revealChip.addEventListener('click', () => {
          const current = partyRowDrafts.get(member.character_id) || { text: area.value, reveal: false };
          partyRowDrafts.set(member.character_id, { ...current, text: area.value, reveal: !current.reveal });
          revealChip.classList.toggle('is-active', !current.reveal);
        });
        row.append(revealChip);
      }
      anchor.after(row);
      anchor = row;
    });
  }

  function collectPartyTurn(leaderText) {
    const party = cachedPartyData?.party;
    const leader = party.members.find((member) => member.is_leader);
    const actions = [{ characterId: leader.character_id, text: leaderText, revealName: leaderRevealSelected }];
    onlinePartyMembers().forEach((member) => {
      const draft = partyRowDrafts.get(member.character_id) || { text: '', reveal: false };
      actions.push({ characterId: member.character_id, text: String(draft.text || '').trim(), revealName: Boolean(draft.reveal) });
    });
    return { partyId: party.id, actions };
  }

  function clearPartyRows() {
    partyRowDrafts.clear();
    leaderRevealSelected = false;
    renderPartyRows();
  }

  const updateActionComposerState = (partyData) => {
    if (!input || !submitButton) return;
    const party = partyData?.party;
    const isMemberInMultiplayerParty = Boolean(
      party &&
      Array.isArray(party.members) &&
      party.members.length > 1 &&
      !party.is_leader
    );

    if (isMemberInMultiplayerParty) {
      const leader = party.members.find((m) => m.is_leader) || { name: 'Party Leader' };
      input.disabled = true;
      input.placeholder = `Waiting for party leader (${leader.name}) to take action...`;
      input.classList.add('is-party-locked');
      submitButton.disabled = true;
      submitButton.classList.add('party-member-locked');
      submitButton.innerHTML = '<span class="party-lock-badge">🔒 Party Member</span><span class="btn-text">Leader Decides</span>';

      const dock = document.querySelector('#quickChoicesDock');
      if (dock) dock.style.display = 'none';
    } else {
      input.disabled = false;
      input.placeholder = 'Describe an action or speak to someone…';
      input.classList.remove('is-party-locked');
      submitButton.disabled = false;
      submitButton.classList.remove('party-member-locked');
      submitButton.innerHTML = '<span class="deepseek-badge">⚡ DeepSeek V4</span><span class="btn-text">Act</span><span class="key-hint">↵</span>';
    }
    renderPartyRows();
    observeUi?.refresh();
  };

  const loadPartyUI = async () => {
    try {
      const data = await getParty();
      cachedPartyData = data;
      renderPartyUI(data);
      renderSceneNpcs(data);
    } catch (error) {
      console.warn('Failed to load party:', error.message);
    }
  };

  const renderPartyUI = (data) => {
    if (!data) return;
    const { party, pendingInvites = [] } = data;
    updateActionComposerState(data);

    // 1. Pending invites badge
    const badge = document.querySelector('#partyNavBadge');
    if (badge) {
      if (pendingInvites.length > 0) {
        badge.textContent = pendingInvites.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // 2. Pending invites list
    const invitesSection = document.querySelector('#partyPendingInvitesSection');
    const invitesList = document.querySelector('#partyPendingInvitesList');
    if (invitesSection && invitesList) {
      invitesList.replaceChildren();
      if (pendingInvites.length > 0) {
        invitesSection.classList.remove('hidden');
        pendingInvites.forEach((invite) => {
          const item = document.createElement('div');
          item.className = 'party-invite-item';
          item.innerHTML = `
            <div class="party-invite-header">
              <b>${invite.inviter_name || 'An adventurer'}</b> invited you to join <b>${invite.party_name}</b>.
            </div>
            <div class="party-invite-actions">
              <button type="button" class="party-btn party-btn-primary" data-accept-invite="${invite.id}">Accept</button>
              <button type="button" class="party-btn party-btn-danger" data-decline-invite="${invite.id}">Decline</button>
            </div>
          `;
          item.querySelector(`[data-accept-invite="${invite.id}"]`)?.addEventListener('click', async (e) => {
            e.target.disabled = true;
            try {
              await respondPartyInvite(invite.id, true);
              notify(`Joined ${invite.party_name}!`);
              await loadPartyUI();
            } catch (err) {
              notify(err.message);
              e.target.disabled = false;
            }
          });
          item.querySelector(`[data-decline-invite="${invite.id}"]`)?.addEventListener('click', async (e) => {
            e.target.disabled = true;
            try {
              await respondPartyInvite(invite.id, false);
              notify('Invite declined.');
              await loadPartyUI();
            } catch (err) {
              notify(err.message);
              e.target.disabled = false;
            }
          });
          invitesList.append(item);
        });
      } else {
        invitesSection.classList.add('hidden');
      }
    }

    const createSection = document.querySelector('#partyCreateSection');
    const activeSection = document.querySelector('#partyActiveSection');

    // 3. Not in a party
    if (!party) {
      setText('#partyTitle', 'Solo Adventurer');
      setText('#partySubtitle', 'Form a party with other players or hire companions.');
      createSection?.classList.remove('hidden');
      activeSection?.classList.add('hidden');
      return;
    }

    // 4. In active party
    createSection?.classList.add('hidden');
    activeSection?.classList.remove('hidden');

    setText('#partyTitle', party.name || 'Adventuring Party');
    setText('#partySubtitle', `${party.member_count} / ${party.max_size} Members`);
    setText('#partyMemberCountLabel', `MEMBERS (${party.member_count} / ${party.max_size})`);

    const inviteBox = document.querySelector('#partyInviteBox');
    if (inviteBox) {
      const canInvite = party.is_leader && party.member_count < party.max_size;
      inviteBox.style.display = canInvite ? 'flex' : 'none';
    }

    // 5. Member cards
    const memberList = document.querySelector('#partyMemberList');
    if (memberList) {
      memberList.replaceChildren();
      party.members.forEach((member) => {
        const card = document.createElement('div');
        card.className = 'party-member-card';

        const roleClass = member.role === PARTY_MEMBER_ROLE.LEADER ? 'leader' : member.character_type === CHARACTER_TYPE.NPC ? 'companion' : 'member';
        const roleLabel = member.role === PARTY_MEMBER_ROLE.LEADER ? 'Leader' : member.character_type === CHARACTER_TYPE.NPC ? 'Companion' : 'Member';
        const visibleEquipment = Object.values(member.equipment || {})
          .filter((item) => item && item.name)
          .map((item) => item.name);
        const equipmentLabel = visibleEquipment.length ? visibleEquipment.join(', ') : 'No visible equipment';

        let companionControls = '';
        if (member.character_type === CHARACTER_TYPE.NPC) {
          const tactics = member.tactics_role || DEFAULT_TACTICS_ROLE;
          const dismissBtn = party.is_leader ? `<button type="button" class="party-btn party-btn-danger" data-dismiss-id="${member.id}" style="font-size:9px;padding:2px 6px;">Dismiss</button>` : '';
          companionControls = `
            <div class="party-companion-settings">
              <div>
                <label for="tactics-${member.id}" style="color:#a395a5;font-size:10px;margin-right:4px;">Tactics:</label>
                <select id="tactics-${member.id}" data-tactics-id="${member.id}">
                  <option value="BALANCED"${tactics === TACTICS_ROLE.BALANCED ? ' selected' : ''}>Balanced</option>
                  <option value="AGGRESSIVE"${tactics === TACTICS_ROLE.AGGRESSIVE ? ' selected' : ''}>Aggressive</option>
                  <option value="TANK"${tactics === TACTICS_ROLE.TANK ? ' selected' : ''}>Tank</option>
                  <option value="HEALER"${tactics === TACTICS_ROLE.HEALER ? ' selected' : ''}>Healer</option>
                </select>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="party-loyalty-score" title="Loyalty & Affection">♥ ${member.relationship_score ?? 0}</span>
                ${dismissBtn}
              </div>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="party-member-header">
            <div class="party-member-avatar">${(member.name || 'A')[0].toUpperCase()}</div>
            <div class="party-member-info">
              <div class="party-member-name-row">
                <span class="party-member-name" title="${member.name}">${member.name}</span>
                <span class="party-role-tag ${roleClass}">${roleLabel}</span>
              </div>
              <span class="party-member-meta">${member.race || 'Unknown'}</span>
            </div>
          </div>
          <div class="party-member-equipment" title="Visible equipped items">${equipmentLabel}</div>
          ${companionControls}
        `;

        const tacticsSelect = card.querySelector(`[data-tactics-id="${member.id}"]`);
        if (tacticsSelect) {
          tacticsSelect.addEventListener('change', async () => {
            try {
              await updateCompanionTactics(member.id, tacticsSelect.value);
              notify(`Updated ${member.name}'s tactics to ${tacticsSelect.value}.`);
            } catch (err) {
              notify(err.message);
            }
          });
        }

        const dismissBtn = card.querySelector(`[data-dismiss-id="${member.id}"]`);
        if (dismissBtn) {
          dismissBtn.addEventListener('click', async () => {
            if (!confirm(`Dismiss ${member.name} from your party?`)) return;
            dismissBtn.disabled = true;
            try {
              await dismissCompanion(member.id);
              notify(`Dismissed ${member.name}.`);
              await loadPartyUI();
            } catch (err) {
              notify(err.message);
              dismissBtn.disabled = false;
            }
          });
        }

        memberList.append(card);
      });
    }
  };

  // ── Render Scene NPCs with Recruit Button ──
  const renderSceneNpcs = (data) => {
    const list = document.querySelector('#sceneNpcList');
    if (!list) return;
    const recruitableNpcs = data?.recruitableNpcs || [];
    const party = data?.party;
    const isPartyLeader = !party || party.is_leader;
    const isPartyFull = party && party.member_count >= party.max_size;

    list.replaceChildren();
    if (!recruitableNpcs.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.style.fontSize = '12px';
      p.textContent = 'No notable figures nearby.';
      list.append(p);
      return;
    }

    recruitableNpcs.forEach((npc) => {
      const card = document.createElement('div');
      card.className = 'scene-npc-card';

      const inParty = party?.members.some((m) => m.character_id === npc.character_id);

      let actionHtml = '';
      if (inParty) {
        actionHtml = '<span class="party-role-tag companion">In Party</span>';
      } else {
        const disabled = isPartyFull || (!isPartyLeader && party);
        const title = isPartyFull ? 'Party is full (4/4)' : !isPartyLeader ? 'Only party leader can recruit' : 'Recruit companion';
        actionHtml = `<button type="button" class="btn-recruit" data-recruit-npc-id="${npc.npc_id}" ${disabled ? 'disabled' : ''} title="${title}">🤝 Recruit</button>`;
      }

      card.innerHTML = `
        <div class="scene-npc-details">
          <span class="scene-npc-name">${npc.name}</span>
          <span class="scene-npc-subtitle">Lv.${npc.level} ${npc.race || ''} ${npc.job || 'Companion'}${npc.appearance ? ` · ${npc.appearance}` : ''}</span>
        </div>
        <div class="scene-npc-actions">
          ${actionHtml}
        </div>
      `;

      const recruitBtn = card.querySelector(`[data-recruit-npc-id="${npc.npc_id}"]`);
      if (recruitBtn) {
        recruitBtn.addEventListener('click', async () => {
          recruitBtn.disabled = true;
          recruitBtn.textContent = 'Recruiting…';
          try {
            await recruitNpc(npc.npc_id);
            notify(`Recruited ${npc.name} to the party!`);
            await loadPartyUI();
          } catch (err) {
            notify(err.message);
            recruitBtn.disabled = false;
            recruitBtn.textContent = '🤝 Recruit';
          }
        });
      }

      list.append(card);
    });
  };

  // Wire Party Form Actions
  document.querySelector('#btnPartyCreate')?.addEventListener('click', async () => {
    const input = document.querySelector('#partyNameInput');
    const name = input?.value?.trim();
    const btn = document.querySelector('#btnPartyCreate');
    if (btn) btn.disabled = true;
    try {
      await createParty(name || undefined);
      notify('Party created successfully!');
      if (input) input.value = '';
      await loadPartyUI();
    } catch (err) {
      notify(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.querySelector('#btnPartyInviteSubmit')?.addEventListener('click', async () => {
    const input = document.querySelector('#partyInviteTargetInput');
    const target = input?.value?.trim();
    if (!target) return notify('Please enter a username or character name.');
    const btn = document.querySelector('#btnPartyInviteSubmit');
    if (btn) btn.disabled = true;
    try {
      await invitePartyMember(target);
      notify(`Party invite sent to ${target}!`);
      if (input) input.value = '';
      await loadPartyUI();
    } catch (err) {
      notify(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.querySelector('#btnPartyLeave')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to leave the party?')) return;
    const btn = document.querySelector('#btnPartyLeave');
    if (btn) btn.disabled = true;
    try {
      await leaveParty();
      notify('You left the party.');
      await loadPartyUI();
    } catch (err) {
      notify(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  startWorldClock();
  const stopStorySocket = connectStorySocket({
    userId: currentUser.id,
    onStatus: (status) => { if (status === 'reconnecting') notify('Live story connection interrupted. Reconnecting…'); },
    onStoryAvailable: async (metadata) => {
      try {
        currentCharacter = await getCharacter(currentUser.id);
        render(currentCharacter);
        renderStory(currentCharacter, feed);
        await loadPartyUI();
        await loadNearbyNpcs();
        notify('A new story update has arrived.');
        if (metadata.encounter?.type === 'combat') await enterCombatRoute(metadata.encounter);
      } catch (error) {
        notify(error.message);
      }
    },
    onAmbienceNotice: (data) => {
      if (!feed || !data.story) return;
      if (data.storyId && conversationHistory.some((item) => item.dbId === data.storyId && item.role === 'assistant')) return;
      const emptyNotice = feed.querySelector('.story-history-empty');
      if (emptyNotice) emptyNotice.remove();
      const noticeEntry = {
        id: `narration_${data.storyId || Date.now()}`,
        dbId: data.storyId || null,
        field: 'story',
        role: 'assistant',
        text: data.story,
        timestamp: data.timestamp || Date.now()
      };
      conversationHistory.push(noticeEntry);
      feed.append(createStoryEntryElement({
        entry: noticeEntry,
        character: currentCharacter,
        npcs: allNpcs.length ? allNpcs : nearbyNpcs,
        onEdit: handleEditEntry,
        onDelete: handleDeleteEntry
      }));
      saveConversationHistory(conversationHistory);
      feed.scrollTop = feed.scrollHeight;
      setText('#storyLastUpdated', `Story updated ${new Date().toLocaleString()}`);
    },
    onPartyEvent: async (type, data) => {
      if (type === WEBSOCKET_EVENTS.PARTY_STORY_TURN) {
        notify(`Party Leader ${data.leaderName || ''} took an action.`);

        const emptyNotice = feed?.querySelector('.story-history-empty');
        if (emptyNotice) emptyNotice.remove();

        const leaderText = `[Leader ${data.leaderName || 'Party Leader'}]: ${data.action || ''}`;
        const playerEntry = {
          id: `action_${data.storyId || Date.now()}`,
          dbId: data.storyId || null,
          field: 'action_from_player',
          role: 'user',
          text: leaderText,
          partyTurn: Array.isArray(data.partyTurn) ? data.partyTurn : null,
          timestamp: data.timestamp || Date.now()
        };
        conversationHistory.push(playerEntry);

        const playerEl = createStoryEntryElement({
          entry: playerEntry,
          character: currentCharacter,
          onEdit: handleEditEntry,
          onDelete: handleDeleteEntry
        });
        feed.append(playerEl);

        if (data.story) {
          const dmEntry = {
            id: `narration_${data.storyId || Date.now()}`,
            dbId: data.storyId || null,
            field: 'story',
            role: 'assistant',
            text: data.story,
            timestamp: (data.timestamp || Date.now()) + 1
          };
          conversationHistory.push(dmEntry);

          const dmEl = createStoryEntryElement({
            entry: dmEntry,
            character: currentCharacter,
            npcs: allNpcs.length ? allNpcs : nearbyNpcs,
            onEdit: handleEditEntry,
            onDelete: handleDeleteEntry
          });
          feed.append(dmEl);
        }

        saveConversationHistory(conversationHistory);
        feed.scrollTop = feed.scrollHeight;
        setText('#storyLastUpdated', `Story updated ${new Date().toLocaleString()}`);
        return;
      }

      if (type === WEBSOCKET_EVENTS.PARTY_MOVED) {
        notify(data.message || 'Your party leader moved the party.');
        try {
          currentCharacter = await getCharacter(currentUser.id);
          render(currentCharacter);
          await loadNearbyNpcs();
        } catch (error) { notify(error.message); }
        await loadPartyUI();
        return;
      }

      const memberName = String(data.memberName || data.name || 'A party member');
      if (type === WEBSOCKET_EVENTS.PARTY_INVITE) {
        notify(`You received a party invite from ${data.inviterName || 'a player'} to join "${data.partyName || 'a party'}"!`);
        setActiveTopNavigation(document.querySelector('#topPartyButton'));
        setMainPage('party');
      } else if (type === WEBSOCKET_EVENTS.PARTY_MEMBER_JOINED) {
        notify(`${memberName} joined the party!`);
      } else if (type === WEBSOCKET_EVENTS.PARTY_MEMBER_LEFT) {
        notify(`${memberName} left the party.`);
      } else if (type === WEBSOCKET_EVENTS.PARTY_DISBANDED) {
        notify('The party has been disbanded.');
      } else if (type === WEBSOCKET_EVENTS.PARTY_COMPANION_RECRUITED) {
        notify(`Recruited companion ${data.name}!`);
      } else if (type === WEBSOCKET_EVENTS.PARTY_COMPANION_DISMISSED) {
        notify(`Dismissed companion ${data.name}.`);
      }
      await loadPartyUI();
    },
    onCombatEvent: async (type, data) => {
      try {
        const activeCheck = await getActiveBattle();
        if (activeCheck?.inCombat && activeCheck.battle) {
          window.location.replace(PAGES.COMBAT);
        }
      } catch (err) {
        console.warn('Combat event sync failed:', err);
      }
    }
  });
  const resourceRefreshTimer = window.setInterval(async () => {
    try {
      currentCharacter = await getCharacter(currentUser.id);
      render(currentCharacter);
    } catch { /* The socket status and normal auth flow handle disconnects. */ }
  }, 75000);
  const characterCreation = initialiseCharacterCreation(async (character) => { notify(`${character.name} is ready at ${character.location.name}.`); try { currentCharacter = await getCharacter(currentUser.id); render(currentCharacter); await loadNpcDirectory(); await loadNearbyNpcs(); await renderStory(); await loadPartyUI(); } catch (error) { notify(error.message); } });
  if (!currentUser.hasCharacter) { characterCreation.open(); }
  else { try { currentCharacter = await getCharacter(currentUser.id); render(currentCharacter); await loadNpcDirectory(); await loadNearbyNpcs(); await renderStory(); await loadPartyUI(); await resumeDialoguesIfAny(); } catch (error) { notify(error.message); } }
  const characterModal = document.querySelector('#characterModal');
  const appShell = document.querySelector('.app-shell');
  const gameStage = document.querySelector('.game-stage');
  const inventoryPage = document.querySelector('#inventoryPage');
  const partyPage = document.querySelector('#partyPage');
  const scenesUi = initScenesContainer({ getCharacterId: () => currentCharacter?.id, getNpcs: () => (nearbyNpcs?.length ? nearbyNpcs : []), notify });
  const topNavigationLinks = document.querySelectorAll('.main-nav a');
  inventoryPage?.append(characterModal);
  characterModal.classList.add('is-page-view');
  function setActiveTopNavigation(link) {
    topNavigationLinks.forEach((item) => {
      const active = item === link;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }
  function setMainPage(page) {
    appShell.dataset.pageView = page;
    gameStage.classList.toggle('hidden', page !== 'explore');
    inventoryPage?.classList.toggle('hidden', page !== 'inventory');
    partyPage?.classList.toggle('hidden', page !== 'party');
    if (page !== 'inventory') {
      characterModal.classList.remove('is-open');
      characterModal.setAttribute('aria-hidden', 'true');
    }
    if (page === 'party') loadPartyUI();
  }
  const openCharacterModal = () => {
    setMainPage('inventory');
    characterModal.classList.add('is-open');
    characterModal.setAttribute('aria-hidden', 'false');
    setActiveTopNavigation(document.querySelector('#topInventoryButton'));
  };
  const closeCharacterModal = () => {
    const wasInventoryPage = appShell.dataset.pageView === 'inventory';
    characterModal.classList.remove('is-open');
    characterModal.setAttribute('aria-hidden', 'true');
    if (wasInventoryPage) {
      setMainPage('explore');
      setActiveTopNavigation(document.querySelector('#topWorldButton'));
    }
  };
  const vaultModal = document.querySelector('#vaultModal');
  const closeVaultModal = () => { vaultModal.classList.remove('is-open'); vaultModal.setAttribute('aria-hidden', 'true'); };
  const itemActionModal = document.querySelector('#itemActionModal');
  itemActionModal?.querySelectorAll('[data-close-item-action]').forEach((button) => button.addEventListener('click', closeItemActionModal));
  const refreshCharacter = async () => { currentCharacter = await getCharacter(currentUser.id); render(currentCharacter); };
  const openVaultModal = async () => { try { renderVault(await getVault(), notify, refreshCharacter); vaultModal.classList.add('is-open'); vaultModal.setAttribute('aria-hidden', 'false'); } catch (error) { notify(error.message); } };

  const moveModal = document.querySelector('#moveModal');
  let currentTravelMap = null;
  let moveModalMode = 'sublocation';
  const openMoveModal = () => {
    if (!currentCharacter) return;
    moveModalMode = 'sublocation';
    renderMoveModal(currentCharacter, { onEnter: handleEnterSublocation, onExit: handleExitSublocation, mode: moveModalMode });
    moveModal?.classList.add('is-open');
    moveModal?.setAttribute('aria-hidden', 'false');
  };
  const openWorldTravelModal = async () => {
    if (!currentCharacter) return;
    moveModalMode = 'world';
    selectedWorldDestinationId = null;
    currentTravelMap = null;
    setMainPage('explore');
    setActiveTopNavigation(document.querySelector('#topJournalButton'));
    moveModal?.classList.add('is-open');
    moveModal?.setAttribute('aria-hidden', 'false');
    renderMoveModal(currentCharacter, { onEnter: handleEnterSublocation, onExit: handleExitSublocation, mode: moveModalMode, onTravel: handleWorldTravel });
    try {
      const travelMap = await getWorldTravelMap(currentUser.id);
      if (moveModalMode !== 'world' || !moveModal?.classList.contains('is-open')) return;
      currentTravelMap = travelMap;
      renderMoveModal(currentCharacter, { mode: 'world', travelMap: currentTravelMap, onTravel: handleWorldTravel });
    } catch (error) {
      document.querySelector('#worldTravelRouteSummary').textContent = error.message;
    }
  };
  const closeMoveModal = () => {
    moveModal?.classList.remove('is-open');
    moveModal?.setAttribute('aria-hidden', 'true');
    if (moveModalMode === 'world') setActiveTopNavigation(document.querySelector('#topWorldButton'));
  };

  const handleEnterSublocation = async (sublocationId) => {
    try {
      const dialogueChoice = await confirmDialogueLeave({ type: 'sublocation', sublocationId });
      if (!dialogueChoice) return;
      selectedTargetNpcId = null;
      const result = await enterSublocation(currentUser.id, sublocationId, dialogueChoice);
      currentCharacter = result.character;
      render(currentCharacter);
      await loadPartyUI();
      await loadNearbyNpcs();
      renderMoveModal(currentCharacter, { onEnter: handleEnterSublocation, onExit: handleExitSublocation, mode: 'sublocation' });
      notify(result.message || 'Entered sublocation.');
      notifyDialogueLeave(result.dialogue);
      if (result.encounter?.type === 'combat') await enterCombatRoute(result.encounter);
      else await resumeDialoguesIfAny();
    } catch (error) {
      notify(error.message);
    }
  };

  const handleExitSublocation = async () => {
    try {
      const dialogueChoice = await confirmDialogueLeave({ type: 'sublocation' });
      if (!dialogueChoice) return;
      selectedTargetNpcId = null;
      const result = await enterSublocation(currentUser.id, null, dialogueChoice);
      currentCharacter = result.character;
      render(currentCharacter);
      await loadPartyUI();
      await loadNearbyNpcs();
      renderMoveModal(currentCharacter, { onEnter: handleEnterSublocation, onExit: handleExitSublocation, mode: 'sublocation' });
      notify(result.message || 'Exited to main area.');
      notifyDialogueLeave(result.dialogue);
      await resumeDialoguesIfAny();
    } catch (error) {
      notify(error.message);
    }
  };

  const handleWorldTravel = async (destinationId) => {
    try {
      const dialogueChoice = await confirmDialogueLeave({ type: 'travel' });
      if (!dialogueChoice) return;
      const result = await travelToLocation(currentUser.id, destinationId, dialogueChoice);
      currentCharacter = result.character;
      selectedWorldDestinationId = null;
      render(currentCharacter);
      await loadPartyUI();
      await loadNearbyNpcs();
      currentTravelMap = await getWorldTravelMap(currentUser.id);
      renderMoveModal(currentCharacter, { mode: 'world', travelMap: currentTravelMap, onTravel: handleWorldTravel });
      notify(result.message || 'Travel complete.');
      notifyDialogueLeave(result.dialogue);
      await resumeDialoguesIfAny();
    } catch (error) {
      notify(error.message);
    }
  };

  const innModal = document.querySelector('#innModal');
  const closeInnModal = (restorePage = true) => {
    innModal?.classList.remove('is-open');
    innModal?.setAttribute('aria-hidden', 'true');
    if (restorePage && appShell.dataset.pageView === 'shop') {
      setMainPage('explore');
      setActiveTopNavigation(document.querySelector('#topWorldButton'));
    }
  };
  const openInnModal = async () => {
    if (currentCharacter?.sublocation?.sublocation_type !== SUBLOCATION_TYPE.INN) return;
    setText('#innTitle', currentCharacter.sublocation.name || 'The Inn');
    setText('#innRestStatus', '');
    try {
      activeShopData = await getShop(currentCharacter.sublocation_id);
      const hostile = Boolean(activeShopData.hostile);
      setText('#innRestButton', hostile ? 'Long rest unavailable' : `Take a long rest · ◈ ${Number(activeShopData.adjusted_long_rest_price ?? 0).toLocaleString()}`);
      setText('#innFoodWaterButton', hostile ? 'Food and water unavailable' : `Restore food and water · ◈ ${Number(activeShopData.adjusted_food_water_refill_price ?? 0).toLocaleString()}`);
      document.querySelector('#innRestButton').disabled = hostile;
      document.querySelector('#innFoodWaterButton').disabled = hostile;
      if (hostile) setText('#innRestStatus', 'The innkeeper is hostile toward you and refuses service.');
    } catch (error) {
      setText('#innRestStatus', error.message);
    }
    innModal?.classList.add('is-open');
    innModal?.setAttribute('aria-hidden', 'false');
  };
  innModal?.querySelectorAll('[data-close-inn]').forEach(button => button.addEventListener('click', closeInnModal));
  document.querySelector('#innRestButton')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    setText('#innRestStatus', 'Resting…');
    try {
      const result = await takeInnLongRest(currentUser.id);
      currentCharacter = result.character;
      render(currentCharacter);
      setText('#innRestStatus', result.message);
      notify(result.message);
    } catch (error) {
      setText('#innRestStatus', error.message);
      notify(error.message);
    } finally {
      button.disabled = Boolean(activeShopData?.hostile);
    }
  });
  document.querySelector('#innFoodWaterButton')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    setText('#innRestStatus', 'Restoring food and water…');
    try {
      const result = await fulfillInnFoodAndWater(currentUser.id);
      currentCharacter = result.character;
      render(currentCharacter);
      setText('#innRestStatus', result.message);
      notify(result.message);
    } catch (error) {
      setText('#innRestStatus', error.message);
      notify(error.message);
    } finally {
      button.disabled = Boolean(activeShopData?.hostile);
    }
  });
  document.querySelector('#innShopButton')?.addEventListener('click', () => {
    closeInnModal(false);
    window.location.assign(PAGES.SHOP);
  });

  let activeShopData = null;
  let shopMode = 'buy';
  const refreshShop = () => {
    if (activeShopData) renderShopModal(activeShopData, currentCharacter.player?.gold || 0, { onBuy: handleBuyShopItem, onSell: handleSellShopItem, character: currentCharacter, mode: shopMode });
  };
  const shopModal = document.querySelector('#shopModal');
  const openShopModal = async () => {
    if (!currentCharacter?.sublocation_id) {
      if (appShell.dataset.pageView === 'shop') {
        setMainPage('explore');
        setActiveTopNavigation(document.querySelector('#topWorldButton'));
      }
      return;
    }
    try {
      activeShopData = await getShop(currentCharacter.sublocation_id);
      refreshShop();
      shopModal?.classList.add('is-open');
      shopModal?.setAttribute('aria-hidden', 'false');
    } catch (error) {
      notify(error.message);
      if (appShell.dataset.pageView === 'shop') {
        setMainPage('explore');
        setActiveTopNavigation(document.querySelector('#topWorldButton'));
      }
    }
  };
  const closeShopModal = () => {
    shopModal?.classList.remove('is-open');
    shopModal?.setAttribute('aria-hidden', 'true');
    if (appShell.dataset.pageView === 'shop') {
      setMainPage('explore');
      setActiveTopNavigation(document.querySelector('#topWorldButton'));
    }
  };

  const handleSellShopItem = (entry, name) => {
    const unitPrice = Math.floor((entry.item.price ?? 0) * 7 / 10);
    const owned = entry.quantity ?? 1;
    promptItemAction({
      eyebrow: 'SELL TO MERCHANT',
      title: 'Sell ' + name,
      message: 'Choose the quantity to sell.',
      details: '<label for="shopSellQty">Quantity (owned: ×' + owned + '):</label><input id="shopSellQty" type="number" min="1" max="' + owned + '" step="1" value="1" style="width:80px;padding:5px;border:1px solid #554a51;background:#17131a;color:#fff;text-align:center;font-size:13px;font-family:monospace;border-radius:4px;" /><span id="shopSellTotal" aria-live="polite"></span>',
      confirmText: 'Sell',
      onConfirm: async () => {
        const input = document.querySelector('#shopSellQty');
        const quantity = Number(input.value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > owned) {
          notify('Enter a whole-number quantity within the selected stack.');
          throw new Error('Invalid quantity.');
        }
        input.disabled = true;
        try {
          const result = await sellShopItem(currentUser.id, { sublocationId: activeShopData.id, inventoryEntryId: entry.id, quantity });
          currentCharacter = result.character;
          render(currentCharacter);
          refreshShop();
          notify(result.message);
        } catch (error) {
          notify(error.message);
          throw error;
        } finally {
          input.disabled = false;
        }
      }
    });
    const input = document.querySelector('#shopSellQty');
    const updateTotal = () => {
      const quantity = Number(input.value);
      const total = unitPrice * quantity;
      const valid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= owned && Number.isSafeInteger(total) && unitPrice >= 0;
      setText('#shopSellTotal', valid ? 'You receive: ◈ ' + total.toLocaleString() + ' (◈ ' + unitPrice.toLocaleString() + ' each)' : 'Enter a whole-number quantity within the selected stack.');
      setText('#itemActionMessage', valid ? 'Sell ×' + quantity + ' ' + name + '?' : 'Choose the quantity to sell.');
      document.querySelector('#itemActionConfirmButton').disabled = !valid;
    };
    input.addEventListener('input', updateTotal);
    updateTotal();
    input.focus();
    input.select();
  };
  document.querySelector('#shopBuyMode')?.addEventListener('click', () => { shopMode = 'buy'; refreshShop(); });
  document.querySelector('#shopSellMode')?.addEventListener('click', () => { shopMode = 'sell'; refreshShop(); });

  const handleBuyShopItem = (item) => {
    if (!item) return;
    const isInn = activeShopData?.sublocation_type === SUBLOCATION_TYPE.INN;
    const price = Number(item.price || 0);
    promptItemAction({
      eyebrow: isInn ? 'INN PURCHASE' : 'MERCHANT COMMERCE',
      title: `Buy ${item.name}`,
      message: `Purchase 1x ${item.name} for ◈ ${price.toLocaleString()} gold?`,
      details: `<strong>${item.name}</strong><span>Type: ${item.type}</span><span>Unit price: ◈ ${price.toLocaleString()}</span>${item.description ? `<span>${item.description}</span>` : ''}
        <label for="shopPurchaseQty">Quantity:</label>
        <input id="shopPurchaseQty" type="number" min="1" max="2147483647" step="1" value="1" style="width:80px;padding:5px;border:1px solid #554a51;background:#17131a;color:#fff;text-align:center;font-size:13px;font-family:'DM Mono',monospace;border-radius:4px;" />
        <span id="shopPurchaseTotal" aria-live="polite"></span>`,
      confirmText: 'Purchase',
      onConfirm: async () => {
        const quantityInput = document.querySelector('#shopPurchaseQty');
        const quantity = Number(quantityInput?.value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) {
          notify('Enter a positive whole-number quantity.');
          throw new Error('Invalid quantity.');
        }
        quantityInput.disabled = true;
        try {
          const result = await buyShopItem(currentUser.id, {
            sublocationId: currentCharacter.sublocation_id,
            itemId: item.id,
            quantity
          });
          currentCharacter = result.character;
          render(currentCharacter);
          notify(result.message || `Purchased ${item.name}!`);
          if (activeShopData) {
            refreshShop();
          }
        } catch (error) {
          notify(error.message);
          throw error;
        } finally {
          quantityInput.disabled = false;
        }
      }
    });
    const quantityInput = document.querySelector('#shopPurchaseQty');
    const updatePurchaseTotal = () => {
      const quantity = Number(quantityInput.value);
      const total = price * quantity;
      const valid = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 2147483647 && Number.isSafeInteger(total) && price >= 0;
      const canAfford = valid && total <= (currentCharacter.player?.gold ?? 0);
      setText('#shopPurchaseTotal', valid ? `Total: ◈ ${total.toLocaleString()}${canAfford ? '' : ' — Not enough gold'}` : 'Enter a positive whole-number quantity.');
      setText('#itemActionMessage', valid ? `Purchase ×${quantity} ${item.name} for ◈ ${total.toLocaleString()} gold?` : 'Choose the quantity to purchase.');
      document.querySelector('#itemActionConfirmButton').disabled = !canAfford;
    };
    quantityInput.addEventListener('input', updatePurchaseTotal);
    updatePurchaseTotal();
    quantityInput.focus();
    quantityInput.select();
  };

  const renderQuickChoices = (choices = []) => {
    let dock = document.querySelector('#quickChoicesDock');
    if (!dock && form) {
      dock = document.createElement('div');
      dock.id = 'quickChoicesDock';
      dock.className = 'quick-choices-dock';
      form.parentNode.insertBefore(dock, form);
    }
    if (!dock) return;
    dock.replaceChildren();
    if (!choices || !choices.length) {
      dock.style.display = 'none';
      return;
    }
    dock.style.display = 'flex';
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-choice-btn';
      button.dataset.action = choice;
      const num = index + 1;
      button.innerHTML = `<span>${choice}</span><kbd>${num}</kbd>`;
      button.addEventListener('click', () => act(choice));
      dock.append(button);
    });
  };

  const act = async (action, options = {}) => {
    const cleanAction = typeof action === 'string' ? action.trim() : '';
    const partyPayload = partyTurnMode() && !options.revealNpcId ? collectPartyTurn(cleanAction) : null;
    if (partyPayload && !partyPayload.actions.some((entry) => entry.text || entry.revealName)) return;
    if (!partyPayload && !cleanAction) return;
    if (!aiKeyUi.ensure()) return;

    // Guard: Only the party leader can take actions while in a multiplayer party
    const party = cachedPartyData?.party;
    if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
      notify('Only the party leader can take actions for the party.');
      return;
    }

    if (!conversationHistory || conversationHistory.length === 0) {
      conversationHistory = await loadConversationHistory();
    }

    const playerEntry = {
      id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: cleanAction,
      partyTurn: partyPayload ? partyPayload.actions.filter((entry) => entry.text).map((entry) => ({ characterId: entry.characterId, label: cachedPartyData.party.members.find((member) => member.character_id === entry.characterId)?.name || '', text: entry.text })) : null,
      fateCheck: options.fateCheck || null,
      skillCheck: options.skillCheck ? { ...options.skillCheck, order: options.checkOrder || null } : null,
      timestamp: Date.now()
    };
    conversationHistory.push(playerEntry);
    saveConversationHistory(conversationHistory);

    const emptyNotice = feed?.querySelector('.story-history-empty');
    if (emptyNotice) emptyNotice.remove();

    let playerEl = createStoryEntryElement({
      entry: playerEntry,
      character: currentCharacter,
      onEdit: handleEditEntry,
      onDelete: handleDeleteEntry
    });
    feed.append(playerEl);
    feed.scrollTop = feed.scrollHeight;

    input.value = '';

    const originalButtonHtml = submitButton ? submitButton.innerHTML : 'Send <span>↵</span>';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('is-thinking');
      submitButton.innerHTML = '<span class="deepseek-badge">⚡ DeepSeek V4</span><span class="btn-text">DM thinking…</span>';
    }
    input.disabled = true;

    const statusEl = appendStoryStatus(feed, 'DeepSeek V4 Dungeon Master is considering your action…');

    try {
      const result = await sendGameAction(currentUser.id, cleanAction, conversationHistory, true, ACTION_MODES.STORY, selectedTargetNpcId, options.revealNpcId || null, partyPayload, options.fateCheck?.id || null, options.skillCheck?.id || null, options.checkOrder || null, options.playerTools || null);
      if (partyPayload) clearPartyRows();
      if (partyPayload && result.action) {
        playerEntry.text = result.action;
        playerEntry.partyTurn = Array.isArray(result.partyTurn) ? result.partyTurn : playerEntry.partyTurn;
        saveConversationHistory(conversationHistory);
        const refreshedEl = createStoryEntryElement({ entry: playerEntry, character: currentCharacter, onEdit: handleEditEntry, onDelete: handleDeleteEntry });
        playerEl.replaceWith(refreshedEl);
        playerEl = refreshedEl;
      }
      if (result.contextCheck) {
        lastTurnContextCheck = result.contextCheck;
        if (contextCheckModal?.classList.contains('is-open')) renderContextCheck(result.contextCheck);
      }
      statusEl.remove();

      if (result.story) {
        let dbId = result.storyId || null;
        if (!dbId && currentCharacter?.id) {
          try {
            const created = await createStoryTurn(currentCharacter.id, {
              action_from_player: playerEntry.text,
              story: result.story
            });
            if (created?.story?.id) {
              dbId = created.story.id;
            }
          } catch (dbErr) {
            console.warn('Unable to persist turn to database:', dbErr);
          }
        }
        playerEntry.dbId = dbId;
        playerEntry.field = 'action_from_player';
        playerEntry.dialogueSessionId = result.dialogueSessionId || null;
        playerEntry.dialogueMessageIds = result.dialogueMessageIds || [];

        const dmEntry = {
          id: `narration_${dbId || Date.now()}`,
          dbId,
          targetNpcId: selectedTargetNpcId,
          field: 'story',
          role: 'assistant',
          text: result.story,
          dialogueSessionId: result.dialogueSessionId || null,
          dialogueMessageIds: result.dialogueMessageIds || [],
          timestamp: Date.now()
        };
        conversationHistory.push(dmEntry);
        saveConversationHistory(conversationHistory);

        const dmEl = createStoryEntryElement({
          entry: dmEntry,
          character: result.character || currentCharacter,
          npcs: allNpcs.length ? allNpcs : nearbyNpcs,
          onEdit: handleEditEntry,
          onDelete: handleDeleteEntry
        });
        feed.append(dmEl);
        feed.scrollTop = feed.scrollHeight;
      }

      if (result.character) {
        currentCharacter = result.character;
        render(currentCharacter);
        await loadNearbyNpcs();
      }
      setText('#storyLastUpdated', `Story updated ${new Date().toLocaleString()}`);

      // Dynamic quick action suggestions
      if (Array.isArray(result.choices)) {
        renderQuickChoices(result.choices);
      }

      // Dynamic memory recording feedback
      if (result.memory) {
        notify(`New Memory: "${result.memory}"`);
      }
      if (Array.isArray(result.sceneChanges) && result.sceneChanges.length) {
        result.sceneChanges.forEach((change) => {
          if (change.type === 'created') notify(`New scene: ${change.scene?.scene_goal || 'a new hook'}`);
          if (change.type === 'solved') notify(`Scene solved: ${change.scene?.scene_goal || ''}`);
        });
        if (scenesUi.isOpen?.()) scenesUi.refresh();
      }

      // Dynamic combat encounter trigger
      if (result.encounter?.type === 'combat') {
        notify(`Hostile encounter! ${result.encounter.name} appears!`);
        await enterCombatRoute(result.encounter);
      } else if (result.isMockFallback) {
        notify('The Dungeon Master used offline narration. Check your AI API key with the "Enter AI API key" button.');
      } else {
        notify('DeepSeek V4 Dungeon Master responded.');
      }
      if (result.dialogueClosed && result.encounter?.type !== 'combat') notify(`Conversation with ${result.dialogueClosed.npcName} ended.`);
      return Boolean(result.story);
    } catch (error) {
      statusEl.remove();
      notify(error.message || 'The Dungeon Master was unable to respond.');
      appendStoryStatus(feed, `DM Error: ${error.message || 'Unable to process action.'}`);
      return false;
    } finally {
      updateActionComposerState(cachedPartyData);
      if (!input.disabled) {
        input.focus();
      }
    }
  };

  const checksUi = initChecksContainer({
    getCharacterId: () => currentCharacter?.id,
    getComposerText: () => input?.value.trim() || '',
    canUseChecks: () => {
      if (partyTurnMode()) {
        notify('Checks use your own action. Leave party turn mode first.');
        return false;
      }
      const party = cachedPartyData?.party;
      if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
        notify('Only the party leader can roll checks.');
        return false;
      }
      return Boolean(currentCharacter?.id);
    },
    notify,
    onReady: (actionText, checks) => act(actionText, checks)
  });
  document.querySelector('#checksButton')?.addEventListener('click', () => checksUi.open());

  const toolsCallUi = initToolsCallContainer({
    getTargetNpc: () => nearbyNpcs.find((npc) => npc.id === selectedTargetNpcId) || null,
    getComposerText: () => input?.value.trim() || '',
    canUseTools: () => {
      if (partyTurnMode()) {
        notify('Tool calls use your own action. Leave party turn mode first.');
        return false;
      }
      const party = cachedPartyData?.party;
      if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
        notify('Only the party leader can call tools.');
        return false;
      }
      return Boolean(currentCharacter?.id);
    },
    notify,
    onReady: (actionText, options) => act(actionText, options)
  });
  document.querySelector('#toolsCallButton')?.addEventListener('click', () => toolsCallUi.open());

  const combatSelectUi = initCombatSelectContainer({
    canStartCombat: () => {
      if (partyTurnMode()) {
        notify('Combat uses your own action. Leave party turn mode first.');
        return false;
      }
      const party = cachedPartyData?.party;
      if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
        notify('Only the party leader can start combat.');
        return false;
      }
      return Boolean(currentCharacter?.id);
    },
    notify,
    onStart: async (targets) => {
      if (combatStartPending) return false;
      combatStartPending = true;
      try {
        const { battle } = await startAreaEncounter(targets);
        if (battle?.status === BATTLE_STATUS.IN_PROGRESS) {
          notify(`Hostile encounter! ${battle.encounter?.name || 'Your foes'} appear!`);
          window.location.replace(PAGES.COMBAT);
          return true;
        }
        notify('The battle could not begin.');
        return false;
      } catch (error) {
        notify(error.message || 'Unable to start the battle.');
        return false;
      } finally {
        combatStartPending = false;
      }
    }
  });
  document.querySelector('#combatButton')?.addEventListener('click', () => combatSelectUi.open());

  const isPartyFollower = () => {
    const party = cachedPartyData?.party;
    return Boolean(party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader);
  };

  const runObserve = async ({ npcA, npcB, repeatCount, direction }) => {
    if (isPartyFollower()) {
      notify('Only the party leader can take actions for the party.');
      return false;
    }
    if (!aiKeyUi.ensure()) return false;
    if (!conversationHistory || conversationHistory.length === 0) {
      conversationHistory = await loadConversationHistory();
    }
    const historyForRequest = [...conversationHistory];
    const playerEntry = {
      id: `observe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: `[Observe ×${repeatCount}] ${npcA.name} & ${npcB.name}${direction ? ` — ${direction}` : ''}`,
      timestamp: Date.now()
    };
    conversationHistory.push(playerEntry);
    saveConversationHistory(conversationHistory);

    feed?.querySelector('.story-history-empty')?.remove();
    let playerEl = createStoryEntryElement({ entry: playerEntry, character: currentCharacter, onEdit: handleEditEntry, onDelete: handleDeleteEntry });
    feed.append(playerEl);
    feed.scrollTop = feed.scrollHeight;

    observeBusy = true;
    observeUi?.refresh();
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="deepseek-badge">⚡ DeepSeek V4</span><span class="btn-text">Watching…</span>';
    }
    if (input) input.disabled = true;
    const statusEl = appendStoryStatus(feed, `You watch ${npcA.name} and ${npcB.name} quietly… (${repeatCount * 2} lines)`);

    try {
      const result = await sendObserveAction(currentUser.id, { observeNpcAId: npcA.id, observeNpcBId: npcB.id, repeatCount, direction, history: historyForRequest });
      statusEl.remove();
      if (result.action && result.action !== playerEntry.text) {
        playerEntry.text = result.action;
        const refreshedEl = createStoryEntryElement({ entry: playerEntry, character: currentCharacter, onEdit: handleEditEntry, onDelete: handleDeleteEntry });
        playerEl.replaceWith(refreshedEl);
        playerEl = refreshedEl;
      }
      if (result.story) {
        const dbId = result.storyId || null;
        playerEntry.dbId = dbId;
        playerEntry.field = 'action_from_player';
        const dmEntry = { id: `narration_${dbId || Date.now()}`, dbId, field: 'story', role: 'assistant', text: result.story, timestamp: Date.now() };
        conversationHistory.push(dmEntry);
        saveConversationHistory(conversationHistory);
        const dmEl = createStoryEntryElement({ entry: dmEntry, character: result.character || currentCharacter, npcs: allNpcs.length ? allNpcs : nearbyNpcs, onEdit: handleEditEntry, onDelete: handleDeleteEntry });
        feed.append(dmEl);
        feed.scrollTop = feed.scrollHeight;
      } else {
        saveConversationHistory(conversationHistory);
      }
      if (result.character) {
        currentCharacter = result.character;
        render(currentCharacter);
        await loadNearbyNpcs();
      }
      setText('#storyLastUpdated', `Story updated ${new Date().toLocaleString()}`);
      notify(`You watched ${npcA.name} and ${npcB.name}.`);
      return Boolean(result.story);
    } catch (error) {
      statusEl.remove();
      notify(error.message || 'The Dungeon Master could not run the observed scene.');
      appendStoryStatus(feed, `DM Error: ${error.message || 'Unable to observe.'}`);
      return false;
    } finally {
      observeBusy = false;
      updateActionComposerState(cachedPartyData);
      if (input && !input.disabled) input.focus();
    }
  };

  observeUi = initObserveContainer({
    getNpcs: () => nearbyNpcs,
    getBlockReason: () => observeBlockReason({
      npcs: nearbyNpcs,
      partyTurn: partyTurnMode(),
      nonLeader: isPartyFollower(),
      busy: observeBusy || Boolean(input?.disabled && !isPartyFollower())
    }),
    notify,
    onReady: (payload) => runObserve(payload)
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    act(input.value);
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target === input || event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
    if (event.key >= '1' && event.key <= '3') {
      const buttons = document.querySelectorAll('.quick-choice-btn');
      const target = buttons[Number(event.key) - 1];
      if (target) {
        event.preventDefault();
        target.click();
      }
    }
  });

  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => act(button.dataset.action)));
  document.querySelector('#clearHistoryBtn')?.addEventListener('click', async () => {
    if (confirm('Clear entire conversation history? This cannot be undone.')) {
      conversationHistory = [];
      lastTurnContextCheck = null;
      saveConversationHistory(conversationHistory);
      renderHistoryFeed();
      if (currentCharacter?.id) {
        try {
          await clearStoryHistory(currentCharacter.id);
          notify('Conversation history cleared from database.');
        } catch (err) {
          notify(`Failed to clear database history: ${err.message}`);
        }
      } else {
        notify('Conversation history cleared.');
      }
    }
  });
  document.querySelector('#battleButton')?.addEventListener('click', () => notify('Open an encounter from the live story.'));
  document.querySelector('#topWorldButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    setActiveTopNavigation(event.currentTarget);
    setMainPage('explore');
    document.querySelector('.scene-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('#topPartyButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    setActiveTopNavigation(event.currentTarget);
    setMainPage('party');
  });
  document.querySelector('#topInventoryButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    openCharacterModal();
  });
  document.querySelector('#topJournalButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    openWorldTravelModal();
  });
  document.querySelector('#scenesButton')?.addEventListener('click', () => scenesUi.open());
  document.querySelector('#topShopButton')?.addEventListener('click', (event) => {
    event.preventDefault();
    const shopButton = document.querySelector('#shopTabButton');
    const sublocationType = currentCharacter?.sublocation?.sublocation_type;
    if (!shopButton || shopButton.hidden || !currentCharacter?.sublocation_id || !TRADING_SUBLOCATION_TYPES.includes(sublocationType)) {
      notify('A shop is not available at this location.');
      return;
    }
    window.location.assign(PAGES.SHOP);
  });
  document.querySelector('#vaultButton')?.addEventListener('click', openVaultModal);
  vaultModal.querySelectorAll('[data-close-vault]').forEach((button) => button.addEventListener('click', closeVaultModal));
  const campfireModal = document.querySelector('#campfireModal');
  const closeCampfireModal = () => { campfireModal?.classList.remove('is-open'); campfireModal?.setAttribute('aria-hidden', 'true'); };
  const renderCampfire = (data) => {
    const tentButton = document.querySelector('#campfireTentButton');
    if (tentButton) tentButton.disabled = !data.has_tent;
    setText('#campfireTentNote', data.has_tent ? 'Sleep in your Camping Tent. Restores full energy and full HP.' : `Requires a ${data.tent_item_name || 'Camping Tent'} in your backpack. Restores full energy and full HP.`);
    setText('#campfireStatus', `Energy ${data.current_energy} / ${data.max_energy} · HP ${data.current_hp} / ${data.max_hp}`);
  };
  const openCampfireModal = async () => {
    try { renderCampfire(await getCampfire()); campfireModal?.classList.add('is-open'); campfireModal?.setAttribute('aria-hidden', 'false'); } catch (error) { notify(error.message); }
  };
  document.querySelector('#campfireButton')?.addEventListener('click', openCampfireModal);
  document.querySelector('#trainingButton')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await startTraining();
      window.location.replace(PAGES.COMBAT);
    } catch (error) {
      notify(error.message);
      button.disabled = false;
    }
  });
  campfireModal?.querySelectorAll('[data-close-campfire]').forEach((button) => button.addEventListener('click', closeCampfireModal));
  campfireModal?.querySelectorAll('[data-campfire-mode]').forEach((button) => button.addEventListener('click', async () => {
    campfireModal.querySelectorAll('[data-campfire-mode]').forEach((entry) => { entry.disabled = true; });
    try {
      const result = await restAtCampfire(button.dataset.campfireMode);
      notify(result.message);
      closeCampfireModal();
      await refreshCharacter();
    } catch (error) {
      notify(error.message);
      try { renderCampfire(await getCampfire()); } catch { closeCampfireModal(); }
    } finally {
      document.querySelector('#campfireRestButton')?.removeAttribute('disabled');
    }
  }));
  npcsButton?.addEventListener('click', openNpcsModal);
  npcsModal?.querySelectorAll('[data-close-npcs]').forEach((button) => button.addEventListener('click', closeNpcsModal));
  questsButton?.addEventListener('click', openQuestsModal);
  questsModal?.querySelectorAll('[data-close-quests]').forEach((button) => button.addEventListener('click', closeQuestsModal));
  document.querySelector('#moveButton')?.addEventListener('click', openMoveModal);
  moveModal?.querySelectorAll('[data-close-move]').forEach((button) => button.addEventListener('click', closeMoveModal));
  document.querySelector('#shopTabButton')?.addEventListener('click', () => {
    const sublocationType = currentCharacter?.sublocation?.sublocation_type;
    if (sublocationType === SUBLOCATION_TYPE.INN) {
      openInnModal();
      return;
    }
    if (sublocationType === SUBLOCATION_TYPE.SHOP && currentCharacter?.sublocation_id) {
      window.location.assign(PAGES.SHOP);
      return;
    }
    notify('A shop is not available at this location.');
  });
  shopModal?.querySelectorAll('[data-close-shop]').forEach((button) => button.addEventListener('click', closeShopModal));
  document.querySelectorAll('.stat-grid [data-stat]').forEach((button) => button.addEventListener('click', async () => { if (!currentCharacter) return; const label = button.querySelector('span')?.textContent || button.dataset.stat; if (!window.confirm(`Spend the required points to increase ${label}?`)) return; button.disabled = true; try { const result = await upgradeCharacterStat(currentUser.id, button.dataset.stat); currentCharacter = result.character; render(currentCharacter); notify(`${label} increased by 1.`); } catch (error) { notify(error.message); } finally { button.disabled = numericValue(currentCharacter?.player?.current_point_spend ?? currentCharacter?.current_point_spend) <= 0; } }));
  characterModal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeCharacterModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeContextCheck();
      closeItemActionModal();
      scenesUi.close();
      closeCharacterModal();
      closeVaultModal();
      closeNpcsModal();
      closeQuestsModal();
      closeMoveModal();
      closeShopModal();
      closeInnModal();
      closeGatheringModal();
      closeFishingModal();
      closeFarmingModal();
    }
  });
  initGatheringContainer();
  initFishingContainer();
  initFarmingContainer();
  initializeSettingsMenu(async () => { try { await logout(); } finally { window.location.assign(PAGES.LOGIN); } });
  const initialHash = window.location.hash;
  if (initialHash === '#partyPage') {
    setActiveTopNavigation(document.querySelector('#topPartyButton'));
    setMainPage('party');
  } else if (initialHash === '#inventoryPage') {
    openCharacterModal();
  } else if (initialHash === '#worldTravel') {
    openWorldTravelModal();
  }
  window.addEventListener('pagehide', () => { stopStorySocket(); window.clearInterval(resourceRefreshTimer); }, { once: true });
  const pendingDefeatAction = sessionStorage.getItem(defeatActionStorageKey);
  if (pendingDefeatAction && currentCharacter) {
    try {
      const activeBattle = await getActiveBattle();
      if (!activeBattle?.inCombat) {
        if (await act(pendingDefeatAction)) sessionStorage.removeItem(defeatActionStorageKey);
      }
    } catch (error) {
      notify(error.message || 'Unable to resume the story after defeat.');
    }
  }
  const pendingFleeAction = sessionStorage.getItem(fleeActionStorageKey);
  if (pendingFleeAction && currentCharacter) {
    try {
      const activeBattle = await getActiveBattle();
      if (!activeBattle?.inCombat && await act(pendingFleeAction)) sessionStorage.removeItem(fleeActionStorageKey);
    } catch (error) {
      notify(error.message || 'Unable to resume the story after escape.');
    }
  }
}
