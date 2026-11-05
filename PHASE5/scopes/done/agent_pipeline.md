# Agent Pipeline: Master → Narration → Roleplay

## Goal
Split the single DM agent into three agents with clear jobs:
- **Master** reasons, applies the rules and calls tools. It writes no prose.
- **Narration** writes the story the player reads.
- **Roleplay** voices the targeted NPC inside the narrator's scene.

## Decisions
- All three agents use the same DeepSeek model.
- Order: Master → Narration → Roleplay → the code merges → the player.
- No targeted NPC: Master → Narration only (2 AI calls).
- Combat triggered: Narration and Roleplay are skipped; the "Prepare yourself" message stays as today.
- Ending: the code merges. The final story is the Narration text with the Roleplay reply placed at the slot. No AI rewrites the final story.
- Roleplay follows the narration. It performs the beat the Narration agent planned, and decides only the exact words and gestures. A Mythic GME 2e guide will decide beats later.
- Every stage is written to the harness log.
- The old single-agent flow stays available: `AI_PIPELINE=classic`. The default is `split`.

## Flow (split)
1. **Master** (agent loop, existing tools minus `roleplay_npc` / `roleplay_npc_party`). Its final answer is a JSON scene brief:
   `{"scene","playerAction","outcome","npc":{"name","intent"}|null,"beats":[],"constraints":[]}`
2. **Narration** gets the full DM prompt plus a narration directive, the history, the player action and the brief.
   - When the brief has an NPC, it writes `{{NPC_SLOT}}` once, alone on its own line, where the NPC reacts.
   - It ends with `[[BEAT: ...]]`, describing what the NPC must do and convey.
   - It never writes that NPC's words, face or gestures.
3. **Roleplay** uses the existing roleplay tool: `roleplay_npc`, or `roleplay_npc_party` on party turns. It also receives the scene with its slot marked and the beat. It returns `dialogue`, `bodyLanguage` and `emotion`, the same as today.
4. **Merge** (code) replaces the slot with:
   ```
   <bodyLanguage>

   [Speaker: <NPC>]: "<dialogue>"
   ```
   - Roleplay fails: the beat is inserted as plain narration.
   - Slot missing: the reply is appended at the end.
   - Then the existing filters run (strip non-target speakers, target NONE rule).

## Unchanged
Party turns, name rules, the memory worker, combat, story persistence and the client.

## Logs
`logs/harness/*.log` and `*.json` gain these steps, each with its output:
- `masterBrief`: the parsed brief;
- `narrationAgent`: the draft, slot and beat;
- `roleplayAgent`: the NPC reply;
- `mergeStory`.

Every model call is also in `logs/response/`.

## Implemented
- `src/services/ai/agentHarness/splitPipeline.js`: directives, brief parsing, narration agent, roleplay stage, merge.
- `aiConfig.pipeline` (`AI_PIPELINE` env), `AI_PIPELINE` and `AGENT_PIPELINE` constants.
- `context.js`: the Master directive is added to the system prompt; a narration prompt is kept on the turn.
- `nodes.js`: the Master has no roleplay tools; `finalizeStoryNode` runs the split pipeline.
- `npcRoleplay.js`: optional `sceneContext` (scene with slot + beat).
- `harnessLogger.js`: prints each step's `output`.
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.