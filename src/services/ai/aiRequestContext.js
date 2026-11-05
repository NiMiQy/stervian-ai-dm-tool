import { AsyncLocalStorage } from 'node:async_hooks';
import { AI_API_KEY_HEADER, AI_API_KEY_MAX_LENGTH, AI_API_KEY_MISSING_MESSAGE, HTTP_STATUS } from '../../configs/constants.js';

const aiRequestStorage = new AsyncLocalStorage();

export function normalizeAiApiKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length > AI_API_KEY_MAX_LENGTH || /\s/.test(key)) return '';
  return key;
}

export function getRequestAiApiKey() {
  return aiRequestStorage.getStore()?.apiKey || '';
}

export function runWithAiApiKey(apiKey, callback) {
  return aiRequestStorage.run({ apiKey: normalizeAiApiKey(apiKey) }, callback);
}

export function aiApiKeyContextMiddleware(request, _response, next) {
  runWithAiApiKey(request.get(AI_API_KEY_HEADER), next);
}

export function requireAiApiKey(_request, response, next) {
  if (getRequestAiApiKey()) return next();
  return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: AI_API_KEY_MISSING_MESSAGE, code: 'AI_API_KEY_MISSING' });
}
