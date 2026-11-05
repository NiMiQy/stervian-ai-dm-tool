import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../src/services/prismaClient.js';
import { getShopItems } from '../src/containers/sublocationContainer.js';
import { buyShopItem } from '../src/containers/characterContainer.js';
import { WOODEN_WEAPONS } from '../src/prisma/updates/addWoodenWeaponsToHoneywoodInn.js';

async function runTests() {
  const testUserGuid = crypto.randomUUID();
  let userRecordId = null;
  let testCharacterId = null;

  try {
    const inn = await prisma.sublocations.findFirst({
      where: {
        name: "Honey Zanla's Inn",
        deleted: false
      }
    });
    assert.ok(inn, "Honey Zanla's Inn must exist");

    const shopData = await getShopItems(inn.id, null, null);
    assert.ok(shopData, 'Shop data must exist');
    assert.ok(Array.isArray(shopData.items), 'Shop items must be an array');

    const shopItemNames = new Set(shopData.items.map((item) => item.name));
    for (const weaponName of WOODEN_WEAPONS) {
      assert.ok(
        shopItemNames.has(weaponName),
        `Expected ${weaponName} to be sold in Honeywood Inn shop`
      );
      const itemRecord = shopData.items.find((item) => item.name === weaponName);
      assert.equal(itemRecord.is_buyable, true);
    }

    const user = await prisma.users.create({
      data: {
        user_id: testUserGuid,
        username: `shop_test_${Date.now()}`,
        password: 'test_password',
        is_admin: false
      }
    });
    userRecordId = user.id;

    const character = await prisma.characters.create({
      data: {
        user_id: testUserGuid,
        name: 'Shop Buyer Test',
        character_type: 'PLAYER',
        location_id: inn.location_id,
        sublocation_id: inn.id,
        player: {
          create: { gold: 100000 }
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

    const woodenSword = shopData.items.find((item) => item.name === 'Wooden Sword');
    assert.ok(woodenSword, 'Wooden Sword item must exist in shop');

    const buyResult = await buyShopItem(testUserGuid, {
      sublocationId: inn.id,
      itemId: woodenSword.id,
      quantity: 1
    });

    assert.equal(buyResult.success, true);

    const updatedCharacter = await prisma.characters.findUnique({
      where: { id: testCharacterId },
      include: {
        player: true,
        character_items: {
          where: { item_id: woodenSword.id }
        }
      }
    });

    assert.equal(updatedCharacter.character_items.length, 1);
    assert.equal(updatedCharacter.character_items[0].quantity, 1);
    assert.equal(updatedCharacter.player.gold, 100000 - woodenSword.price);

    console.log('Honeywood inn shop tests passed successfully.');
  } finally {
    if (testCharacterId) {
      await prisma.character_items.deleteMany({ where: { character_id: testCharacterId } });
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
