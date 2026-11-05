import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRoleplayIntoStory, splitPerformance } from '../src/services/ai/agentHarness/splitPipeline.js';
import { AGENT_PIPELINE } from '../src/configs/constants.js';

const SLOT = AGENT_PIPELINE.NPC_SLOT_TOKEN;

test('agent pipeline helpers', async (t) => {
  await t.test('merges the roleplay reply at the slot in the speaker format', () => {
    const story = mergeRoleplayIntoStory(`Steel rasps free.\n\n${SLOT}\n\nSilence.`, 'Zanla Lehey', { dialogue: '"Not in my inn."', bodyLanguage: 'Her voice drops low.' }, 'beat');
    assert.equal(story, 'Steel rasps free.\n\nHer voice drops low.\n\n[Speaker: Zanla Lehey]: "Not in my inn."\n\nSilence.');
  });

  await t.test('uses the beat when roleplay fails and appends when the slot is missing', () => {
    assert.equal(mergeRoleplayIntoStory(`A.\n\n${SLOT}\n\nB.`, 'Zanla Lehey', null, 'Zanla shakes her head.'), 'A.\n\nZanla shakes her head.\n\nB.');
    assert.equal(mergeRoleplayIntoStory('A.', 'Zanla Lehey', { dialogue: 'Hello.' }, ''), 'A.\n\n[Speaker: Zanla Lehey]: "Hello."');
  });

  await t.test('splits narration mixed into the dialogue out of the speech card', () => {
    const parts = splitPerformance(`'Quinn.' She sets the mug down. 'That's blood on my door.'`);
    assert.deepEqual(parts.map((part) => part.type), ['speech', 'action', 'speech']);
    assert.equal(parts[2].text, "That's blood on my door.");
    const story = mergeRoleplayIntoStory(SLOT, 'Zanla Lehey', { dialogue: `'Quinn.' She sets the mug down. 'Sit.'` }, '');
    assert.equal(story, '[Speaker: Zanla Lehey]: "Quinn."\n\nShe sets the mug down.\n\n[Speaker: Zanla Lehey]: "Sit."');
  });
});
