import { pathToFileURL } from 'node:url';
import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';

const places = [
  { name: 'Honeywood Forest', sublocations: [
    { name: 'Wolf Nest', sublocation_type: 'DEFAULT', description: 'A wolf nesting ground within Honeywood Forest.' }
  ] },
  { name: 'Bandit Hideout', sublocations: [
    { name: 'Bandit Hideout Underground', sublocation_type: 'SECRET_HIDEOUT', description: 'The concealed underground section of the Bandit Hideout.' },
    { name: 'Bandit Hideout Underground Prison', sublocation_type: 'DEFAULT', description: 'The underground prison of the Bandit Hideout.' },
    { name: 'Bandit Hideout Underground Main Hall', sublocation_type: 'SECRET_HIDEOUT', description: 'The hidden underground main hall commanded by Bandit Leader Kakku.' }
  ] },
  { name: 'Goblin Camp', sublocations: [] },
  { name: 'Orge Camp', sublocations: [] }
];

const banditPlaces = ['Bandit Hideout', 'Bandit Hideout Underground Prison', 'Bandit Hideout Underground', 'Bandit Hideout Underground Main Hall'];
const appearances = {
  Rabbit: ['Honeywood Forest'],
  Slime: ['Honeywood Forest'],
  Boar: ['Honeywood Forest'],
  Wolf: ['Wolf Nest'],
  Goblin: ['Goblin Camp'],
  Orge: ['Orge Camp'],
  Bandit: banditPlaces,
  'Mage Bandit': banditPlaces,
  'Bandit Leader Kakku': ['Bandit Hideout Underground Main Hall']
};

// Can run independently without reseeding stats, inventory, or other world data.
export async function seedZaunLocations(client = prisma) {
  try {
    return await client.$transaction(async (tx) => {
      const regions = await tx.regions.findMany({ where: { name: 'Zaun Kingdom', deleted: false } });
      if (regions.length !== 1) throw new Error('Expected exactly one active Zaun Kingdom region.');
      const npcs = await tx.characters.findMany({
        where: { name: { in: Object.keys(appearances) }, character_type: 'NPC', deleted: false, npc: { is: { deleted: false } } },
        select: { id: true, name: true }
      });
      for (const name of Object.keys(appearances)) {
        if (npcs.filter((npc) => npc.name === name).length !== 1) {
          throw new Error(`Expected exactly one active NPC named ${name}.`);
        }
      }

      const targets = new Map();
      for (const place of places) {
        const matches = await tx.locations.findMany({ where: { region_id: regions[0].id, name: place.name } });
        if (matches.length > 1) throw new Error(`Ambiguous location: ${place.name}.`);
        const data = { region_id: regions[0].id, name: place.name, location_type: 'DANGER_FIELD', is_safe_zone: false, deleted: false };
        const location = matches.length
          ? await tx.locations.update({ where: { id: matches[0].id }, data })
          : await tx.locations.create({ data });
        targets.set(place.name, { location_id: location.id, sublocation_id: null, parentId: location.id });
        for (const sublocation of place.sublocations) {
          const matches = await tx.sublocations.findMany({ where: { location_id: location.id, name: sublocation.name } });
          if (matches.length > 1) throw new Error(`Ambiguous sublocation: ${sublocation.name}.`);
          const data = { ...sublocation, location_id: location.id, deleted: false };
          const saved = matches.length
            ? await tx.sublocations.update({ where: { id: matches[0].id }, data })
            : await tx.sublocations.create({ data });
          targets.set(sublocation.name, { location_id: null, sublocation_id: saved.id, parentId: location.id });
        }
      }

      let mappingCount = 0;
      for (const npc of npcs) {
        const destinations = appearances[npc.name].map((name) => targets.get(name));
        const desired = destinations.map(({ location_id, sublocation_id }) => ({ location_id, sublocation_id }));
        await tx.npcs_in_locations_or_sublocations.updateMany({
          where: { npc_id: npc.id, NOT: { OR: desired } }, data: { deleted: true }
        });
        for (const destination of desired) {
          const where = destination.location_id !== null
            ? { npc_id_location_id: { npc_id: npc.id, location_id: destination.location_id } }
            : { npc_id_sublocation_id: { npc_id: npc.id, sublocation_id: destination.sublocation_id } };
          await tx.npcs_in_locations_or_sublocations.upsert({
            where,
            create: { npc_id: npc.id, ...destination, deleted: false },
            update: { deleted: false }
          });
          mappingCount++;
        }
        // Keep the legacy current location at the first requested appearance.
        await tx.characters.update({
          where: { id: npc.id },
          data: { location_id: destinations[0].parentId, sublocation_id: destinations[0].sublocation_id }
        });
      }
      return { locations: places.length, sublocations: places.reduce((count, place) => count + place.sublocations.length, 0), npcs: npcs.length, mappings: mappingCount };
    }, { timeout: 30000 });
  } catch (error) {
    // Only safe context is logged; raw driver errors can contain connection details.
    throw databaseError('seedZaunLocations', 'assign Zaun NPC locations', new Error(error.code || 'Zaun location update failed'));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedZaunLocations()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
