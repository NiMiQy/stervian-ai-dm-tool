import { databaseError } from './databaseError.js';
import prisma from '../services/prismaClient.js';

const prismaClient = prisma;

const initializeDatabase = async () => {
    try {
        await prismaClient.$connect();
        console.log('DATABASE CONNECTION ESTABLISHED SUCCESSFULLY!');
    } catch (error) {
        throw databaseError('initializeDatabase', 'connect', error);
    }
}

export default { initializeDatabase, prismaClient };
