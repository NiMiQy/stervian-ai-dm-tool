# Adjust / Enhance / Optimize Prompt — 24/10/2026

## System prompts per agent (current)

### Master agent
`buildStaticPromptSegments` (role MASTER) — `prompts/builder.js`
- `WORLD_CURRENCY`
- `SAFE_CONTENT_RULE` (only when NSFW is off)
- `ANTI_JAILBREAK_RULE_SECTION`
- `MASTER_DIRECTIVE`

Tools: `MASTER_TOOLS` (no roleplay tools)

### Narration agent
`buildStaticPromptSegments` (role NARRATION) — `prompts/builder.js`
- `WORLD_LORE_SECTION` (via `rated()`)
- `NARRATION_DIRECTIVE`

Per turn (`splitPipeline.js`): `formatNarrationSlot(npcName)` + `MASTER SCENE BRIEF`
Tools: none

### NPC Roleplay agent
`npcRoleplaySubagent` — `subagents/npcRoleplay.js`
- System: `"You are an authentic dark-fantasy roleplay subagent for an RPG NPC. Output only valid JSON."`
- User prompt: `buildNpcRoleplayPrompt` (persona, known NPCs, known places, memories, recent dialogue, checked facts, scene + beat, player action, JSON format)

Tools: none

### Observe Master agent
`buildObserveStaticPrompt` (role MASTER) — `prompts/builder.js`
- `WORLD_CURRENCY`
- `SAFE_CONTENT_RULE` (only when NSFW is off)
- `ANTI_JAILBREAK_RULE_SECTION`
- `OBSERVE_MASTER_DIRECTIVE`

### Observe Narration agent
`buildObserveStaticPrompt` (role NARRATION) — `prompts/builder.js`
- `WORLD_LORE_SECTION` (via `rated()`)
- `SAFE_CONTENT_RULE` (only when NSFW is off)
- `CROWD_EXTRAS_RULES_SECTION`
- `MEMORY_RULES_SECTION`
- `OBSERVE_NARRATION_DIRECTIVE`

### Observe NPC Roleplay agent
`npcObserveRoleplaySubagent` — `subagents/npcRoleplay.js`
- System: `"You are an authentic dark-fantasy roleplay subagent for an RPG NPC talking to another NPC. Output only valid JSON."`
- User prompt: `buildNpcObservePrompt`

### Shared per-turn messages (Master + Narration)
History → Current State (`buildTurnStateSegments`) → player action → anti-injection directive (only when `isMetaJailbreak`)

## Defined in `prompt_constant.js` but used by no agent
- `NSFW_NARRATION_SECTION`
- `NARRATION_SCOPE_SECTION`
- `NAME_KNOWLEDGE_RULES_SECTION`
- `SCENE_RULES_SECTION`
- `FATE_RULES_SECTION`
- `SKILL_CHECK_RULES_SECTION`

## Changes today
1. Merged `rules.js` + `sections.js` → `prompts/prompt_constant.js` (old files in `_to_delete/prompts_old/`).
2. Removed tool `record_npc_offense` + `NPC_OFFENSE_RULES` + `recordAffinityChange()`.
3. Removed `DM_CORE_PERSONA_SECTION`.
4. Removed `ACTION_MODE_RULES_SECTION`.
5. Removed `TARGET_RULES_SECTION`.
6. Removed `NPC_ROLEPLAY_SECTION` from every agent.
7. Master: `WORLD_LORE_SECTION` → `WORLD_CURRENCY` only; removed crowd/name/scene/fate/skill/memory rules.
8. Narration: removed `SAFE_CONTENT_RULE`, crowd/name/scene/fate/skill/memory rules, `NARRATION_SCOPE_SECTION`.
9. Observe Master: now only `WORLD_CURRENCY`, `SAFE_CONTENT_RULE`, `ANTI_JAILBREAK_RULE_SECTION`, `OBSERVE_MASTER_DIRECTIVE`.
10. Observe Narration: removed `NARRATION_SCOPE_SECTION`.
11. Master: added `ANTI_JAILBREAK_RULE_SECTION`.
12. Roleplay agents: unchanged.

## Open points
- Master has no fate/skill interpretation rules (result data still in Current State; headers still say "see Fate/Skill Check Rules").
- Master has no "target NONE → no NPC replies" rule.
- `partyTurnService.js` still tells Master to call `roleplay_npc_party` (Master has no roleplay tools).
- Avatar break (log 2026-10-24T02-32-25): roleplay agent puts speech in `bodyLanguage` (not tagged by `performanceBlock`); Narration writes NPC speech after the slot because Master `beats` script the NPC.
