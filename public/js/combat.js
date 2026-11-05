const logContent = document.querySelector('.log-content');
const battleLog = [
  'A wild Ruin Golem appeared!',
  'Shadow Reaper A appeared!',
  'Shadow Reaper B appeared!',
  'Your party is ready for battle.'
];
let selectedAction = '';
let selectedEnemy = '';

function showLog(entries) {
  if (!logContent) return;
  logContent.replaceChildren(...entries.map((entry) => {
    const line = document.createElement('p');
    line.textContent = entry;
    return line;
  }));
  logContent.scrollTop = logContent.scrollHeight;
}

function addBattleMessage(message) {
  battleLog.push(message);
  const activeTab = document.querySelector('.log-tabs button.active')?.dataset.logTab;
  if (activeTab === 'battle') showLog(battleLog);
}

document.querySelectorAll('[data-log-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-log-tab]').forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', String(isActive));
    });
    showLog(battleLog);
  });
});

document.querySelectorAll('[data-enemy]').forEach((enemy) => {
  enemy.addEventListener('click', () => {
    document.querySelectorAll('[data-enemy]').forEach((item) => {
      const isSelected = item === enemy;
      item.classList.toggle('is-targeted', isSelected);
      item.setAttribute('aria-pressed', String(isSelected));
    });
    selectedEnemy = enemy.dataset.enemy;
    if (selectedAction) addBattleMessage(`${selectedEnemy} targeted. ${selectedAction} is ready.`);
  });
});

document.querySelectorAll('.action-card').forEach((action) => {
  action.addEventListener('click', () => {
    document.querySelectorAll('.action-card').forEach((item) => item.classList.toggle('is-selected', item === action));
    selectedAction = action.dataset.action;
    if (selectedAction === 'Flee') {
      addBattleMessage('Flee selected.');
    } else if (selectedEnemy) {
      addBattleMessage(`${selectedAction} selected against ${selectedEnemy}.`);
    } else {
      addBattleMessage(`${selectedAction} selected. Choose an enemy target.`);
    }
  });
});

document.querySelectorAll('.hero-card').forEach((hero) => {
  hero.addEventListener('click', () => {
    document.querySelectorAll('.hero-card').forEach((item) => item.classList.toggle('is-current', item === hero));
  });
});

document.querySelectorAll('.initiative-unit').forEach((unit) => {
  unit.addEventListener('click', () => {
    document.querySelectorAll('.initiative-unit').forEach((item) => item.classList.toggle('active', item === unit));
  });
});
