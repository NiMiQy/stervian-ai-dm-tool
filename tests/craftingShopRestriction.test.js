import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../src/services/prismaClient.js';
import { getCraftingData } from '../src/containers/craftingContainer.js';

async function runTests() {
  const testUserGuid = crypto.randomUUID();
  let userRecordId = null;
  let testCharacterId = null;

  try {
    const user = await prisma.users.create({
      data: {
        user_id: testUserGuid,
        username: `craft_test_${Date.now()}`,
        password: 'test_password',
        is_admin: false
      }
    });
    userRecordId = user.id;

    const location = await prisma.locations.findFirst({ where: { name: 'Honeywood Village', deleted: false } });
    const sublocation = await prisma.sublocations.findFirst({ where: { location_id: location?.id, deleted: false } });

    const character = await prisma.characters.create({
      data: {
        user_id: testUserGuid,
        name: 'Crafting Test Char',
        character_type: 'PLAYER',
        location_id: location?.id || null,
        sublocation_id: sublocation?.id || null,
        player: {
          create: { gold: 100 }
        },
        character_stat: {
          create: {
            current_hp: 50,
            max_hp: 50,
            current_energy: 50,
            max_energy: 50
          }
        },
        character_inventory: {
          create: { max_slots: 20 }
        }
      }
    });
    testCharacterId = character.id;

    const dataWithSub = await getCraftingData(testUserGuid);
    assert.equal(dataWithSub.character.sublocation_id, sublocation?.id || null);
    if (sublocation) {
      assert.ok(dataWithSub.character.sublocation);
      assert.equal(dataWithSub.character.sublocation.id, sublocation.id);
    }

    await prisma.characters.update({
      where: { id: testCharacterId },
      data: { sublocation_id: null }
    });

    const dataWithoutSub = await getCraftingData(testUserGuid);
    assert.equal(dataWithoutSub.character.sublocation_id, null);
    assert.equal(dataWithoutSub.character.sublocation, null);

    console.log('Crafting shop restriction data tests passed.');
  } finally {
    if (testCharacterId) {
      await prisma.character_stats.deleteMany({ where: { character_id: testCharacterId } });
      await prisma.character_inventory.deleteMany({ where: { character_id: testCharacterId } });
      await prisma.players.deleteMany({ where: { character_id: testCharacterId } });
      await prisma.characters.deleteMany({ where: { id: testCharacterId } });
    }
    if (userRecordId) {
      await prisma.users.deleteMany({ where: { id: userRecordId } });
    }
    await prisma.$disconnect();
  }
}

runTests().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
