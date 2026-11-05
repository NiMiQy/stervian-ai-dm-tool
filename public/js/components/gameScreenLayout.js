const MOBILE_QUERY = '(max-width: 860px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function initialiseSidebarToggle() {
  const sidebar = document.querySelector('#characterPanel');
  const toggle = document.querySelector('#sidebarToggle');
  const label = toggle?.querySelector('.sidebar-toggle-label');
  if (!sidebar || !toggle) return;

  const setExpanded = (expanded) => {
    sidebar.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    if (label) label.textContent = expanded ? 'Less' : 'More';
  };

  toggle.addEventListener('click', () => setExpanded(!sidebar.classList.contains('is-expanded')));
  sidebar.querySelector('.nav-tabs')?.addEventListener('click', (event) => {
    if (event.target.closest('button') && window.matchMedia(MOBILE_QUERY).matches) setExpanded(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-expanded')) {
      setExpanded(false);
      toggle.focus();
    }
  });
  window.matchMedia(MOBILE_QUERY).addEventListener('change', (event) => {
    if (!event.matches) setExpanded(false);
  });
}

function followNewStoryEntries() {
  const feed = document.querySelector('#storyFeed');
  if (!feed) return;
  let pending = null;
  const observer = new MutationObserver((mutations) => {
    const added = mutations.flatMap((mutation) => [...mutation.addedNodes]).filter((node) => node.nodeType === Node.ELEMENT_NODE);
    if (!added.length) return;
    pending = added[added.length - 1];
    window.requestAnimationFrame(() => {
      if (!pending?.isConnected) return;
      const behavior = window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth';
      const block = pending.classList.contains('narration') ? 'start' : 'nearest';
      pending.scrollIntoView({ behavior, block });
      pending = null;
    });
  });
  observer.observe(feed, { childList: true });
}

export function initialiseGameScreenLayout() {
  initialiseSidebarToggle();
  followNewStoryEntries();
}
