import assert from 'node:assert/strict';
import prisma from '../src/services/prismaClient.js';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { buildContextCheckReport, previewContextCheck } from '../src/services/contextCheckService.js';

async function runTests() {
  try {
    const character = await prisma.characters.findFirst({
      where: { character_type: 'PLAYER', deleted: false },
      include: { user: true }
    });

    if (character && character.user_id) {
      const previewReport = await previewContextCheck({
        userId: character.user_id,
        characterId: character.id,
        actionText: 'I look around the room for any hidden doors.',
        actionMode: 'story',
        history: [
          { role: 'user', content: 'I enter the old tavern.' },
          { role: 'assistant', content: 'Dust swirls as you step across the threshold.' }
        ]
      });

      assert.ok(previewReport, 'Preview report should be generated');
      assert.ok(Array.isArray(previewReport.categories), 'Categories should be an array');
      assert.ok(previewReport.categories.length > 0, 'Categories should not be empty');

      for (const cat of previewReport.categories) {
        assert.ok(cat.key, 'Category key must exist');
        assert.ok(cat.label, 'Category label must exist');
        assert.equal(typeof cat.characters, 'number', 'Category characters must be a number');
        assert.equal(typeof cat.estimatedTokens, 'number', 'Category estimatedTokens must be a number');
        assert.equal(cat.text, undefined, 'Category must not leak prompt text');
      }

      assert.ok(previewReport.before, 'report.before must exist');
      assert.ok(previewReport.before.estimatedTokens > 0, 'Estimated tokens must be > 0');
      assert.ok(previewReport.before.characters > 0, 'Characters must be > 0');
      assert.equal(typeof previewReport.before.text, 'string', 'before.text must be a string');

      assert.ok(!previewReport.before.text.includes('[system]'), 'before.text must not contain [system]');
      assert.ok(!previewReport.before.text.includes('Selected Action Mode'), 'before.text must not contain action mode directives');
      assert.ok(!previewReport.before.text.includes('Conversational Target'), 'before.text must not contain target directives');
      assert.ok(!previewReport.before.text.includes('Dungeon Master'), 'before.text must not contain system prompt');
      assert.ok(previewReport.before.text.includes('I enter the old tavern.'), 'before.text must include history user action');
      assert.ok(previewReport.before.text.includes('Dust swirls as you step across the threshold.'), 'before.text must include history narration');
      assert.ok(previewReport.before.text.includes('I look around the room for any hidden doors.'), 'before.text must include current action');
    }

    const segments = [
      { category: 'system', text: 'SECRET SYSTEM PROMPT: You are Stervian AI.' },
      { category: 'actionMode', text: 'SECRET ACTION MODE: /story rules apply.' },
      { category: 'targetDirectives', text: 'SECRET TARGET DIRECTIVE: Target is NONE.' },
      { category: 'aiDm', text: 'SECRET AI DM: Rule with an iron hand.' },
      { category: 'roleplay', text: 'SECRET ROLEPLAY: Stay in character.' }
    ];

    const beforeMessages = [
      new SystemMessage({ content: 'SECRET SYSTEM PROMPT: You are Stervian AI.\nSECRET ACTION MODE: /story rules apply.' }),
      new HumanMessage({ content: 'I approach the ancient altar.' })
    ];

    const afterMessages = [
      new SystemMessage({ content: 'SECRET SYSTEM PROMPT: You are Stervian AI.\nSECRET ACTION MODE: /story rules apply.' }),
      new HumanMessage({ content: 'I approach the ancient altar.' }),
      new AIMessage({ content: '', tool_calls: [{ name: 'search_world_npc', args: { query: 'altar' } }] }),
      new ToolMessage({ content: '{"result":"sacred altar"}', tool_call_id: 'call_1' }),
      new AIMessage({ content: 'Runes carved into the obsidian surface pulse with pale sapphire luminescence.' })
    ];

    const report = buildContextCheckReport({
      segments,
      beforeMessages,
      afterMessages,
      model: 'deepseek-flash',
      isFallback: false
    });

    assert.ok(report.categories.length >= 5, 'All categories should be measured');
    for (const cat of report.categories) {
      assert.equal(cat.text, undefined, 'Category should not expose text');
      assert.ok(cat.estimatedTokens >= 0, 'Category tokens should be non-negative');
    }

    assert.ok(!report.before.text.includes('SECRET'), 'before.text must not contain SECRET system prompts');
    assert.ok(!report.before.text.includes('[system]'), 'before.text must not contain [system]');
    assert.ok(report.before.text.includes('I approach the ancient altar.'), 'before.text must contain player action');
    assert.ok(report.before.estimatedTokens > 0, 'before.estimatedTokens must measure full context');

    assert.ok(!report.after.text.includes('SECRET'), 'after.text must not contain SECRET system prompts');
    assert.ok(!report.after.text.includes('[system]'), 'after.text must not contain [system]');
    assert.ok(!report.after.text.includes('search_world_npc'), 'after.text must not leak tool call details');
    assert.ok(!report.after.text.includes('sacred altar'), 'after.text must not leak raw tool output');
    assert.ok(report.after.text.includes('I approach the ancient altar.'), 'after.text must contain player action');
    assert.ok(report.after.text.includes('Runes carved into the obsidian surface pulse with pale sapphire luminescence.'), 'after.text must contain final story narration');

    console.log('ALL CONTEXT CHECK SANITIZATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    await prisma.$disconnect();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
