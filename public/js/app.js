const feed = document.querySelector('#storyFeed');
const input = document.querySelector('#actionInput');
const form = document.querySelector('#actionForm');
const toast = document.querySelector('#toast');
let hp = 28;

const loginScreen = document.querySelector('#loginScreen');
const appShell = document.querySelector('.app-shell');
const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');

function showGame() { loginScreen.classList.add('is-hidden'); appShell.classList.add('is-visible'); }
function showLogin() { appShell.classList.remove('is-visible'); loginScreen.classList.remove('is-hidden'); input.value = ''; document.querySelector('#password').value = ''; document.querySelector('#username').focus(); }

if (localStorage.getItem('stervian_mock_session') === 'admin') showGame();
loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const username = document.querySelector('#username').value.trim();
  const password = document.querySelector('#password').value;
  if (username === 'admin' && password === '123') {
    localStorage.setItem('stervian_mock_session', 'admin');
    loginError.textContent = '';
    showGame();
    notify('Welcome back, admin.');
  } else {
    loginError.textContent = 'The username or password is incorrect.';
  }
});

function notify(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function currentCharacterName() { return document.querySelector('.character-summary h2')?.textContent.trim() || 'Adventurer'; }
function takeAction(action) {
  const safeAction = escapeHtml(action);
  const name = currentCharacterName();
  const characterInitials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  feed.insertAdjacentHTML('beforeend', `<article class="npc-line player-line"><div class="avatar">${escapeHtml(characterInitials)}</div><div><p class="speaker">${escapeHtml(name.toUpperCase())} <span>You</span></p><p>${safeAction}</p></div></article>`);
  const responses = [
    'Mara watches the tower through the rain. "Careful," she says. "Whatever lit that lantern wants us to see it."',
    'The wind carries the scent of wet stone and old ash. Somewhere ahead, a bell rings once beneath the thunder.',
    'A cold blue shimmer travels across the road. The watchtower door stands open now — though neither of you saw it move.'
  ];
  const response = responses[Math.floor(Math.random() * responses.length)];
  setTimeout(() => { feed.insertAdjacentHTML('beforeend', `<article class="narration"><span class="entry-mark">✦</span><p>${response}</p></article>`); feed.scrollTop = feed.scrollHeight; }, 420);
  input.value = '';
}
form.addEventListener('submit', event => { event.preventDefault(); const action = input.value.trim(); if (action) takeAction(action); });
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => takeAction(button.dataset.action)));
document.querySelectorAll('.panel-tabs button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.panel-tabs button').forEach(item => item.classList.remove('active')); document.querySelectorAll('.detail-content').forEach(item => item.classList.add('hidden')); button.classList.add('active'); document.querySelector(`#${button.dataset.detail}Detail`).classList.remove('hidden'); }));
document.querySelectorAll('.nav-tabs button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.nav-tabs button').forEach(item => item.classList.remove('active')); button.classList.add('active'); notify(`${button.textContent.trim()} view is a mockup.`); }));
document.querySelector('#saveButton').addEventListener('click', () => notify('Mock game state saved locally.'));
document.querySelector('.map-button').addEventListener('click', () => notify('World map will connect to regions and locations.'));
document.querySelector('#logoutButton').addEventListener('click', () => { localStorage.removeItem('stervian_mock_session'); showLogin(); });
document.addEventListener('keydown', event => { if (event.target === input) return; const actions = document.querySelectorAll('[data-action]'); if (event.key >= '1' && event.key <= '3') actions[Number(event.key) - 1].click(); });
