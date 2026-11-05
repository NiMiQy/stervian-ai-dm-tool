import bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../configs/constants.js';

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
