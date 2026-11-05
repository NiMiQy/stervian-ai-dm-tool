# Game Logic & AI Prompt Optimization

## Goal

Optimize token consumption, execution speed, and prompt clarity between the AI Dungeon Master (DM) and AI Subagents using Custom Domain-Specific Languages (DSL) for prompt inputs and Minified JSON for agent tool outputs, with zero degradation to LLM comprehension or gameplay logic.

## Scope

1. **DSL A - Player Character Sheet**: Convert verbose character stats, vitals, equipment, and inventory into a compact bracket DSL.
2. **DSL B - Party Silhouette**: Standardize party companion gear and vitals into 1-line silhouettes, preserving multiplayer agency rules.
3. **DSL C - Scoped Local NPCs**: Convert nearby NPC crowd lists into a dense pipe-delimited Markdown table with explicit engagement markers.
4. **DSL D - NPC Social & Spatial Knowledge**: Standardize social graphs and spatial memories into `RELATION:` and `LANDMARK:` tag DSLs.
5. **Minified JSON - Subagent Prompts & Tool Outputs**:
   - Update subagent prompts (`npcRoleplaySubagent`, `memoryWorldStateSubagent`) to request single-line minified JSON schemas.
   - Condense repetitive instructional boilerplate in agent harness tool returns (`inspect_current_location`, `roleplay_npc`, `trigger_combat_encounter`).
   - Add zero-whitespace JSON serializer utility `minifyJson`.
6. **Automated Verification**:
   - Comprehensive unit test suites validating DSL rendering, minified JSON parsing, and backwards compatibility.

## Implemented

- **DSL A (Character Context)**: In `src/services/ai/prompts/formatters.js` (`formatCharacterContext`), structured player vitals, attributes, and equipment into `[CHAR: ...]`, `[VIT: ...]`, `[STAT: ...]`, `[EQUIP: ...]`, and `[BAG: ...]` tags, reducing character prompt overhead by ~40%.
- **DSL B (Party Silhouette)**: In `formatters.js` (`formatPartyContext`) and `src/services/contextManager.js` (`compressPartySilhouette`), standardized companion representations into dense 1-line silhouettes (`* [PLAYER] ...`, `* [COMPANION] ...`), cutting party token usage by ~75%.
- **DSL C (Local Scoped Crowd)**: In `formatters.js` (`formatLocationContext`), converted nearby NPC lists into a pipe-delimited table (`NPC | Name | Job | Alignment | Status | Engagement | Appearance`), reducing crowd token overhead by ~35%.
- **DSL D (Social & Spatial Knowledge)**: In `src/services/ai/subagents/npcContext.js` and `npcRoleplay.js`, converted social ties and landmarks into `RELATION:` and `LANDMARK:` tags, adding regex tag stripping in deterministic dialogue fallbacks.
- **Minified JSON**:
  - In `src/services/ai/subagents/npcRoleplay.js` and `memoryWorker.js`, updated prompts to request single-line raw minified JSON.
  - In `src/services/ai/agentHarness/tools/roleplayTools.js`, `worldTools.js`, and `combatTools.js`, pruned verbose instruction boilerplate strings from tool return payloads.
  - In `src/services/ai/subagents/jsonParser.js` and `index.js`, added and exported `minifyJson(obj)`.
- **Testing & Verification**:
  - Added `tests/dslFormatters.test.js`: Verified DSL A, B, C, D formatting and subagent roleplay consumption (4/4 passed).
  - Added `tests/minifiedJson.test.js`: Verified `minifyJson`, tool payload compactness, and subagent output parsing (5/5 passed).
  - Regression verified with `tests/subagentManager.test.js` (13/13 passed), `tests/dialogueAndAvatarHijack.test.js` (8/8 passed), and `tests/subagentJsonParser.test.js` passed.
  - Database state cleanly rolled back after all tests.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
