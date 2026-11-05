import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';

export async function getUserAccount(userId) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        user_id: true,
        username: true,
        created_at: true,
        deleted: true
      }
    });

    return user?.deleted ? null : user;
  } catch (error) {
    throw databaseError('getUserAccount', 'read', error);
  }
}
