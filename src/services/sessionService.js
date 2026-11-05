import { randomUUID } from 'node:crypto';
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_SECONDS } from '../configs/constants.js';

const sessions = new Map();

function readCookies(cookieHeader = '') {
  return Object.fromEntries(cookieHeader.split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter(([key]) => key));
}

export function createSession(user) {
  const sessionToken = randomUUID();
  sessions.set(sessionToken, {
    id: user.id,
    user_id: user.user_id,
    expiresAt: Date.now() + SESSION_LIFETIME_SECONDS * 1000
  });
  return sessionToken;
}

export function getSession(request) {
  const id = readCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
  const session = id && sessions.get(id);
  if (!session || session.expiresAt < Date.now()) {
    if (id) sessions.delete(id);
    return null;
  }
  return session;
}

export function removeSession(request) {
  const id = readCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
  if (id) sessions.delete(id);
}

export function sessionCookie(id) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_LIFETIME_SECONDS}`;
}

export const clearedSessionCookie = `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
