import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prisma from '../src/services/prismaClient.js';
import { MCP_TABLES, MCP_TABLE_MAP, MCP_TABLE_NAMES } from '../src/services/mcp/core/registry.js';
import { createStory, updateStory } from '../src/services/mcp/stories/stories.js';
import { CHARACTER_TYPE, MCP_DB_MESSAGES } from '../src/configs/constants.js';

const modelsDir = fileURLToPath(new URL('../src/prisma/models/', import.meta.url));
const schemaModels = readdirSync(modelsDir)
  .filter((file) => file.endsWith('.prisma'))
  .flatMap((file) => [...readFileSync(`${modelsDir}${file}`, 'utf8').matchAll(/^\s*model\s+(\w+)\s*\{/gm)].map((match) => match[1]));

test('MCP database tools', async (t) => {
  const createdStoryIds = [];
  t.after(async () => {
    if (createdStoryIds.length) await prisma.stories.deleteMany({ where: { id: { in: createdStoryIds } } });
    await prisma.$disconnect();
  });

  await t.test('every Prisma model has exactly one MCP table file', () => {
    assert.deepEqual([...MCP_TABLE_NAMES].sort(), [...new Set(schemaModels)].sort());
  });

  await t.test('only stories is writable', () => {
    assert.deepEqual(MCP_TABLES.filter((table) => table.writable).map((table) => table.table), ['stories']);
  });

  await t.test('every table can be searched against the real database', async () => {
    for (const table of MCP_TABLES) {
      const page = await table.search({ limit: 1, includeDeleted: true });
      assert.equal(page.table, table.table);
      assert.ok(page.total >= page.results.length, `${table.table} total`);
      for (const row of page.results) {
        for (const hidden of table.hidden) assert.equal(Object.hasOwn(row, hidden), false, `${table.table}.${hidden} leaked`);
      }
    }
  });

  await t.test('password and image blobs are never returned', async () => {
    const users = await MCP_TABLE_MAP.get('users').search({ limit: 5 });
    users.results.forEach((row) => assert.equal(Object.hasOwn(row, 'password'), false));
    const characters = await MCP_TABLE_MAP.get('characters').search({ limit: 5 });
    characters.results.forEach((row) => assert.equal(Object.hasOwn(row, 'image_data'), false));
  });

  await t.test('filters match the same rows as a direct query', async () => {
    const expected = await prisma.items.count({ where: { name: { contains: 'a' }, OR: [{ deleted: false }, { deleted: null }] } });
    const page = await MCP_TABLE_MAP.get('items').search({ filters: [{ field: 'name', op: 'contains', value: 'a' }] });
    assert.equal(page.total, expected);
  });

  await t.test('stories can be created and edited, with checks', async () => {
    const player = await prisma.characters.findFirst({
      where: { character_type: CHARACTER_TYPE.PLAYER, user_id: { not: null }, OR: [{ deleted: false }, { deleted: null }] },
      select: { id: true, user_id: true, location_id: true, sublocation_id: true }
    });
    assert.ok(player, 'Needs at least one player character in the database.');

    const created = await createStory({ character_id: player.id, story: '[mcp test] The wind howls.', action_from_player: '[mcp test] I listen.' });
    createdStoryIds.push(created.record.id);
    assert.equal(created.record.user_id, player.user_id);
    assert.equal(created.record.location_id, player.location_id ?? null);
    assert.equal(created.record.sublocation_id, player.sublocation_id ?? null);

    const updated = await updateStory({ id: created.record.id, story: '[mcp test] The wind falls silent.' });
    assert.equal(updated.record.story, '[mcp test] The wind falls silent.');
    assert.equal(updated.record.user_id, player.user_id);

    await assert.rejects(createStory({ character_id: player.id, user_id: 'not-the-owner', story: 'x' }), { message: MCP_DB_MESSAGES.STORY_OWNER_MISMATCH });
    await assert.rejects(createStory({ character_id: player.id, story: '   ' }));
    await assert.rejects(updateStory({ id: created.record.id }), { message: MCP_DB_MESSAGES.STORY_NOTHING_TO_UPDATE });
    await assert.rejects(updateStory({ id: created.record.id, dialogue_message_ids: [1] }), { message: MCP_DB_MESSAGES.STORY_MESSAGES_NEED_SESSION });
  });
});
