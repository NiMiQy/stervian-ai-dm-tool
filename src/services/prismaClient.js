import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma-fixed/index.js';
import { DATABASE_DEFAULTS } from '../configs/constants.js';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const databaseUrl = new URL(process.env.DB_URL);
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || DATABASE_DEFAULTS.PORT),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.replace(/^\//, ''),
  connectionLimit: DATABASE_DEFAULTS.CONNECTION_LIMIT
});

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
