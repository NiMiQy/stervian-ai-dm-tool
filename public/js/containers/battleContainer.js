import { performBattleAction, resetTraining, updateTrainingConfig } from '../logics/authApi.js';
import {
  BATTLE_ANIMATION_SETTLE_MS,
  BATTLE_ANIMATION_STEP_MS,
  BATTLE_STATUS,
  SKILL_MENU_TYPE,
  TAUNT_SKILL_NAME,
} from '../constants.js';

const pct = (current, max) => max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function enemyArtworkMarkup(enemy) {
  const name = String(enemy.name || '').toLowerCase();
  if (name.includes('reaper')) {
    return `<svg class="enemy-art reaper-art" viewBox="0 0 180 300" role="img" aria-label="${escapeHtml(enemy.name)}">
      <path class="scythe" d="M34 276 85 102M35 276 23 289M84 102 103 79" />
      <path class="scythe-edge" d="M103 79Q141 33 157 20Q153 62 113 88" />
      <path class="cloak-back" d="M61 103 89 80 121 99 146 167 164 255 127 242 105 286 77 248 46 277 36 202Z" />
      <path class="cloak" d="M72 103 91 91 112 101 130 145 118 212 136 267 101 248 80 275 72 224 46 245 57 180 43 147Z" />
      <path class="armor" d="m79 133 13-15 17 13-4 29-14 19-17-20Z" />
      <path class="bone" d="m88 147 12 8m-16 4 18 8m-19 1 17 8m-18-3 8 28m12-32-7 30m-4-8-16 13m24-14 17 13" />
      <path class="hood" d="M68 111Q64 78 91 58Q119 77 116 112L107 131 79 132Z" />
      <path class="face" d="M79 105 90 94 104 105 101 121 91 128 82 120Z" />
      <circle class="eye" cx="86" cy="109" r="3" /><circle class="eye" cx="98" cy="109" r="3" />
    </svg>`;
  }

  if (name.includes('golem')) {
    return `<svg class="enemy-art golem-art" viewBox="0 0 240 270" role="img" aria-label="${escapeHtml(enemy.name)}">
      <ellipse class="golem-shadow" cx="121" cy="246" rx="91" ry="17" />
      <path class="golem-rock rock-a" d="m72 69 23-34 39 9 23 36-14 41-47 9-34-27Z" />
      <path class="golem-rock rock-b" d="m74 113-38 4-22 34 27 37 43-7 22-38Z" />
      <path class="golem-rock rock-c" d="m153 112 39-11 30 30-8 43-42 21-28-37Z" />
      <path class="golem-rock rock-d" d="m82 103 46-22 43 28 8 57-34 45-66-8-19-49Z" />
      <path class="golem-rock rock-e" d="m47 179 36 8 18 37-23 17-42-24Zm130-6 30-13 18 31-30 29-31-12Z" />
      <path class="golem-crack" d="m81 116 22 18-9 18 18 12m27-48-13 24 15 13-8 34m-43-19 16 8-8 17" />
      <circle class="core-halo" cx="126" cy="145" r="25" />
      <path class="core" d="m126 126 14 10v18l-14 11-15-11v-18Z" />
      <path class="core-glint" d="m122 132 6 4-5 7-5-5Z" />
    </svg>`;
  }

  return `<span class="enemy-sprite-icon" aria-hidden="true">${escapeHtml(enemy.sprite || '🐺')}</span>`;
}

export function initialiseBattleModal(characterSupplier = () => null, onResult = () => {}, characterGetter = () => null, options = {}) {
  const modal = document.querySelector('#battleModal');
  if (!modal) return { open: () => {}, openWithExistingState: () => {}, close: () => {}, refreshState: () => {}, isOpen: () => false };
  const resultModal = document.querySelector('#battleResultModal');
  const onResultDismiss = options.onResultDismiss;
  const onStateChange = options.onStateChange;
  const $ = (selector) => modal.querySelector(selector);
  const turn = $('#battleTurnCounter'); const track = $('#initiativePillList'); const enemies = $('#battleEnemiesList'); const party = $('#battlePartyList'); const log = $('#battleLogMessage'); const historyEntries = $('#battleHistoryEntries'); const quoteText = $('#enemyQuoteText'); const quoteName = $('#enemyQuoteName'); const inventory = $('#battleInventoryGrid'); const slots = $('#spellSlotChoices'); const spellTitle = $('#selectedSpellTitle');
  const menus = { main: $('#battleMenuMain'), attack: $('#battleSubmenuAttack'), magic_attack: $('#battleSubmenuMagicAttack'), defend: $('#battleSubmenuDefend'), spells: $('#battleSubmenuSpells'), spell_points: $('#battleSubmenuSpellPoints'), inventory: $('#battleSubmenuInventory') };
  const commandButtons = ['#btnMenuAttack', '#btnMenuMagicAttack', '#btnMenuDefend', '#btnMenuSpells', '#btnMenuInventory', '#btnMenuEscape'].map($);
  const skillTypeLabels = { ATTACK: 'Atk', MAGIC_ATTACK: 'M.Atk', DEFEND: 'Def', SPELL: 'Spell' };
  let state = null; let busy = false; let resultStatus = null;
  const battleCloseTriggers = [...modal.querySelectorAll('[data-close-battle]')];
  const handleBeforeUnload = (event) => { if (state?.status === BATTLE_STATUS.IN_PROGRESS) { event.preventDefault(); event.returnValue = 'Combat is in progress. Leaving will not exit or reset the battle.'; } };

  function updateDismissalLock() {
    const locked = state?.status === BATTLE_STATUS.IN_PROGRESS;
    battleCloseTriggers.forEach((element) => { element.disabled = locked; element.hidden = locked; element.setAttribute('aria-hidden', locked ? 'true' : 'false'); });
  }

  function getMyHero() {
    if (!state?.party?.length) return null;
    const localChar = typeof characterGetter === 'function' ? characterGetter() : null;
    if (localChar) {
      const found = state.party.find(
        (h) => (h.characterId && h.characterId === localChar.id) ||
               (h.userId && h.userId === localChar.user_id)
      );
      if (found) return found;
    }
    return state.party.find((h) => h.id === 'player') || state.party[0];
  }

  function isMyTurn() {
    const myHero = getMyHero();
    return Boolean(myHero && state?.currentActorId === myHero.id && !myHero.isDefeated);
  }

  function updateCommandAvailability() {
    const myTurn = isMyTurn();
    commandButtons.forEach((button) => {
      if (button) button.disabled = !myTurn || busy;
    });
    const inventoryButton = $('#btnMenuInventory');
    if (inventoryButton && state?.isTraining) inventoryButton.disabled = true;
    if (!myTurn && state?.status === BATTLE_STATUS.IN_PROGRESS) {
      const currentActor = [...(state.party || []), ...(state.enemies || [])].find((u) => u.id === state.currentActorId);
      if (currentActor) {
        setLog(`Waiting for ${currentActor.name}'s turn...`);
      }
    }
  }

  const pause = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  function renderLogPanels() {
    const history = Array.isArray(state?.log) ? state.log.map((entry) => String(entry)) : [];
    if (!history.length && state?.enemies?.length) {
      state.enemies.forEach((enemy, index) => history.push(`${index === 0 ? 'A wild ' : ''}${enemy.name} appeared!`));
      history.push('Your party is ready for battle.');
    }
    const latestMessage = log?.textContent.trim();
    if (latestMessage && history.at(-1) !== latestMessage) history.push(latestMessage);

    if (historyEntries) {
      historyEntries.replaceChildren(...(history.length ? history : ['The battle record is ready.']).map((entry) => {
        const line = document.createElement('p');
        line.textContent = entry;
        return line;
      }));
      historyEntries.scrollTop = historyEntries.scrollHeight;
    }
  }

  const setLog = (message) => {
    if (log) log.textContent = message;
    renderLogPanels();
  };
  const trainingPanel = $('#trainingPanel');
  const trainingForm = $('#trainingConfigForm');
  const escapeButton = $('#btnMenuEscape');
  const escapeLabels = escapeButton ? { title: escapeButton.querySelector('strong')?.textContent, sub: escapeButton.querySelector('span')?.textContent } : null;

  function fillTrainingForm(config) {
    if (!trainingForm || !config) return;
    [...trainingForm.elements].forEach((input) => {
      if (!input.name) return;
      const [group, key] = input.name.split('.');
      const value = key ? config[group]?.[key] : config[group];
      if (document.activeElement !== input) input.value = value ?? 0;
    });
  }

  function readTrainingForm() {
    const config = { resists: {} };
    [...trainingForm.elements].forEach((input) => {
      if (!input.name) return;
      const [group, key] = input.name.split('.');
      const value = Number(input.value || 0);
      if (key) config[group][key] = value; else config[group] = value;
    });
    return config;
  }

  function renderTraining() {
    const training = state?.isTraining ? state.training : null;
    document.body.classList.toggle('is-training', Boolean(training));
    if (escapeButton && escapeLabels) {
      const strong = escapeButton.querySelector('strong');
      const span = escapeButton.querySelector('span');
      if (strong) strong.textContent = training ? 'Leave' : escapeLabels.title;
      if (span) span.textContent = training ? 'End training session.' : escapeLabels.sub;
    }
    if (!trainingPanel) return;
    trainingPanel.hidden = !training;
    if (!training) return;
    const stats = training.stats || {};
    const rounds = Math.max(1, Number(state.turnNumber || 1) - Number(stats.startTurn || 1) + 1);
    const avg = Math.round((Number(stats.totalDamage) || 0) / rounds);
    const hitRate = stats.attacks ? Math.round((stats.hits / stats.attacks) * 100) : 0;
    const critRate = stats.hits ? Math.round((stats.crits / stats.hits) * 100) : 0;
    const totals = [
      ['Total damage', Number(stats.totalDamage || 0).toLocaleString()],
      ['Rounds', rounds],
      ['Avg / round', avg.toLocaleString()],
      ['Highest hit', Number(stats.highestHit || 0).toLocaleString()],
      ['Hits', `${stats.hits || 0} / ${stats.attacks || 0} (${hitRate}%)`],
      ['Crits', `${stats.crits || 0} (${critRate}%)`],
      ['Missed', stats.missed || 0],
      ['Evaded', stats.evaded || 0]
    ];
    const totalsEl = $('#trainingTotals');
    if (totalsEl) totalsEl.innerHTML = totals.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
    const sourcesEl = $('#trainingSources');
    if (sourcesEl) {
      const sources = Object.entries(stats.bySource || {}).sort((a, b) => b[1] - a[1]);
      const kills = stats.kills || [];
      const lastKill = kills.at(-1);
      sourcesEl.textContent = [
        sources.length ? `By source: ${sources.map(([name, value]) => `${name} ${Number(value).toLocaleString()}`).join(' · ')}` : 'Attack the dummy to start measuring.',
        lastKill ? `Destroyed ${kills.length}× · last after ${lastKill.rounds} round${lastKill.rounds === 1 ? '' : 's'}` : ''
      ].filter(Boolean).join('   |   ');
    }
    fillTrainingForm(training.config);
  }

  async function runTrainingRequest(request, button) {
    if (busy) return;
    busy = true;
    if (button) button.disabled = true;
    try {
      const response = await request();
      state = response.battle;
      onStateChange?.(state);
      setLog(state.log.at(-1) || 'Training updated.');
      render();
    } catch (error) {
      setLog(error.message);
    } finally {
      busy = false;
      if (button) button.disabled = false;
      updateCommandAvailability();
    }
  }

  $('#trainingResetButton')?.addEventListener('click', (event) => runTrainingRequest(() => resetTraining(), event.currentTarget));
  trainingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    runTrainingRequest(() => updateTrainingConfig(readTrainingForm()), trainingForm.querySelector('button[type="submit"]'));
  });

  function setMenu(name) { Object.entries(menus).forEach(([key, element]) => element?.classList.toggle('hidden', key !== name)); if (state) state.menuState = name; }

  function render(actorId = state.currentActorId) {
    turn.textContent = `Turn ${state.turnNumber}`; track.replaceChildren();
    const encounterName = state.encounter?.name || state.encounter?.monsterNames?.join(', ') || 'Combat Encounter';
    const encounterTitle = $('#battleEncounterName');
    const stageTitle = $('.battle-stage-title');
    if (encounterTitle) encounterTitle.textContent = encounterName;
    if (stageTitle) stageTitle.textContent = encounterName;
    const livingEnemies = state.enemies.filter((enemy) => !enemy.isDefeated);
    const quoteEnemy = livingEnemies.find((enemy) => enemy.id === state.targetedEnemyId) || livingEnemies[0] || state.enemies[0];
    if (quoteEnemy) {
      const name = String(quoteEnemy.name || 'Enemy');
      const fallbackQuotes = [
        { match: 'reaper', quote: '“The silence between heartbeats belongs to me.”' },
        { match: 'golem', quote: '“Every step awakens the stones beneath you.”' }
      ];
      const quote = quoteEnemy.battleQuote || quoteEnemy.battle_quote || quoteEnemy.quote || fallbackQuotes.find((entry) => name.toLowerCase().includes(entry.match))?.quote || '“Your courage will be swallowed by the ruins.”';
      const quoteWords = String(quote).trim().replace(/^[“”"']|[“”"']$/g, '');
      if (quoteText) quoteText.textContent = `“${quoteWords}”`;
      if (quoteName) quoteName.textContent = `— ${name} —`;
    }
    state.turnQueue.forEach((unit) => {
      const pill = document.createElement('span');
      const isActive = unit.id === actorId;
      pill.className = `initiative-pill ${unit.isParty ? 'is-party' : 'is-enemy'} ${isActive ? 'is-active-turn' : ''} ${unit.isDefeated ? 'is-defeated' : ''}`;
      const turnPortrait = unit.avatar || unit.sprite || Array.from(unit.name || '?')[0];
      pill.textContent = Array.from(String(turnPortrait || '?')).slice(0, 2).join('');
      pill.title = `${unit.name} · Initiative ${unit.initiative}`;
      pill.setAttribute('aria-label', `${unit.name}, initiative ${unit.initiative}${isActive ? ', current turn' : ''}${unit.isDefeated ? ', defeated' : ''}`);
      if (isActive) pill.setAttribute('aria-current', 'step');
      track.append(pill);
    });

    enemies.replaceChildren();
    state.enemies.forEach((enemy) => {
      const card = document.createElement('div');
      card.className = `battle-enemy-card ${enemy.id === state.targetedEnemyId ? 'is-targeted' : ''} ${enemy.isDefeated ? 'is-defeated' : ''}`;
      card.innerHTML = `<span class="enemy-target-badge" aria-hidden="true">✧</span><div class="enemy-avatar-wrap">${enemyArtworkMarkup(enemy)}</div><h4 class="enemy-name">${escapeHtml(enemy.name)}</h4><div class="enemy-meta">Lv.${escapeHtml(enemy.level)} · IR ${escapeHtml(enemy.initiative)}</div><div class="enemy-status-list">${(enemy.statuses || []).map((status) => `<span class="enemy-status-item">${escapeHtml(status)}</span>`).join('')}</div><div class="enemy-hp-box"><div class="enemy-hp-box-labels"><span>HP</span><b>${enemy.infiniteHp ? '∞' : `${escapeHtml(enemy.current_hp)} / ${escapeHtml(enemy.max_hp)}`}</b></div><div class="enemy-hp-meter"><i style="width:${pct(enemy.current_hp, enemy.max_hp)}%"></i></div></div>`;
      if (!enemy.isDefeated && !busy) card.addEventListener('click', () => { state.targetedEnemyId = enemy.id; render(); });
      enemies.append(card);
    });

    party.replaceChildren();
    const myHero = getMyHero();
    const portraitStyles = ['portrait-kaito', 'portrait-lyn', 'portrait-mira', 'portrait-orion'];
    state.party.forEach((hero, heroIndex) => {
      const card = document.createElement('div');
      const isTargeted = hero.id === state.targetedPartyId;
      card.className = `battle-party-card ${hero.id === state.currentActorId ? 'is-active-turn' : ''} ${isTargeted ? 'is-targeted' : ''} ${hero.isDefeated ? 'is-defeated' : ''}`;
      card.style.cursor = 'pointer';
      const roleBadge = hero.tactics_role ? `<span style="font-size:10px;padding:1px 5px;background:#352c38;border-radius:3px;color:#d7a15c;">${hero.tactics_role}</span>` : '';
      card.innerHTML = `<div class="party-card-left"><div class="party-hero-avatar-large hero-portrait ${portraitStyles[heroIndex % portraitStyles.length]}" aria-hidden="true"><span class="portrait-body"></span><span class="portrait-face"></span><span class="portrait-hair"></span></div><div class="party-hero-identity"><h3>${escapeHtml(hero.name)}</h3><p>Lv. ${escapeHtml(hero.level)} · ${escapeHtml(hero.job || '')}</p>${roleBadge}</div><span class="party-ir-badge">IR ${escapeHtml(hero.initiative)}</span></div><div class="party-card-right"><div class="party-vital-row"><label>HP <b>${escapeHtml(hero.current_hp)} / ${escapeHtml(hero.max_hp)}</b></label><div class="party-vital-meter hp"><i style="width:${pct(hero.current_hp, hero.max_hp)}%"></i></div></div><div class="party-vital-row"><label>ENERGY <b>${escapeHtml(hero.current_energy)} / ${escapeHtml(hero.max_energy)}</b></label><div class="party-vital-meter energy"><i style="width:${pct(hero.current_energy, hero.max_energy)}%"></i></div></div><div class="party-status-list">${(hero.statuses || []).map((status) => `<span class="status-badge-item">${escapeHtml(status)}</span>`).join('')}</div></div>`;
      if (!busy) {
        card.addEventListener('click', () => {
          state.targetedPartyId = hero.id;
          render();
        });
      }
      party.append(card);
    });

    updateDismissalLock();
    updateCommandAvailability();
    renderLogPanels();
    renderTraining();

    const knownSkills = myHero?.skills || [];
    modal.querySelectorAll('[data-skill-list]').forEach((list) => {
      list.replaceChildren();
      const types = list.dataset.skillList.split(',');
      knownSkills.filter((skill) => types.includes(skill.type)).forEach((skill) => {
        const button = document.createElement('button');
        button.className = 'battle-skill-btn';
        button.type = 'button';
        button.dataset.skillId = skill.id;
        const name = document.createElement('b');
        name.textContent = skill.name || 'Unnamed skill';
        const details = document.createElement('small');
        const cost = Number(skill.effective_energy_cost ?? skill.energy_consume_cost ?? 0);
        const typeLabel = skillTypeLabels[skill.type] || skill.type;
        details.textContent = `(${typeLabel}${cost ? ` - ${cost} EP` : ''})`;
        if (skill.weapon_usable === false) {
          const needs = (skill.weapon_types || []).map((type) => (type === 'NONE' ? 'Unarmed' : type === 'ANY_WEAPON' ? 'Any weapon' : type.charAt(0) + type.slice(1).toLowerCase())).join(' / ');
          button.disabled = true;
          button.title = `Requires: ${needs}`;
          details.textContent = `(${typeLabel}${cost ? ` - ${cost} EP` : ''} · ${needs})`;
        }
        button.append(name, details);
        list.append(button);
      });
      if (!list.children.length) {
        const empty = document.createElement('small');
        empty.textContent = 'No skills available.';
        list.append(empty);
      }
    });
  }

  async function renderTurnEvents(events = []) {
    const sequence = [...new Set(events.filter(Boolean))];
    if (!sequence.length) { render(); return; }
    render(sequence[0]);
    for (const actorId of sequence) { await pause(BATTLE_ANIMATION_STEP_MS); render(actorId); }
    await pause(BATTLE_ANIMATION_SETTLE_MS);
    render();
  }

  function showResult(result) {
    if (!resultModal) return;
    resultStatus = result?.status || null;
    const progression = result?.progression || {};
    const victory = result?.status === BATTLE_STATUS.VICTORY;
    const rewardsSection = resultModal.querySelector('#battleResultRewardsSection');
    const penaltySection = resultModal.querySelector('#battleResultPenaltySection');
    const goldElem = resultModal.querySelector('#battleResultGold');
    const dropsSection = resultModal.querySelector('#battleResultDropsSection');
    const dropsList = resultModal.querySelector('#battleResultDropsList');
    const continueBtn = resultModal.querySelector('#battleResultContinue');

    const fled = result?.status === BATTLE_STATUS.FLED;
    const training = Boolean(result?.training);
    resultModal.querySelector('#battleResultEyebrow').textContent = training ? 'TRAINING GROUNDS' : victory ? 'BATTLE VICTORY' : fled ? 'ESCAPED COMBAT' : 'KILLED IN ACTION';
    resultModal.querySelector('#battleResultTitle').textContent = training ? 'Training Complete' : victory ? 'Victory' : fled ? 'Escaped' : 'Defeat';
    if (training) {
      const summary = result.summary || {};
      const avg = Math.round((Number(summary.totalDamage) || 0) / Math.max(1, Number(summary.rounds) || 1));
      resultModal.querySelector('#battleResultMessage').textContent = `${Number(summary.totalDamage || 0).toLocaleString()} damage in ${summary.rounds || 0} round${summary.rounds === 1 ? '' : 's'} (avg ${avg.toLocaleString()} per round, highest hit ${Number(summary.highestHit || 0).toLocaleString()}). Nothing was spent or earned.`;
      rewardsSection?.classList.add('hidden');
      penaltySection?.classList.add('hidden');
      if (continueBtn) continueBtn.textContent = 'Back to Town →';
      resultModal.classList.add('is-open');
      resultModal.setAttribute('aria-hidden', 'false');
      return;
    }

    if (victory) {
      resultModal.querySelector('#battleResultMessage').textContent = 'The enemies have fallen. Your progress and rewards have been recorded.';
      rewardsSection?.classList.remove('hidden');
      penaltySection?.classList.add('hidden');
      if (penaltySection) penaltySection.replaceChildren();

      resultModal.querySelector('#battleResultExperience').textContent = `+${Number(result.experienceGained || 0).toLocaleString()} EXP`;
      
      const gold = Number(result.goldGained || 0);
      if (goldElem) {
        goldElem.textContent = gold > 0 ? `+${gold.toLocaleString()} Gold` : '';
        goldElem.classList.toggle('hidden', gold <= 0);
      }

      resultModal.querySelector('#battleResultLevelUp').textContent = progression.levelUps
        ? `Congratulations! You reached level ${progression.level}. +${progression.pointsAwarded} attribute points.`
        : progression.isMaxLevel
        ? 'You have reached the maximum level.'
        : '';

      const drops = Array.isArray(result.lootDrops) ? result.lootDrops : [];
      if (dropsList && dropsSection) {
        dropsList.replaceChildren();
        if (drops.length) {
          dropsSection.classList.remove('hidden');
          drops.forEach((item) => {
            const badge = document.createElement('span');
            badge.className = `battle-result-item-badge ${item.overflow ? 'is-overflow' : ''}`;
            badge.title = item.overflow ? `${item.remaining} lost due to full inventory` : `${item.quantity}x ${item.name}`;
            badge.innerHTML = `<span>🎁</span> <span>${item.name}</span> <b>×${item.quantity}</b>${item.overflow ? ' <small>(Bag Full)</small>' : ''}`;
            dropsList.append(badge);
          });
        } else {
          dropsSection.classList.add('hidden');
        }
      }

      if (continueBtn) continueBtn.textContent = 'Continue Adventure →';
    } else if (fled) {
      resultModal.querySelector('#battleResultMessage').textContent = result?.message || 'You escaped the encounter.';
      rewardsSection?.classList.add('hidden');
      penaltySection?.classList.add('hidden');
      if (continueBtn) continueBtn.textContent = 'Continue Adventure →';
    } else {
      resultModal.querySelector('#battleResultMessage').textContent = 'You were defeated in battle.';
      rewardsSection?.classList.add('hidden');
      penaltySection?.classList.remove('hidden');

      if (penaltySection) {
        const respawnName = result?.respawn_location?.name || 'Honeywood Village';
        const lostGold = Number(result?.lostGold || 0);
        const lostItemCount = Number(result?.lostItemCount || 0);
        const lostEquipCount = Number(result?.lostEquipmentCount || 0);

        penaltySection.innerHTML = `
          <h4>Death Penalty Applied</h4>
          <ul>
            <li><b>Respawn Point:</b> Awakened at <em>${respawnName}</em>.</li>
            <li><b>Inventory:</b> All backpack items lost (${lostItemCount} item${lostItemCount === 1 ? '' : 's'} lost).</li>
            <li><b>Equipment:</b> All equipped gear lost (${lostEquipCount} piece${lostEquipCount === 1 ? '' : 's'} lost).</li>
            <li><b>Gold:</b> Carried gold wiped to 0 (${lostGold.toLocaleString()} gold lost).</li>
            <li><b>Safe Haven:</b> Items in Town Vault Chest remain 100% safe.</li>
          </ul>
        `;
      }

      if (continueBtn) continueBtn.textContent = 'Respawn in Town →';
    }

    resultModal.classList.add('is-open');
    resultModal.setAttribute('aria-hidden', 'false');
  }

  function closeResult() {
    const closedStatus = resultStatus;
    if (closedStatus === BATTLE_STATUS.DEFEAT && !onResultDismiss) {
      window.location.reload();
      return;
    }
    resultModal?.classList.remove('is-open');
    resultModal?.setAttribute('aria-hidden', 'true');
    resultStatus = null;
    onResultDismiss?.(closedStatus);
  }

  async function act(skillId, extra = {}) {
    if (busy || !isMyTurn()) return;
    busy = true;
    commandButtons.forEach((button) => { if (button) button.disabled = true; });
    try {
      const myHero = getMyHero();
      const skill = skillId ? myHero?.skills.find((entry) => String(entry.id) === String(skillId)) : null;
      let targetId = state.targetedEnemyId;
      if (skill?.type === SKILL_MENU_TYPE.DEFEND) {
        const isTaunt = skill?.taunt || skill?.is_taunt || String(skill?.name || '').trim().toUpperCase() === TAUNT_SKILL_NAME;
        targetId = isTaunt ? state.targetedEnemyId : myHero?.id || 'player';
      } else if (skill?.healing || skill?.healing_current_hp) {
        targetId = state.targetedPartyId || myHero?.id || 'player';
      }
      const payload = extra.itemId !== undefined
        ? { itemId: extra.itemId }
        : skillId === 'flee'
        ? { action: 'flee' }
        : { skillId, targetId, ...extra };

      const result = await performBattleAction(payload);
      state = result.battle;
      onStateChange?.(state);
      setLog(state.log.at(-1) || 'Action resolved.');
      setMenu('main');
      await renderTurnEvents(state.turnEvents);
      if (state.status !== BATTLE_STATUS.IN_PROGRESS) {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        close();
        const battleResult = state.result || result.result;
        const resultRefresh = onResult(battleResult);
        showResult(battleResult);
        await resultRefresh;
      }
    } catch (error) {
      setLog(error.message);
    } finally {
      busy = false;
      updateCommandAvailability();
      render();
    }
  }

  function renderSpellSlots(spellId) {
    const myHero = getMyHero();
    const skill = myHero?.skills.find((entry) => String(entry.id) === String(spellId));
    spellTitle.textContent = `Cast ${skill?.name || 'spell'} · Select Spell Point Slot`;
    slots.replaceChildren();
    (myHero?.spell_points || []).forEach((slot) => {
      const button = document.createElement('button');
      button.className = 'spell-slot-choice-btn';
      button.disabled = slot.current < 1;
      button.textContent = `Level ${slot.level}: ${slot.current} of ${slot.max_current} points`;
      button.addEventListener('click', () => act(spellId, { spellPointLevel: slot.level }));
      slots.append(button);
    });
  }

  function renderInventory() {
    inventory.replaceChildren();
    const items = (state.inventory || []).filter((item) => item.quantity > 0);
    items.forEach((item) => {
      const button = document.createElement('button');
      button.className = 'battle-inv-slot has-item';
      button.type = 'button';
      button.title = item.description || item.name;
      button.textContent = `${item.name} ×${item.quantity}`;
      button.addEventListener('click', () => act(null, { itemId: item.item_id }));
      inventory.append(button);
    });
    if (!items.length) {
      const empty = document.createElement('small');
      empty.textContent = 'No consumable items available.';
      inventory.append(empty);
    }
  }

  $('#btnMenuAttack')?.addEventListener('click', () => setMenu('attack'));
  $('#btnMenuMagicAttack')?.addEventListener('click', () => setMenu('magic_attack'));
  $('#btnMenuDefend')?.addEventListener('click', () => setMenu('defend'));
  $('#btnMenuSpells')?.addEventListener('click', () => setMenu('spells'));
  $('#btnMenuInventory')?.addEventListener('click', () => { renderInventory(); setMenu('inventory'); });
  $('#btnMenuEscape')?.addEventListener('click', () => act('flee'));
  modal.querySelectorAll('[data-back-main]').forEach((button) => button.addEventListener('click', () => setMenu('main')));
  $('#btnBackToSpells')?.addEventListener('click', () => setMenu('spells'));

  modal.querySelectorAll('[data-log-tab]').forEach((tab) => tab.addEventListener('click', () => {
    modal.querySelectorAll('[data-log-tab]').forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', String(isActive));
    });
    renderLogPanels();
  }));

  function handleSkillListClick(event) {
    const button = event.target.closest('[data-skill-id]');
    if (!button) return;
    const myHero = getMyHero();
    const skill = myHero?.skills.find((entry) => String(entry.id) === button.dataset.skillId);
    if (skill?.type === SKILL_MENU_TYPE.SPELL) { renderSpellSlots(skill.id); setMenu('spell_points'); }
    else act(button.dataset.skillId);
  }

  modal.querySelectorAll('[data-skill-list]').forEach((list) => list.addEventListener('click', handleSkillListClick));
  modal.querySelectorAll('[data-close-battle]').forEach((element) => element.addEventListener('click', close));
  resultModal?.querySelector('#battleResultClose')?.addEventListener('click', closeResult);
  resultModal?.querySelector('#battleResultContinue')?.addEventListener('click', closeResult);

  async function openState(battle) {
    state = battle;
    onStateChange?.(state);
    render();
    setMenu('main');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setLog(state.log.at(-1) || 'Your party is ready for battle.');
    window.addEventListener('beforeunload', handleBeforeUnload);
    commandButtons.forEach((button) => { if (button) button.disabled = true; });
    await renderTurnEvents(state.turnEvents);
    updateCommandAvailability();
    render();
  }

  async function open(encounter) { await openState(await characterSupplier(encounter)); }
  async function openWithExistingState(battle) { await openState(battle); }

  async function refreshState(newBattle) {
    if (!newBattle) return;
    state = newBattle;
    onStateChange?.(state);
    render();
    setLog(state.log.at(-1) || 'Combat updated.');
    await renderTurnEvents(state.turnEvents);
    if (state.status !== BATTLE_STATUS.IN_PROGRESS) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      close();
      const resultRefresh = onResult(state.result);
      showResult(state.result);
      await resultRefresh;
    }
  }

  function isOpen() {
    return modal.classList.contains('is-open');
  }

  function close() {
    if (state?.status === BATTLE_STATUS.IN_PROGRESS) return false;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    window.removeEventListener('beforeunload', handleBeforeUnload);
    return true;
  }

  return { open, openWithExistingState, close, refreshState, isOpen };
}
