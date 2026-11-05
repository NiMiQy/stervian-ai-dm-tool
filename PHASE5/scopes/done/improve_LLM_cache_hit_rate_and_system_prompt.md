# Improve LLM Cache Hit Rate and System Prompt

## Problem
- The first Master call of each turn cached only the static head (~4.6k tokens). Measured hit rate fell as history grew: 60% → 53% → 51% → 46%. Narration fell from 76% to 58%.
- Cause: per-turn data (HP, time, ambience, target, scenes, memories) sat in the system prompt **before** the history, so the history was never cached across turns.
- Extra cache breakers: rules mixed with names and lists; the role directive placed after the dynamic data; a tool list that changed by mode and target; the `[SCENE CHANGE]` marker inserted into the middle of the history; and a 15-entry sliding window that dropped the oldest entry every turn.

## New message order (Master and Narration)
```
[tools]          MASTER_TOOLS, same list and order every turn
[system]         static prompt: lore, DM core, roleplay, (safe rule), rule sections, role directive
[history]        append-only, pruned in steps
[system]         Current State: everything that changes per turn
[human]          player action (+ anti-injection system message if flagged)
Narration only:  [system] NPC Slot This Turn  →  [human] MASTER SCENE BRIEF
```

## Changes
| File | Change |
|---|---|
| `prompts/rules.js` (new) | Static rule sections with no per-turn data: action modes, conversational target, crowd extras, name knowledge, scenes, fate check, memories. Also `MASTER_DIRECTIVE`, `NARRATION_DIRECTIVE` and `formatNarrationSlot(npcName)`. |
| `prompts/builder.js` | `buildStaticPrompt({ role, nsfwAllowed })` and `buildTurnState({...})`. `buildDungeonMasterPromptSegments` is kept (static + state) for the context check and legacy callers. |
| `lifecycle/context.js` | `prepareHarnessMessages(..., turnState)` builds the order above. `markSceneChanges` is replaced by `buildSceneChangeNote`, whose note goes into the Current State. Sets `systemPrompt`, `narrationSystemPrompt`, `turnState` and `promptSegments`. |
| `agentHarness/splitPipeline.js` | Narration reuses the same history and Current State, plus a slot line and the brief at the end. Directives are imported from `rules.js`. |
| `agentHarness/tools/index.js`, `nodes.js` | `MASTER_TOOLS` is always bound. Roleplay calls are blocked in `toolsNode`; combat outside `/combat` was already blocked. |
| `lifecycle/toolHooks.js` | Bug fix: `validateToolPermissions` no longer re-allows a call that `toolsNode` had blocked. |
| `contextManager.js` | `applySlidingWindow(history, 15, 10)`: the window grows from 15 to 24 entries, then drops 10 at once. The window start stays fixed between prunes. |
| `core/fateRules.js` | `formatFateCheckForPrompt` now outputs data only; its rules moved to `FATE_RULES_SECTION`. |
| `configs/constants.js` | `PROMPT_ROLE`, `HISTORY_PRUNE_STEP = 10`. |

## Result (sandbox simulation, 30 turns, real builder + message assembly)
- New layout: about 92% of each request matches the previous turn's request from the start, and this stays flat as history grows. It drops to about 74% only on a prune turn (1 in 5).
- Old layout emulated with the same data: 95% falling to 78%. Real old numbers were lower (46–60%) because real turn state is larger.
- Static prompt: 23.1k chars, deterministic. Master and Narration share their first 21.5k chars.
- Fate rules tests pass (9/9). All edited files pass `node --check`.

## Trade-offs
- The tool list now always includes `trigger_combat_encounter`. A call in `/story` is blocked and costs one extra loop iteration.
- Per-turn state is a system message after the history. The `Current State (authoritative…)` header tells the model it overrides older turns.
- Deleting a story entry in the UI changes the history prefix and causes one full miss.

## Verify in production
Compare `Cached input tokens` / `Input tokens` in `logs/response/<character>.md` for the first `AI DM (agentNode)` call of each turn and for `Narration Agent`. Expect a flat rate instead of a falling one.
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.