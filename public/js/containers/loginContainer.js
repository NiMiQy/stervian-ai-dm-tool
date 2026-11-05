import { getCurrentUser, login, register } from '../logics/authApi.js';
import { PAGES } from '../constants.js';

export async function initialiseLogin() {
  try { const current = await getCurrentUser(); window.location.replace(current.user?.isAdmin ? PAGES.ADMIN : PAGES.GAME); return; } catch { /* no active session */ }
  const loginForm = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');
  const switchMode = (mode) => {
    document.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
    loginForm.classList.toggle('active', mode === 'login');
    registerForm.classList.toggle('active', mode === 'register');
  };
  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.authMode)));
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#loginError');
    error.textContent = '';
    try { const result = await login(Object.fromEntries(new FormData(loginForm))); window.location.assign(result.user?.isAdmin ? PAGES.ADMIN : PAGES.GAME); }
    catch (requestError) { error.textContent = requestError.message; }
  });
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(registerForm));
    const error = document.querySelector('#registerError');
    const success = document.querySelector('#registerSuccess');
    error.textContent = ''; success.textContent = '';
    if (data.password !== data.passwordConfirm) { error.textContent = 'Passwords do not match.'; return; }
    try {
      await register({ username: data.username, password: data.password });
      success.textContent = 'Account created. Sign in to create your character.';
      document.querySelector('#loginUsername').value = data.username;
      switchMode('login');
    } catch (requestError) { error.textContent = requestError.message; }
  });
}
