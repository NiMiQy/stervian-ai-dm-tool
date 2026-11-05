import express from 'express';
import { authenticateUser, getAuthenticatedUser, registerUser, validateRegistration } from '../containers/authContainer.js';
import { clearedSessionCookie, createSession, getSession, removeSession, sessionCookie } from '../services/sessionService.js';
import { databaseFailureMessage, requireSession } from './middleware.js';
import { removeMemberOnSignOut } from '../services/partyPresenceService.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.post('/register', async (request, response) => {
  try {
    const input = request.body;
    const normalizedInput = { ...input, username: typeof input.username === 'string' ? input.username.trim() : input.username };
    const validationError = validateRegistration(normalizedInput);
    if (validationError) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: validationError });
    const result = await registerUser(normalizedInput);
    return response.status(result.error ? HTTP_STATUS.CONFLICT : HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, 'Unable to register this account.') });
  }
});

router.post('/login', async (request, response) => {
  try {
    const user = await authenticateUser({ username: request.body.username?.trim(), password: request.body.password });
    if (!user) return response.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'The username or password is incorrect.' });
    if (user.suspended) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Your account has been suspended, please contact DM or register another one.' });
    response.set('Set-Cookie', sessionCookie(createSession(user)));
    return response.json({ user: await getAuthenticatedUser(user.id) });
  } catch (error) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: databaseFailureMessage(error, 'Unable to sign in.') });
  }
});

router.post('/logout', async (request, response) => {
  let session = null;
  try { session = getSession(request); } catch { session = null; }
  if (session?.user_id) {
    await removeMemberOnSignOut(session.user_id).catch((error) => console.warn('[logout] Unable to leave party on sign out:', error.message));
  }
  removeSession(request);
  response.set('Set-Cookie', clearedSessionCookie);
  response.json({ success: true });
});

router.get('/me', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const user = await getAuthenticatedUser(session.id);
    if (!user) {
      removeSession(request);
      response.set('Set-Cookie', clearedSessionCookie);
      return response.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Session is no longer valid.' });
    }
    return response.json({ user });
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to load the authenticated user.') });
  }
});

export default router;
