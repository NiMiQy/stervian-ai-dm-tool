# Improve AI Roleplay

## Goal

The NPC Roleplay Subagent plays NPCs as generic archetypes and forgets the thread of a conversation.
- It never receives the NPC's `characters.description`, where the real personality lives (e.g. Rolus: HANDS OF WAR, Prince Ronald's circle, a schemer who uses leverage).
- It only sees the current turn's narrator draft (`turnContext.roleplayScene`) and memories, never the earlier lines of the conversation.

## Scope

### 1. Pass `description` to the roleplay prompt

- `roleplayTools.js` → `roleplayNpcCore`: pass `description: resolvedNpc?.description || ''` to `npcRoleplaySubagent`.
- `npcRoleplay.js`:
  - Add a `description` param to `npcRoleplaySubagent` and `buildNpcRoleplayPrompt`.
  - Render it under the persona block as `- Personality & Background: ...`, only when it isn't empty.
  - Party companions resolved from `party.members` may lack `description`. Fall back to `''`.

### 2. Feed the last 10 dialogue messages to the subagent

- Source: `dialogue_messages` of the active DIRECT session (`context.dialogueSession`, built in `lifecycle/context.js`).
- Pass `dialogueSessionId` through `config.configurable` so `roleplayNpcCore` can read it.
- New constant in `constants.js`: `ROLEPLAY_HISTORY_MESSAGES = 10` (the 10 newest `dialogue_messages`).
- Load the **latest** messages: `orderBy: { created_at: 'desc' }, take: N`, then reverse to chronological order.
- Remove the unused `getActiveDialogueHistory` (it returned the **oldest** messages).
- Trim NARRATION to keep the prompt small:
  - Keep this NPC's `[Speaker: <npc>]` lines plus a short narration excerpt.
  - Cap each message at a fixed number of characters (add a constant).
- Apply the same name redaction as memories: if `nameRevealed` is false, replace the player's real name with the label the NPC knows them by.
- Respect NSFW gating for the history, the same way it is applied to memories.
- Render a new prompt section after the memories, before `The Scene So Far`:
  - Heading: `### Recent Conversation (oldest → newest)`
  - One line per message: `Player: "..."` / `<npc>: "..."`
  - Rule: stay consistent with what you already said and promised. Do not repeat earlier lines.
- Party turns (`roleplay_npc_party`): use the same history from the party leader's session.
- If there is no session or no messages, leave the section out.

## Out of scope

- NPC↔NPC conversations: a new tool and a director loop.
- A private scene-facts slot (secrets such as letters). For now, store these as NPC memories.
- Off-screen NPC actions after the player leaves.

## Done when

- The `Subagent: NPC Roleplay` prompt in the response log shows the NPC's description and the last ≤10 messages, in chronological order.
- Talking to Rolus over several turns: he references his earlier offer or deal without being reminded, and stays in his scheming persona.
- No name leak: an unrevealed player name never appears in the history section.
- Syntax checks pass for the changed files, and the dialogue flow is smoke-tested in the browser.
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.