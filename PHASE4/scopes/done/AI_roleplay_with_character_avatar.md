# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
I have udpated character's avatar image. Enhance the roleplay of AI DM : 
- Currently, I want AI DM response roleplay with character's avatar.



## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- **Server-side NPC Avatar Serialization & Directory:**
  - Added `image_data: true` to [`getNearbyNpcs`](file:///H:/Stervian%20AI%20Dungeon/src/containers/npcContainer.js#L8-L82) and implemented [`getAllKnownNpcs`](file:///H:/Stervian%20AI%20Dungeon/src/containers/npcContainer.js#L84-L125) in [npcContainer.js](file:///H:/Stervian%20AI%20Dungeon/src/containers/npcContainer.js) to convert BLOB data to base64 data URLs via [`imageDataToUrl`](file:///H:/Stervian%20AI%20Dungeon/src/components/helpers/imageData.js#L126-L131).
  - Exposed `GET /api/npcs` in [npcs.js](file:///H:/Stervian%20AI%20Dungeon/src/api/npcs.js#L7-L14) and exported [`getAllNpcs`](file:///H:/Stervian%20AI%20Dungeon/public/js/logics/authApi.js#L125) in [authApi.js](file:///H:/Stervian%20AI%20Dungeon/public/js/logics/authApi.js#L125).

- **AI DM Dialogue Prompt Directives:**
  - Added dialogue attribution rule in [sections.js](file:///H:/Stervian%20AI%20Dungeon/src/services/ai/prompts/sections.js#L149-L157) directing the model to prefix direct dialogue with canonical speaker tags (`[Speaker: <NPC Name>]: "..."`).

- **Story Feed NPC Avatar & Dialogue Rendering:**
  - Implemented `findNpcSpeaker` and updated [`renderNarration`](file:///H:/Stervian%20AI%20Dungeon/public/js/components/storyEntry.js#L271-L350) in [storyEntry.js](file:///H:/Stervian%20AI%20Dungeon/public/js/components/storyEntry.js) to parse dialogue lines and render them as `<div class="npc-line">` containing the NPC's portrait image, name, and role tag.
  - Adjusted `.npc-line .npc-avatar` portrait card dimensions to `128px × 256px` with `8px` rounded corners in [styles.css](file:///H:/Stervian%20AI%20Dungeon/public/style/styles.css#L671-L685) and [storyEntry.js](file:///H:/Stervian%20AI%20Dungeon/public/js/components/storyEntry.js#L290-L298).

- **Persistent Cross-Location NPC Directory Caching:**
  - Initialized and maintained global `allNpcs` cache in [gameContainer.js](file:///H:/Stervian%20AI%20Dungeon/public/js/containers/gameContainer.js#L680-L710) so historical dialogues retain their original speaker avatars (e.g. Zanla Lehey) when the player travels to other locations (e.g. Shiranui's Dojo).
  - Replaced fallback assumptions with candidate evidence scoring to prevent incorrect avatar overrides.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.