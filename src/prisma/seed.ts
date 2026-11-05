import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma-fixed/index.js';
import { databaseError } from '../database/databaseError.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

type SeedRow = Record<string, unknown>;
type SeedData = Record<string, SeedRow[]>;

const SEED_DATA_PATH = new URL('./seed-data/world.json', import.meta.url);
const BINARY_COLUMNS: Record<string, string[]> = { characters: ['image_data'] };
const MAX_PLACEHOLDERS_PER_INSERT = 20000;
const SEED_TRANSACTION_TIMEOUT_MS = 300000;

const databaseUrl = new URL(process.env.DB_URL as string);
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.replace(/^\//, ''),
  connectionLimit: 1
});

const prisma = new PrismaClient({ adapter });

function loadSeedData(): SeedData {
  return JSON.parse(readFileSync(SEED_DATA_PATH, 'utf8')) as SeedData;
}

function toSqlValue(table: string, column: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (BINARY_COLUMNS[table]?.includes(column)) return Buffer.from(String(value), 'base64');
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function chunkRows(rows: SeedRow[], columnCount: number): SeedRow[][] {
  const size = Math.max(1, Math.floor(MAX_PLACEHOLDERS_PER_INSERT / Math.max(1, columnCount)));
  const chunks: SeedRow[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

async function insertTable(tx: Pick<PrismaClient, '$executeRawUnsafe'>, table: string, rows: SeedRow[]): Promise<number> {
  if (!rows.length) return 0;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const columnList = columns.map((column) => `\`${column}\``).join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
  let inserted = 0;
  for (const chunk of chunkRows(rows, columns.length)) {
    const values = chunk.flatMap((row) => columns.map((column) => toSqlValue(table, column, row[column])));
    const sql = `INSERT IGNORE INTO \`${table}\` (${columnList}) VALUES ${chunk.map(() => rowPlaceholder).join(', ')}`;
    inserted += Number(await tx.$executeRawUnsafe(sql, ...values));
  }
  return inserted;
}

async function main() {
  const data = loadSeedData();
  const tables = Object.keys(data);
  console.log(`Seeding Stervian world data (${tables.length} tables)...`);

  const summary = await prisma.$transaction(async (tx) => {
    const results: { table: string; rows: number; inserted: number }[] = [];
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of tables) {
        try {
          const inserted = await insertTable(tx, table, data[table]);
          results.push({ table, rows: data[table].length, inserted });
        } catch (error) {
          throw databaseError('seed', `insert ${table}`, error);
        }
      }
    } finally {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    }
    return results;
  }, { timeout: SEED_TRANSACTION_TIMEOUT_MS, maxWait: SEED_TRANSACTION_TIMEOUT_MS });

  for (const { table, rows, inserted } of summary) {
    if (rows) console.log(`  ${table.padEnd(36)} ${String(inserted).padStart(4)} / ${rows} inserted`);
  }
  const total = summary.reduce((sum, { inserted }) => sum + inserted, 0);
  const skipped = summary.reduce((sum, { rows }) => sum + rows, 0) - total;
  console.log(`Seed completed: ${total} rows inserted${skipped ? `, ${skipped} already existed and were left unchanged` : ''}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
