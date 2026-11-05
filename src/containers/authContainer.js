import prisma from '../services/prismaClient.js';
import { hashPassword, verifyPassword } from '../services/passwordService.js';
import { randomUUID } from 'node:crypto';
import { databaseError } from '../database/databaseError.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from '../configs/constants.js';

export function validateRegistration({ username, password }) {
  if (!USERNAME_PATTERN.test(username || '')) return `Username must contain ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} letters, numbers, or underscores.`;
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return `Password must contain ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`;
  return null;
}

export async function registerUser({ username, password }) {
  try {
    const existing = await prisma.users.findUnique({ where: { username } });
    if (existing) return { error: 'That username is already in use.' };
    const user = await prisma.users.create({
      data: { user_id: randomUUID(), username, password: await hashPassword(password) },
      select: { id: true, user_id: true, username: true, created_at: true }
    });
    return { user };
  } catch (error) {
    throw databaseError('registerUser', 'register', error);
  }
}

export async function authenticateUser({ username, password }) {
  try {
    const user = await prisma.users.findUnique({ where: { username }, select: { id: true, user_id: true, username: true, password: true, is_admin: true, deleted: true } });
    if (!user || !(await verifyPassword(password, user.password))) return null;
    if (user.deleted) return { suspended: true };
    return { id: user.id, user_id: user.user_id, is_admin: user.is_admin };
  } catch (error) {
    throw databaseError('authenticateUser', 'read', error);
  }
}

export async function getAuthenticatedUser(userId) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, user_id: true, username: true, created_at: true, is_admin: true, deleted: true, character: { select: { id: true } } }
    });
    if (!user || user.deleted) return null;

    return { id: user.id, user_id: user.user_id, username: user.username, createdAt: user.created_at, isAdmin: user.is_admin, hasCharacter: Boolean(user.character) };
  } catch (error) {
    throw databaseError('getAuthenticatedUser', 'read', error);
  }
}
