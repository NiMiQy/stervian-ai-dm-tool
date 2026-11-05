import assert from 'node:assert/strict';
import prisma from '../src/services/prismaClient.js';
import { COMBAT_EFFECT_DESCRIPTIONS } from '../src/prisma/updates/updateCombatEffectDescriptions.js';

async function runTests() {
  try {
    const effectNames = Object.keys(COMBAT_EFFECT_DESCRIPTIONS);
    const effects = await prisma.effects.findMany({
      where: {
        name: { in: effectNames },
        deleted: false
      }
    });

    assert.equal(effects.length, effectNames.length);

    for (const effect of effects) {
      const expectedDescription = COMBAT_EFFECT_DESCRIPTIONS[effect.name];
      assert.ok(expectedDescription);
      assert.equal(effect.description, expectedDescription);
    }

    console.log('Combat effect descriptions test passed successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
