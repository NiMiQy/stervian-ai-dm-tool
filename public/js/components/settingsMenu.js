export function initializeSettingsMenu(onLogout) {
  const wrapper = document.querySelector('.settings-menu-wrap');
  const trigger = document.querySelector('#settingsMenuButton');
  const menu = document.querySelector('#settingsMenu');
  const logoutButton = document.querySelector('#logoutButton');

  if (!wrapper || !trigger || !menu || !logoutButton) return;

  const closeMenu = (restoreFocus = false) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };

  trigger.addEventListener('click', () => {
    const isOpening = menu.hidden;
    menu.hidden = !isOpening;
    trigger.setAttribute('aria-expanded', String(isOpening));
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) closeMenu(true);
  });

  logoutButton.addEventListener('click', () => {
    closeMenu();
    void onLogout();
  });
}
