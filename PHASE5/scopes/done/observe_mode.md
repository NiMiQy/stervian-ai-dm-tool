# Observe Mode

## Goal

- The player watches two NPCs interact with each other without taking part, e.g. Rolus and Hina at the Guild Office.
- Each NPC is voiced by its own roleplay subagent and reacts to what the other just said.
- The player chooses how many exchanges happen (repeat count) and can optionally direct the scene.

## Current behavior

- Every turn starts from a player action: Master brief → Narration draft with one `NPC_SLOT_TOKEN` → one roleplay call (`npcRoleplaySubagent`) → `mergeRoleplayIntoStory()` (`agentHarness/splitPipeline.js`).
- The roleplay prompt is built around the player (`### Player's Declared Action Towards You`, memories of the player).
- Only one NPC speaks per turn. NPC-to-NPC data (`npc_relationships`, `character_memories` with an NPC target) is not used to drive a scene.

## 1. Rules

### NPC selection

- Exactly 2 different NPCs: **NPC A** (picked first) and **NPC B**.
- Both are `is_speakable`, not monsters, not deleted.
- Same place, checked with `npcs_in_locations_or_sublocations`:
  - If the player is inside a sublocation, both NPCs must be in **that same sublocation**.
  - If the player is not in a sublocation, both NPCs must be at **that same location** (location-level row, `sublocation_id` null).
- Not allowed in combat. Same rule as Checks / Tools call: blocked in party turn mode and for non-leaders.
- NSFW gating: `is_nsfw` relationships and memories are excluded unless `players.verified && players.is_nsfw`.

### Repeat count

- A whole number, **1 to 3**, default **1**. One repeat = NPC A speaks, then NPC B answers.
- Total beats = `2 × repeat`. NPC A always starts and the speakers always alternate:

| Repeat | Order | Roleplay calls |
|---|---|---|
| 1 | A → B | 2 |
| 2 | A → B → A → B | 4 |
| 3 | A → B → A → B → A → B | 6 |

- The order is fixed by the server, not by the Master.

### Player direction (optional)

- Text box, trimmed, max 1000 characters, e.g. *"Rolus pressures Hina about the boar contract; Hina tries to change the subject."*
- If filled: the Master must build the beats to follow it.
- If empty: the Master invents the scene from both NPCs' personas, their `npc_relationships` rows, the location and the recent story.

## 2. Flow

| Step | Who | Sees | Output |
|---|---|---|---|
| 1. Validate | Server | request, player place, NPC appearances | 400 with a clear message, or continue |
| 2. Plan | Master brief | both NPCs, both relationship rows, location, recent story, player direction (if any), the fixed beat order | Brief with exactly `2 × repeat` beats: `{ npc, intent }` in the server's order |
| 3. Frame | Narration agent | the brief | Scene narration with one named slot per beat, in order (`[[NPC_SLOT:Rolus]]`, `[[NPC_SLOT:Hina Zunko]]`, …) |
| 4. Perform | Roleplay subagent **A** / **B**, one call per beat, in order | **only that NPC's** persona, its own side of the relationship, its own memories of the other NPC, the scene so far including every line already filled | `{ dialogue, bodyLanguage, emotion, attitude }` for that beat |
| 5. Merge | Server | filled beats | One story, slots filled in order |
| 6. Save | Server + memory worker | story | `stories` row + NPC → NPC memories |

- If the Master returns a different number of beats or the wrong speaker order, the server reorders/pads the beats to the fixed order (missing intents become "React to what <other NPC> just said").
- If the narrator leaves fewer slots than beats, the extra beats are appended in order after the last slot.
- If one roleplay call fails, a neutral line goes in ("<A> says something to <B> too quietly for you to catch.") and the next beat still runs. The intent is not used as fallback text, because it can hold that NPC's private intention.
- Roleplay calls run one after another, never in parallel.

## 3. Roleplay prompt for NPC → NPC

New variant in `npcRoleplay.js`. Normal player turns keep the current prompt.

- `### <Other NPC> Just Said / Did`: the previous beat's line (beat 1 gets the scene opening instead). Replaces `### Player's Declared Action Towards You`.
- `### Your Relationship With <Other NPC>`: that NPC's own `npc_relationships` row only. NPC A never sees NPC B's context note, and the reverse.
- Memories: that NPC's `character_memories` with `target_character_id` = the other NPC.
- The existing `sceneContext` / `>>> YOUR TURN <<<` block, with the beat's intent.
- The NPCs are in a public place and may be watched. Private intent (e.g. Rolus's leverage over Hina) shows only through tone and body language. It is never said outright, unless the player already has a memory or quest that revealed it.
- The narrator describes only what the player can see and hear. No inner thoughts.

## 4. Server

- Separate endpoint `POST /api/characters/:id/observe` (the normal `/action` route is untouched), body:
  ```json
  { "observeNpcAId": 148, "observeNpcBId": 129, "repeatCount": 2, "direction": "" }
  ```
- Validation as in section 1, wrapped in `databaseError()`. No raw errors to the client.
- Messages: "Pick two different NPCs.", "Both NPCs must be here with you.", "Repeat count must be 1 to 3.", "Direction is too long."
- `actionText` for the existing empty-action check: `[Observe] <A> & <B>`.

## 5. Saving

- `stories` row: `action_from_player` = `[Observe ×<repeat>] <A> & <B>` plus ` — <direction>` when given. It shows in the feed and history like any turn.
- The player's affinity and `player_npc_relationships` do not change.
- A background memory call writes one NPC → NPC memory each way (`character_memories`, SHORT_TERM, owner = one NPC, target = the other), so the next Observe remembers this one. `add_from` stays `AI_SUMMARIZE`: a new enum value would need a DB migration.
- No `character_scenes` row and no dialogue session.

## 6. UI (`game.html`)

- New button **👁 Observe** in `.scene-support-actions`, directly to the right of `#scenesButton` (before **Context check**), same `scene-tool` class.
- It opens a modal in the same style as the Tools call modal (`checks-modal`):
  - **NPC A** dropdown: speakable NPCs here (same sublocation, or same location if not in a sublocation),
  - **NPC B** dropdown: the same list without NPC A,
  - **Repeat count**: number input 1–3, default 1, with a live preview of the order (`Rolus → Hina Zunko → Rolus → Hina Zunko`),
  - **Direction for the DM (optional)**: textarea, placeholder "Leave empty and the DM decides what happens.",
  - **Cancel** / **Watch**.
- The button is disabled with a tooltip when fewer than 2 speakable NPCs are here, in combat, in party turn mode, or for non-leaders.
- While running: the same loading state as a normal turn, with "Watching… (beat x of N)" if progress is available; otherwise "Watching…".

## Implemented

- Server: `src/api/characters/observe.js` (route), `src/containers/observeContainer.js` (validation, NPC loading, prompts state, saving, memories), `src/services/ai/agentHarness/observePipeline.js` (plan → frame → beats → merge).
- Prompts: `OBSERVE_MASTER_DIRECTIVE` / `OBSERVE_NARRATION_DIRECTIVE` in `prompts/rules.js`, `buildObserveStaticPrompt()` in `prompts/builder.js`, `npcObserveRoleplaySubagent()` in `subagents/npcRoleplay.js`.
- The narrator gets public data only: appearances and relationship type, never the context notes or beat intents.
- Constants: `OBSERVE_MODE` in `src/configs/constants.js` and `public/js/constants.js`. `performanceBlock()` in `splitPipeline.js` is now exported (no behaviour change).
- UI: `#observeButton` + `#observeModal` in `game.html`, `public/js/containers/observeContainer.js`, `sendObserveAction()` in `authApi.js`, wiring in `gameContainer.js`.
- Each run writes a harness log (`logs/harness`) with one step per beat; each roleplay prompt is in the response log under "Subagent: NPC Roleplay (Observe)".

## Out of scope

- More than 2 NPCs.
- The player stepping in mid-scene (they take a normal turn afterwards).
- Admin-only story generation.

## IMPORTANT

- Do not change unrelated files. Normal player turns must behave exactly as before.
- No code comments (see `AGENTS.md`).
- If tests insert records into the DB, remove them after testing.

## Done when

- The **Observe** button sits right of **Scenes**.
- At the Guild Office, Rolus (A) + Hina (B), repeat 1 → the story has Rolus then Hina; repeat 2 → Rolus, Hina, Rolus, Hina; each line answers the previous one.
- The trace log shows one roleplay call per beat, alternating Rolus / Hina, and Hina's prompts never contain Rolus's context note.
- With a direction given, the scene follows it. With it empty, the Master still produces a full scene.
- The story does not state Rolus's leverage outright.
- Rejected with a clear message when: the same NPC is picked twice; one NPC is in another sublocation or location; a monster is picked; repeat is 0, 4 or not a whole number; in combat; non-leader in party turn mode.
- A normal player turn with Hina still works unchanged.
- Syntax checks pass; the flow is smoke-tested in the browser.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.