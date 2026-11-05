import { assertNotInCombat } from '../containers/core/battleSystemCore.js';
import { getAuthenticatedUser } from '../containers/authContainer.js';
import { getSession } from '../services/sessionService.js';
import { ADMIN_MODELS, ERROR_NAMES, HTTP_STATUS, NUMERIC_ID_PATTERN, SERVER_DEFAULTS } from '../configs/constants.js';

export function databaseFailureMessage(error, fallback) {
  return error?.name === ERROR_NAMES.DATABASE_OPERATION ? error.message : fallback;
}

export function requireSession(request, response) {
  const session = getSession(request);
  if (!session) response.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication is required.' });
  return session;
}

export async function requireOutOfCombat(session, response) {
  try {
    await assertNotInCombat(session.user_id);
    return true;
  } catch (error) {
    response.status(error.statusCode || HTTP_STATUS.CONFLICT).json({ error: error.message || 'You cannot perform this action while engaged in combat.' });
    return false;
  }
}

export async function requireAdmin(request, response) {
  const session = requireSession(request, response);
  if (!session) return null;
  try {
    const user = await getAuthenticatedUser(session.id);
    if (!user || !user.isAdmin) {
      response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Administrator access is required.' });
      return null;
    }
    return user;
  } catch (error) {
    response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to verify administrator access.') });
    return null;
  }
}

export async function requireAdminPage(request, response, next) {
  const session = getSession(request);
  if (!session) return response.redirect(SERVER_DEFAULTS.LANDING_PAGE);
  try {
    const user = await getAuthenticatedUser(session.id);
    if (!user || !user.isAdmin) {
      return response.status(HTTP_STATUS.FORBIDDEN).send(`<!doctype html><meta charset="utf-8"><title>Forbidden</title><p>Administrator access is required.</p><p>Returning to the game...</p><script>setTimeout(() => location.replace("${SERVER_DEFAULTS.GAME_PAGE}"), ${SERVER_DEFAULTS.ADMIN_FORBIDDEN_REDIRECT_DELAY_MS});</script>`);
    }
    return next();
  } catch {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Unable to verify administrator access.');
  }
}

export async function adminMutation(request, response, operation, statusCode) {
  if (!ADMIN_MODELS.includes(request.params.model) || (request.params.id && !NUMERIC_ID_PATTERN.test(request.params.id))) {
    return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Admin route not found.' });
  }
  try {
    const record = request.method === 'POST'
      ? await operation(request.params.model, request.body)
      : await operation(request.params.model, request.params.id, request.body);
    return response.status(statusCode).json({ message: 'Record has been saved', record });
  } catch (error) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, 'Unable to complete the admin operation.') });
  }
}

export async function getOwnedRecord(request, response, operation, label) {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) {
    return response.status(HTTP_STATUS.NOT_FOUND).json({ error: `${label[0].toUpperCase()}${label.slice(1)} not found` });
  }
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) {
    return response.status(HTTP_STATUS.FORBIDDEN).json({ error: `You can only access your own ${label}.` });
  }
  try {
    const record = await operation(session.user_id);
    if (!record) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: `${label[0].toUpperCase()}${label.slice(1)} not found` });
    return response.json(record);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, `Unable to load ${label}.`) });
  }
}
