import { pathToFileURL } from 'node:url';
import prisma from '../../services/prismaClient.js';
import { databaseError } from '../../database/databaseError.js';

const descriptions = {
  'Amwell Village': 'A welcoming village famed for its rich ales and fine wines, brewed and cellared in the surrounding countryside.',
  'Windkeep Village': 'A windswept village renowned for delicate pastries and rich sweet cakes, sought after from nearby hamlets to Shuton City.',
  'Walpool Town': 'A busy coastal town whose markets brim with prized fish, shellfish, and other fresh harvests from the sea.',
  'Kemore Village': 'A settlement beside a vast marsh, known for rare mosses and fragrant spices gathered for cooks across the kingdom.',
  'Kerton Town': 'A thriving crossroads near Shuton City, where goods from villages and towns are sorted, traded, and carried onward to the capital.',
  'Shuton City': 'The capital of the Alborlon Kingdom, seat of the king and queen, and heart of its foreign trade, royal armies, and laws.'
};

export async function updateAlborlonLocationDescriptions(client = prisma) {
  try {
    return await client.$transaction(async (tx) => {
      const updated = [];
      for (const [name, description] of Object.entries(descriptions)) {
        const matches = await tx.locations.findMany({ where: { name, deleted: false }, select: { id: true } });
        if (matches.length !== 1) throw new Error(`Expected exactly one active location named ${name}.`);
        await tx.locations.update({ where: { id: matches[0].id }, data: { description } });
        updated.push(name);
      }
      return updated;
    });
  } catch (error) {
    throw databaseError('updateAlborlonLocationDescriptions', 'update Alborlon location descriptions', new Error(error.code || 'Location description update failed'));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  updateAlborlonLocationDescriptions()
    .then((updated) => console.log(`Updated descriptions for ${updated.length} locations.`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
