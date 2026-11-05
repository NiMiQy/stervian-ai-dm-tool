import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/services/prismaClient.js';
import {
  PartyTurnError,
  buildPartyTurn,
  fillRevealTexts,
  findPartySpeaker,
  formatPartyTurnAction,
  formatPartyTurnForPrompt,
  isMultiplayerParty,
  normalizePartyActions
} from '../src/services/partyTurnService.js';
import { PARTY_TURN } from '../src/configs/constants.js';

const party = {
  id: 7,
  leader_character_id: 1,
  members: [
    { character_id: 1, user_id: 'u1', name: 'Quinn Wison', is_player: true, is_leader: true },
    { character_id: 2, user_id: 'u2', name: 'LoneWolf', is_player: true },
    { character_id: 3, user_id: 'u3', name: 'GM Test', is_player: true },
    { character_id: 9, user_id: null, name: 'Roland', is_player: false }
  ]
};
const leader = { id: 1, name: 'Quinn Wison' };
const online = new Set(['u2', 'u3']);
const isOnline = (userId) => online.has(userId);
const turnOf = (actions, overrides = {}) => buildPartyTurn({ leaderCharacter: leader, party, partyId: 7, actions: normalizePartyActions(actions), isOnline, ...overrides });

test('party turn composer', async (t) => {
  t.after(async () => { await prisma.$disconnect(); });

  await t.test('only multiplayer parties use the composer', () => {
    assert.equal(isMultiplayerParty(party), true);
    assert.equal(isMultiplayerParty({ members: [party.members[0], party.members[3]] }), false);
  });

  await t.test('rejects non-leaders, wrong party, companions, offline members and empty turns', () => {
    assert.throws(() => turnOf([], { leaderCharacter: { id: 2 } }), PartyTurnError);
    assert.throws(() => turnOf([], { partyId: 8 }), PartyTurnError);
    assert.throws(() => turnOf([{ characterId: 9, text: 'hi' }]), new RegExp(PARTY_TURN.INVALID_MEMBER_ERROR));
    assert.throws(() => turnOf([{ characterId: 3, text: 'x' }], { isOnline: () => false }), new RegExp(PARTY_TURN.INVALID_MEMBER_ERROR));
    assert.throws(() => turnOf([{ characterId: 1, text: '   ' }]), new RegExp(PARTY_TURN.EMPTY_ERROR));
  });

  await t.test('keeps every line with its own speaker, leader first, trimmed to the limit', () => {
    const turn = turnOf([
      { characterId: 2, text: 'Also, you are so beautiful Zanla' },
      { characterId: 1, text: '' },
      { characterId: 3, text: 'x'.repeat(PARTY_TURN.ACTION_MAX_LENGTH + 50) }
    ]);
    assert.deepEqual(turn.speakers.map((speaker) => speaker.characterId), [1, 2, 3]);
    assert.equal(turn.speakers[2].text.length, PARTY_TURN.ACTION_MAX_LENGTH);
    assert.equal(formatPartyTurnAction(turn).split('\n')[0], '[LoneWolf]: Also, you are so beautiful Zanla');
    assert.equal(findPartySpeaker(turn, 'lonewolf').characterId, 2);
    assert.equal(findPartySpeaker(turn, 'Nobody'), null);
  });

  await t.test('a reveal-only row gets a spoken line', () => {
    const turn = fillRevealTexts(turnOf([{ characterId: 2, text: '', revealName: true }]), 'Zanla Lehey');
    assert.equal(turn.speakers.find((speaker) => speaker.characterId === 2).text, 'I tell Zanla Lehey my real name: LoneWolf.');
  });

  await t.test('prompt block names the single party roleplay call', () => {
    const turn = turnOf([{ characterId: 2, text: 'Hey Zanla' }]);
    turn.speakers.forEach((speaker) => { speaker.npcLabel = speaker.characterId === 2 ? 'Gem' : PARTY_TURN.STRANGER_LABEL; });
    const prompt = formatPartyTurnForPrompt(turn, 'Zanla Lehey');
    assert.match(prompt, /\[LoneWolf\] - Zanla Lehey knows them as "Gem": "Hey Zanla"/);
    assert.match(prompt, /\[Quinn Wison\] \(party leader, acting player\) - Zanla Lehey knows them as a stranger/);
    assert.match(prompt, /roleplay_npc_party exactly once/);
  });
});
