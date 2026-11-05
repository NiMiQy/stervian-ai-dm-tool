import { pathToFileURL } from 'node:url';
import prisma from '../../services/prismaClient.js';
import { databaseError } from '../../database/databaseError.js';

const BASE_TYPES = ['HELMET', 'ARMOR', 'SHOES', 'GLOVES', 'EARRING', 'RING', 'NECKLACE', 'BELT', 'MAIN_HAND', 'TWO_HAND', 'QUEST_ITEMS', 'MISCS', 'FOOD', 'FISH', 'POTION', 'SKILL_SCROLL'];
const LEGACY_TYPES = ['LEFT_EARRING', 'RIGHT_EARRING', 'LEFT_RING', 'RIGHT_RING'];
const enumSql = (values) => `ENUM(${values.map((value) => `'${value}'`).join(',')})`;

export async function mergeRingEarringItemTypes(client = prisma) {
  try {
    await client.$executeRawUnsafe(`ALTER TABLE items MODIFY COLUMN type ${enumSql([...BASE_TYPES, ...LEGACY_TYPES])} NOT NULL`);
    const rings = await client.$executeRawUnsafe("UPDATE items SET type = 'RING' WHERE type IN ('LEFT_RING', 'RIGHT_RING')");
    const earrings = await client.$executeRawUnsafe("UPDATE items SET type = 'EARRING' WHERE type IN ('LEFT_EARRING', 'RIGHT_EARRING')");
    await client.$executeRawUnsafe(`ALTER TABLE items MODIFY COLUMN type ${enumSql(BASE_TYPES)} NOT NULL`);
    return { rings, earrings };
  } catch (error) {
    throw databaseError('mergeRingEarringItemTypes', 'merge ring and earring item types', new Error(error.code || 'Item type migration failed'));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mergeRingEarringItemTypes()
    .then(({ rings, earrings }) => console.log(`items.type now uses RING and EARRING. Converted ${rings} ring(s) and ${earrings} earring(s).`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
