# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
I have updated dabatase. 

npc_relationships.prisma
character_memories.prisma
items.prisma
quests.prisma

added is_nsfw column 

I want make a common function to check if Players's NSFW content is not accessible , will hide all NSFW relavent content. 
IF NSFW content is accessible, show NSFW content. 

Grilled me and ask for more clearly if you don't understand .

Adjust server, client game logics. 


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## ImplementedDecisions: access = `players.verified AND players.is_nsfw`. NSFW records are hidden everywhere when access is off (server-side; the client only renders what the server returns).

- Common function: `src/services/nsfwAccessService.js` provides `canAccessNsfw`, `getNsfwAccess`, `getNsfwAccessByUserId`, `nsfwWhere` (nullable columns), `nsfwItemWhere` (items), `filterNsfw`, `recipeHasNsfw`.
- Items:
  - The shop list (`sublocationContainer`, `api/inventory.js`) and buying (`buyShopItem`) exclude NSFW items.
  - Gathering and fishing loot (`gatheringContainer`), battle loot and battle consumables (`battleSystemCore`), and farming recipes and seeds (`farmingContainer`) exclude NSFW items.
  - Crafting recipes, inventory, vault and upgrade lists hide NSFW items, and crafting or upgrading them is rejected (`craftingContainer`).
  - The character sheet hides NSFW items in the backpack, vault, equipment and shop lists, but equipped NSFW items still count toward stats. The vault view and transfers do the same (`vaultContainer`).
- Quests: the quest board, accept and turn-in skip NSFW quests (`questContainer`).
- Memories: the character sheet and `retrieveNpcMemories` (AI DM / NPC roleplay) filter by the target player's access. Summarized long-term memories inherit `is_nsfw`.
- NPC relationships: the roleplay social context (`npcContext`, `roleplayTools`) filters by the player's access.
- MCP lookups: player-scoped lookups use that player's access. World-scoped NPC relationships and quests always hide NSFW records.
- AI DM prompt (`prompts/builder.js`): when access is off, the explicit / adult persona text is stripped from the prompt sections and a General content-rating rule is added. Sheet field `nsfw_allowed` drives this.
- Admin: NSFW checkboxes for items, quests, character memories and NPC-to-NPC relationships, saved by `adminContainer`.
- Not tested end-to-end (no runtime access from the agent). No test records were written to the DB.
# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.