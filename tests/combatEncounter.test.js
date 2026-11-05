import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/services/prismaClient.js';
import { HARNESS_TOOLS, MASTER_TOOLS } from '../src/services/ai/agentHarness/tools/index.js';
import { getAreaCombatTargets, normalizeAreaCombatSelection, resolveAreaCombatNames } from '../src/containers/areaCombatContainer.js';
import { ACTION_MODES, AREA_COMBAT, CHARACTER_TYPE, MAX_ENCOUNTER_ENEMIES, VALID_ACTION_MODES } from '../src/configs/constants.js';

test('Area combat selection replaces AI combat detection', async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await t.test('the AI can no longer start combat', () => {
    assert.equal(ACTION_MODES.COMBAT, undefined);
    assert.deepEqual(VALID_ACTION_MODES, ['story']);
    assert.equal(HARNESS_TOOLS.some((entry) => entry.name === 'trigger_combat_encounter'), false);
    assert.equal(MASTER_TOOLS.some((entry) => entry.name === 'trigger_combat_encounter'), false);
  });

  await t.test('selection is validated before any lookup', () => {
    assert.ok(normalizeAreaCombatSelection([]).error);
    assert.ok(normalizeAreaCombatSelection([{ id: 'x', count: 1 }]).error);
    assert.ok(normalizeAreaCombatSelection([{ id: 1, count: 0 }]).error);
    assert.ok(normalizeAreaCombatSelection([{ id: 1, count: 1 }, { id: 1, count: 1 }]).error);
    assert.ok(normalizeAreaCombatSelection([{ id: 1, count: 3 }, { id: 2, count: 3 }]).error);
    const ok = normalizeAreaCombatSelection([{ id: 1, count: 2 }, { id: 2, count: 3 }]);
    assert.equal(ok.error, undefined);
    assert.equal(ok.total, MAX_ENCOUNTER_ENEMIES);
  });

  await t.test('monsters mix, an NPC fights alone, absent targets are refused', () => {
    const area = {
      monsters: [{ id: 10, name: 'Wolf' }, { id: 11, name: 'Rabbit' }],
      npcs: [{ id: 20, name: 'Bandit Chief' }]
    };
    assert.deepEqual(resolveAreaCombatNames(area, [{ id: 10, count: 2 }, { id: 11, count: 1 }]).names, ['Wolf', 'Wolf', 'Rabbit']);
    assert.deepEqual(resolveAreaCombatNames(area, [{ id: 20, count: 1 }]), { names: ['Bandit Chief'], isNpc: true });
    assert.equal(resolveAreaCombatNames(area, [{ id: 20, count: 2 }]).error, AREA_COMBAT.NPC_ONLY_ONE_ERROR);
    assert.equal(resolveAreaCombatNames(area, [{ id: 20, count: 1 }, { id: 10, count: 1 }]).error, AREA_COMBAT.NPC_ONLY_ONE_ERROR);
    assert.equal(resolveAreaCombatNames(area, [{ id: 99, count: 1 }]).error, AREA_COMBAT.NOT_HERE_ERROR);
  });

  await t.test('area targets match the spawn records at the player spot', async () => {
    const players = await prisma.characters.findMany({
      where: { deleted: false, character_type: CHARACTER_TYPE.PLAYER, user_id: { not: null }, location_id: { not: null } },
      select: { user_id: true, location_id: true, sublocation_id: true }
    });
    assert.ok(players.length > 0, 'Needs at least one placed player character in the database.');

    for (const player of players) {
      const area = await getAreaCombatTargets(player.user_id);
      const scope = player.sublocation_id
        ? { sublocation_id: player.sublocation_id }
        : { location_id: player.location_id, sublocation_id: null };
      const rows = await prisma.npcs_in_locations_or_sublocations.findMany({
        where: { deleted: false, ...scope, npc: { is: { deleted: false, is_attackable: true, character: { is: { deleted: false, character_type: CHARACTER_TYPE.NPC } } } } },
        select: { npc: { select: { character_id: true, npc_monsters: { select: { deleted: true } } } } }
      });
      const expectedMonsters = new Set(rows.filter((row) => row.npc.npc_monsters && row.npc.npc_monsters.deleted !== true).map((row) => row.npc.character_id));
      const expectedNpcs = new Set(rows.filter((row) => !row.npc.npc_monsters).map((row) => row.npc.character_id));
      assert.deepEqual(new Set(area.monsters.map((entry) => entry.id)), expectedMonsters);
      assert.deepEqual(new Set(area.npcs.map((entry) => entry.id)), expectedNpcs);
      const unattackable = await prisma.npcs.count({ where: { character_id: { in: [...expectedMonsters, ...expectedNpcs] }, NOT: { is_attackable: true } } });
      assert.equal(unattackable, 0);
    }
  });
});
