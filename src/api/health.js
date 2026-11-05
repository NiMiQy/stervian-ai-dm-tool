import express from 'express';
import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { databaseFailureMessage } from './middleware.js';
import { HTTP_STATUS } from '../configs/constants.js';

const router = express.Router();

router.get('/', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return response.json({ status: 'ok', database: 'connected', service: 'stervian-web' });
  } catch (error) {
    const message = databaseFailureMessage(databaseError('healthCheck', 'check database connection', error), 'Unable to check database health.');
    return response.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ status: 'degraded', database: 'unavailable', service: 'stervian-web', error: message });
  }
});

export default router;
