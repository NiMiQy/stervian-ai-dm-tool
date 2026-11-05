# Party Turn Composer

## Goal
In a party, the leader writes one action row per online player member. One send = one DM call = one narration. NPCs react to the whole party, and every effect (affinity, offenses, name introductions, reveals, memories) is credited to the member who spoke.

## Decisions
- Leader controls the party prompt. The leader types every row; members see nothing until the turn is sent.
- Rows: leader + each **online player** member. Companions have no row. Empty row = that member stays quiet and follows along.
- One send fires the turn. No timeout, no ready tick. All rows clear after sending.
- Payload: `{ partyId, actions: [{ characterId, text, revealName }] }`. The server checks the sender is the leader, each `characterId` is an online player in that party, trims each text to `PARTY_TURN.ACTION_MAX_LENGTH`, and drops empty rows.
- One target NPC and one mode per turn, both chosen by the leader. With a target, every member's line is spoken to that NPC.
- `roleplay_npc_party`: exactly one subagent call for the target NPC, which reacts to everyone. Never one call per player.
- Effects are credited per speaker: `record_npc_offense` and `introduce_name_to_npc` take a `speaker`, and the memory worker writes one memory per speaker.
- Only the leader moves the party. A member who wants to go elsewhere leaves the party first.
- A "Reveal real name" chip on every row, pressed by the leader, reveals that member's name only. If the name that member gave was false, the -100 penalty hits everyone present.
- Feed: one labelled block per party turn, then one narration.
  - Labels use the name the target NPC knows each member by, or "a stranger".
  - With no target, labels use real names.
  - Each viewer sees their own row as "You".
- AI history stores the turn with real-name labels: `[Quinn Wison]: ...`.
- Presence:
  - A party member who disconnects or signs out is removed from the party. Sign out is instant. A dropped connection waits `PARTY_PRESENCE.NAVIGATION_GRACE_MS` (5s) so that moving between game.html and combat.html, which closes and reopens the socket, does not kick the player.
  - If the leader goes, leadership passes to the next member in join order.
  - In combat, the offline member stays in the battle and auto-Defends, then is removed from the party when the battle ends.
  - A returning player is solo and needs a new invite.
- Solo play is unchanged.

## Data
- `stories.party_turn` (JSON, nullable) holds `[{ characterId, label, text }]` for display. `action_from_player` keeps the real-name block for the AI.
- Migration: `npm run migrate:party-turn`. Restart with `npm start`; prestart regenerates the Prisma client.

## Implemented
- `src/services/partyTurnService.js`: payload validation, label resolution, prompt block, per-speaker reveals.
- `src/services/partyPresenceService.js`: disconnect / sign-out removal and the combat hand-off.
- `roleplay_npc_party` tool; `speaker` argument on `record_npc_offense` and `introduce_name_to_npc`.
- The memory worker runs once per speaker on party turns.
- Combat: offline players auto-Defend (`runNpcTurns`) and leave the party after the battle.
- The combat page now holds a WebSocket so a player in combat counts as online.
- Client: member rows in the composer, a reveal toggle per row, and a labelled party block in the feed.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.