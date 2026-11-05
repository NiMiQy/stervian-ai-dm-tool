# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
I have found issue:
- When I'm not in a location and sublocation with NPC, I could still talk to them . 
For example: 
- When I exit Mai Shiranui dojo, and on the Inn honeywood , when I perform "I speak to Mai Shiranui" , the roleplay AI will trigger . (YOu could check the last harness logs)

-> I want only the player could speak to NPC when they are in the same sublocation only. It's mean same sublocation (Player are in same house with NPC could speak, if not, it cannot) .

Fix it by code. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

1. **Sublocation Proximity Check in `roleplayNpcTool` (`src/services/ai/agentHarness/tools/roleplayTools.js`)**:
   - Implemented authoritative `isNpcInPlayerSublocation(npc, playerLocId, playerSublocId)` checking both direct position fields (`sublocation_id`, `location_id`) on the character and appearance records in `npcs_in_locations_or_sublocations`.
   - Filtered `matchNearby` (from `scopedNpcs`) so that only NPCs matching the player's current sublocation are resolved.
   - Enforced database candidate fallback checks (`Check C`): if a candidate NPC is found in the database but is in another sublocation (or another location), the tool rejects execution with a structured error response:
     ```json
     {
       "error": "NPC_NOT_IN_SUBLOCATION",
       "npc_name": "<NPC_Name>",
       "message": "<NPC_Name> is not present in your current sublocation...",
       "instruction": "The character \"<NPC_Name>\" is NOT in the player's current sublocation... STRICT PROHIBITION: Do NOT generate spoken dialogue or avatar tags ([Speaker: <NPC_Name>]) for \"<NPC_Name>\"."
     }
     ```
   - Permitted active companions in `party.members` to speak regardless of sublocation, as companions travel with the player.
   - Updated `roleplay_npc` schema description to specify that NPCs must be physically present in the player's current sublocation or party.

2. **Presence Verification in Relationship Mutation Tools (`src/services/ai/agentHarness/tools/relationshipTools.js`)**:
   - Enforced `isNpcInPlayerSublocation` in both `recordNpcOffenseTool` and `revealPlayerNameToNpcTool`.
   - Prevented players from insulting, assaulting, or revealing names to NPCs who are not physically present in the same sublocation or party (`recorded: false, reason: 'NPC_NOT_IN_SUBLOCATION'`).

3. **Outdoor Appearance Scoping Updates (`src/services/ai/lifecycle/context.js`, `src/containers/npcContainer.js`, `src/services/openaiDeepseekService.js`)**:
   - Updated outdoor appearance query scopes when `sublocation_id` is null to `{ location_id: locId, sublocation_id: null }`, preventing NPCs inside sublocations (inns, dojos, shops) from being included in outdoor appearance scopes.

4. **AI DM Sublocation Proximity Prompt Rule (`src/services/ai/prompts/sections.js`)**:
   - Added Rule 6 (`Sublocation Proximity & Co-Presence Rule`) under `Companion & NPC Guidelines` in `NPC_ROLEPLAY_SECTION`.
   - Explicitly instructed the DM that speaking to NPCs is strictly prohibited if they are not in the exact same sublocation (or party companion), prohibiting tool calls to `roleplay_npc` and direct dialogue/avatar tags for absent characters.

5. **Test Suite Verification (`tests/npcSublocationSpeak.test.js`)**:
   - Added 9 automated verification tests in `tests/npcSublocationSpeak.test.js` covering:
     - Player inside Inn blocked from speaking to Mai Shiranui (in Dojo) (`NPC_NOT_IN_SUBLOCATION`).
     - Player inside Inn blocked from speaking to Guaz (outdoors) (`NPC_NOT_IN_SUBLOCATION`).
     - Player inside Inn speaking to Zanla Lehey (same sublocation) (Success).
     - Player outdoors blocked from speaking to Zanla Lehey (inside Inn) (`NPC_NOT_IN_SUBLOCATION`).
     - Player outdoors speaking to Guaz (outdoors in same location) (Success).
     - Player speaking to active party companion (Success across sublocations).
     - Relationship tools blocked for distant NPCs (`NPC_NOT_IN_SUBLOCATION`).
     - Relationship tools allowed for NPCs in the same sublocation.
     - Non-existent NPC lookup returns `NPC_NOT_FOUND`.
   - Verified clean database state and full rollback after test execution.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.