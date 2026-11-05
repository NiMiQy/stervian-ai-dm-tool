import { AI_API_KEY } from '../constants.js';

export function getAiApiKey() {
  try {
    return localStorage.getItem(AI_API_KEY.STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAiApiKey(value) {
  const key = String(value || '').trim();
  if (!key) {
    clearAiApiKey();
    return '';
  }
  if (key.length > AI_API_KEY.MAX_LENGTH || /\s/.test(key)) throw new Error('That API key does not look valid.');
  localStorage.setItem(AI_API_KEY.STORAGE_KEY, key);
  return key;
}

export function clearAiApiKey() {
  try {
    localStorage.removeItem(AI_API_KEY.STORAGE_KEY);
  } catch {
    return;
  }
}

export function aiApiKeyHeaders() {
  const key = getAiApiKey();
  return key ? { [AI_API_KEY.HEADER]: key } : {};
}

export function maskAiApiKey(key) {
  const value = String(key || '');
  if (!value) return '';
  return value.length <= 8 ? '••••' : `${value.slice(0, 3)}••••${value.slice(-4)}`;
}
