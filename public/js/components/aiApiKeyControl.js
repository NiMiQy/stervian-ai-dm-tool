import { clearAiApiKey, getAiApiKey, maskAiApiKey, setAiApiKey } from '../logics/aiApiKey.js';

export function initAiApiKeyControl({ notify = () => {} } = {}) {
  const control = document.querySelector('#aiApiKeyControl');
  const button = document.querySelector('#aiApiKeyBtn');
  const panel = document.querySelector('#aiApiKeyPanel');
  const input = document.querySelector('#aiApiKeyInput');
  const status = document.querySelector('#aiApiKeyStatus');
  const saveButton = document.querySelector('#aiApiKeySaveBtn');
  const removeButton = document.querySelector('#aiApiKeyRemoveBtn');
  if (!control || !button || !panel || !input) return { hasKey: () => Boolean(getAiApiKey()), ensure: () => Boolean(getAiApiKey()), open: () => {} };

  const refresh = () => {
    const key = getAiApiKey();
    button.classList.toggle('is-set', Boolean(key));
    button.classList.toggle('is-missing', !key);
    button.title = key ? `AI API key saved (${maskAiApiKey(key)}). Click to change it.` : 'Enter your DeepSeek API key';
    if (status) status.textContent = key ? `Saved key: ${maskAiApiKey(key)}` : 'No key saved. The Dungeon Master needs a DeepSeek API key to respond.';
    if (removeButton) removeButton.disabled = !key;
  };

  const open = () => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    input.value = '';
    refresh();
    input.focus();
  };

  const close = () => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    input.value = '';
  };

  const save = () => {
    const value = input.value.trim();
    if (!value) {
      notify('Paste your DeepSeek API key first.');
      input.focus();
      return;
    }
    try {
      setAiApiKey(value);
      refresh();
      close();
      notify('AI API key saved.');
    } catch (error) {
      notify(error.message || 'Unable to save the AI API key.');
    }
  };

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  saveButton?.addEventListener('click', save);
  removeButton?.addEventListener('click', () => {
    clearAiApiKey();
    refresh();
    input.value = '';
    notify('AI API key removed.');
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      button.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !control.contains(event.target)) close();
  });

  refresh();

  return {
    hasKey: () => Boolean(getAiApiKey()),
    ensure: () => {
      if (getAiApiKey()) return true;
      notify('Enter your AI API key before acting.');
      open();
      return false;
    },
    open
  };
}
