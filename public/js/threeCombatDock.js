import { proxyButtonDock, webglAvailable } from './components/threeButtonDock.js';

const MAIN_ICONS = { btnMenuAttack: '⚔', btnMenuMagicAttack: '✦', btnMenuSpells: '✧', btnMenuInventory: '⚗', btnMenuDefend: '⛨', btnMenuEscape: '➶' };
const ROW_HEIGHT_PX = 84;

const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();

function visibleMenu(commandDock) {
  const main = commandDock.querySelector('.battle-menu-main');
  if (main && !main.classList.contains('hidden')) return { main };
  return { submenu: [...commandDock.querySelectorAll('.battle-submenu')].find((menu) => !menu.classList.contains('hidden')) || null };
}

function mainSpecs(main) {
  return [...main.querySelectorAll('.action-card')].map((button) => ({
    key: button.id,
    title: text(button.querySelector('strong')) || text(button),
    sub: text(button.querySelector('span')),
    icon: MAIN_ICONS[button.id] || '',
    danger: button.id === 'btnMenuEscape',
    selected: button.classList.contains('is-selected'),
    target: button
  }));
}

function submenuSpecs(submenu) {
  const specs = [...submenu.querySelectorAll('.battle-skill-btn, .spell-slot-choice-btn, .battle-inv-slot.has-item')].map((button, index) => {
    let title = text(button.querySelector('b'));
    let sub = text(button.querySelector('small')).replace(/^\(|\)$/g, '');
    if (!title) {
      const raw = text(button);
      const slot = raw.match(/^(Level \d+):\s*(.*)$/);
      const item = raw.match(/^(.*?)\s*(×\d+)$/);
      if (slot) { title = slot[1]; sub = slot[2]; } else if (item) { title = item[1]; sub = item[2]; } else title = raw;
    }
    return { key: `${submenu.id}-${index}-${title}`, title, sub, selected: button.classList.contains('is-selected'), target: button };
  });
  if (!specs.length) {
    const empty = text(submenu.querySelector('.submenu-grid small, .battle-inventory-grid > :not(button), .spell-slot-grid > :not(button)')) || 'Nothing available.';
    specs.push({ key: `${submenu.id}-empty`, title: empty, disabled: true });
  }
  const back = submenu.querySelector('.submenu-back');
  if (back) specs.push({ key: `${submenu.id}-back`, title: '← Back', sub: back.id === 'btnBackToSpells' ? 'Spell list' : 'Main commands', target: back });
  return specs;
}

function initialise() {
  const actionDock = document.querySelector('.action-dock');
  const commandDock = actionDock?.querySelector('.battle-command-dock');
  if (!actionDock || !commandDock || !webglAvailable()) return;

  const stage = document.createElement('div');
  stage.className = 'three-dock-stage';
  const caption = document.createElement('p');
  caption.className = 'three-dock-caption';
  caption.setAttribute('aria-hidden', 'true');
  stage.append(caption);
  actionDock.append(stage);
  actionDock.classList.add('is-three');

  proxyButtonDock(stage, {
    root: commandDock,
    cellWidth: [1.2, 3],
    collect: () => {
      const { main, submenu } = visibleMenu(commandDock);
      caption.textContent = submenu ? text(submenu.querySelector('.submenu-header span')) : '';
      if (main) return mainSpecs(main);
      return submenu ? submenuSpecs(submenu) : [];
    },
    onLayout: ({ rows }) => stage.style.setProperty('--three-dock-height', `${rows * ROW_HEIGHT_PX + 20}px`)
  });
}

(document.fonts?.ready || Promise.resolve()).then(initialise);
