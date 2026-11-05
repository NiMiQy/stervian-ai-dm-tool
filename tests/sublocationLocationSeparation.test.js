import assert from 'node:assert/strict';
import prisma from '../src/services/prismaClient.js';
import { formatLocationContext } from '../src/services/ai/prompts/formatters.js';
import { inspectCurrentLocationTool } from '../src/services/ai/agentHarness/tools/worldTools.js';
import { roleplayNpcTool } from '../src/services/ai/agentHarness/tools/roleplayTools.js';
import { prepareContextWindow } from '../src/services/ai/lifecycle/context.js';
import { enterSublocation } from '../src/containers/characterContainer.js';

async function runTests() {
  const character = await prisma.characters.findFirst({
    where: { character_type: 'PLAYER', deleted: false },
    include: { location: true, sublocation: true, user: true }
  });
  assert.ok(character, 'Character must exist');

  const initialSublocationId = character.sublocation_id;

  try {
    const outdoorContext = formatLocationContext(character.location, null, [], null, 0);
    assert.ok(outdoorContext.includes('None (OUTDOORS / MAIN AREA)'), 'Must indicate outdoors when sublocation is null');
    assert.ok(outdoorContext.includes('NOT inside any sublocation'), 'Must state not inside any sublocation');
    assert.ok(outdoorContext.includes('Scene Transition'), 'Must include scene transition guidance');

    const fakeSub = { id: 999, name: 'Test Inn', sublocation_type: 'INN', description: 'Cozy inn' };
    const indoorContext = formatLocationContext(character.location, fakeSub, [], null, 0);
    assert.ok(indoorContext.includes('INSIDE SUBLOCATION: "Test Inn"'), 'Must indicate inside sublocation');

    await prisma.characters.update({
      where: { id: character.id },
      data: { sublocation_id: null }
    });

    const activeCharOutdoor = await prisma.characters.findUnique({
      where: { id: character.id },
      include: { location: true, sublocation: true }
    });

    const inspectOutdoorRaw = await inspectCurrentLocationTool.invoke(
      { character_id: character.id },
      { configurable: { character: activeCharOutdoor, characterId: character.id, prisma } }
    );
    const inspectOutdoor = JSON.parse(inspectOutdoorRaw);
    assert.equal(inspectOutdoor.isInsideSublocation, false, 'isInsideSublocation must be false');
    assert.equal(inspectOutdoor.currentSublocation, null, 'currentSublocation must be null');
    assert.ok(inspectOutdoor.environmentStatus.includes('Outdoors'), 'environmentStatus must say Outdoors');

    const roleplayOutdoorRaw = await roleplayNpcTool.invoke(
      { npc_name: 'Zanla Lehey', player_dialogue_or_intent: 'Hello Zanla' },
      { configurable: { character: activeCharOutdoor, characterId: character.id, userId: character.user_id, prisma } }
    );
    const roleplayOutdoor = JSON.parse(roleplayOutdoorRaw);
    assert.equal(roleplayOutdoor.error, 'NPC_NOT_COPRESENT', 'Must return NPC_NOT_COPRESENT when Zanla is indoors and player is outdoors');
    assert.ok(!roleplayOutdoor.message.includes('your current sublocation (Honeywood Village)'), 'Must not call location a sublocation');

    const inn = await prisma.sublocations.findFirst({
      where: { location_id: character.location_id, deleted: false, name: { contains: 'Inn' } }
    });

    if (inn) {
      const enterResult = await enterSublocation(character.user_id, inn.id);
      assert.ok(enterResult.success, 'enterSublocation container function must succeed');

      const activeCharIndoor = await prisma.characters.findUnique({
        where: { id: character.id },
        include: { location: true, sublocation: true }
      });
      assert.equal(activeCharIndoor.sublocation_id, inn.id, 'Character must now be in the inn');

      const inspectIndoorRaw = await inspectCurrentLocationTool.invoke(
        { character_id: character.id },
        { configurable: { character: activeCharIndoor, characterId: character.id, prisma } }
      );
      const inspectIndoor = JSON.parse(inspectIndoorRaw);
      assert.equal(inspectIndoor.isInsideSublocation, true, 'isInsideSublocation must be true indoors');
      assert.equal(inspectIndoor.currentSublocation, inn.name, 'currentSublocation must match inn name');

      const contextObj = {
        userId: character.user_id,
        characterId: character.id,
        character: { ...activeCharIndoor },
        cleanAction: 'I go outside Honeywood village',
        actionText: 'I go outside Honeywood village',
        db: prisma
      };
      await prepareContextWindow(contextObj);
      assert.equal(contextObj.character.sublocation_id, inn.id, 'prepareContextWindow must not move the player when they type an exit action');

      const checkDb = await prisma.characters.findUnique({
        where: { id: character.id },
        select: { sublocation_id: true }
      });
      assert.equal(checkDb.sublocation_id, inn.id, 'Database sublocation_id must stay on the inn after a typed exit action');
    }

    console.log('ALL SUBLOCATION/LOCATION SEPARATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    await prisma.characters.update({
      where: { id: character.id },
      data: { sublocation_id: initialSublocationId }
    });
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
