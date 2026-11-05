# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, enhancement AI DM , tools, more complex:
1. I have updated sublocations.prisma . owner_id -> character could own the sublocation
2. Implement affinity npc to player base on player_npc_relationship.prisma:
    Affinity point will automatically set to :
    - -200 is HOSTILE
    - -101 to -199 is DISGUSTED
    - -51 to -100 is HATEFUL
    - -21 to -50 is WARY
    - -1 to -20 is DISLIKE
    - 0 to 20 is STRANGER
    - 21 to 50 is NEUTRAL
    - 51 to 100 is FRIENDLY
    - 101 to 150 is CONFIDANT
    - 151 to 200 is DEVOTED
   System: 
    - When the NPC's affinity point :
      + In range -1 to -50 (DISLIKE or WARY stage), all the items or services price provided by this NPC (NPC own the shop) will increase 10% price.
      + In range -51 to -100 (HATEFUL stage), all the items or services price provided by this NPC will increase 25%. 
      + In range -101 to -199 (DISGUSTED stage) , all the items or services price provided by this NPC will increase 50%.   
      + In range -200 (HOSTILE stage) , all the items or services price provided by this NPC will no longer let player use or buy it anymore. And automatically call a combat whenever player enter a sublocation that NPC is in there.
    - When the NPC's affinity point :
      + In range 51 to 100 (FRIENDLY stage), all the items or services price (LONG REST, FULLFILL hunger + water) provided by this NPC will decrease 5%. 
      + In range 101 to 150 (CONFIDANT stage) , all the items or services price (LONG REST, FULLFILL hunger + water) provided by this NPC will decrease 15%.   
      + In range 200 (DEVOTED stage) , all the items or services price (LONG REST, FULLFILL hunger + water) provided by this NPC will decrease 30%.
2. When players insult NPCs , AI DM will run a tool that decrease affinity point:
    - Drop affinity point by -10. 
3. When players assault NPCs, AI DM will run a tool that evualate the how serious the assault then decrease affinity point: 
    - Sneaky assault (suddenly attack, ambush, sneaky attack) : -20 point
    - Directly assault : -40
4. When players flee in combat with NPCs type NPC, AI DM will tell the the story after players successfuly flee:
    Implement Anti-cheese NPCs combat:
    - Player's energy consume 40 energy.

- I have updated player_npc_relationships.prisma:
 1. If the players have not reveal their name yet. NPC will only response to players "stranger" , "adventurer", "wanderer" , "my guest" , etc.
 
- I have updated character_memories.prisma: 
 1. target_character_id -> The memory to the character
 2. long_term type -> this will save for 2hours, maximum 5 cap, summary by 10 short_term memory, after that update the newest to the oldest memory and still keep 5 cap.
 3. short_term type -> this will save for 1 hours, maximum 10 cap, after that update the newest to the oldest memory and still keep 10 cap.
 4. SEMANTIC type -> leave this, manually edit.
 5. EPISODIC type -> This will be change only some big event start . (for example: someone try to kidnap or assault, being sell on market, used to be hero, used to be a legendary trader,...)
 6. is_secret -> NPC do not tell their memory to player if the player has not met the requirement. 

- Check and implement the scope for both client and server side. Game.html and admin.html. 

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

- Added affinity-based relationship status transitions and NPC-owned shop pricing. Insults reduce affinity by 10; sneaky and direct assaults reduce it by 20 and 40.
- Added hostile-NPC combat on entry and affinity-adjusted shop and inn services. Inn long-rest and food/water refill base prices default to 350g and are admin-editable.
- Successful combat escapes consume 40 energy and trigger follow-up DM narration.
- NPCs use generic forms of address until the player explicitly reveals their name to them.
- Added targeted NPC memories with short- and long-term expiry and caps, short-term summarization, episodic and semantic types, and admin editing. Secret memories stay hidden until a separate reveal requirement is defined.
- Updated game/admin interfaces and Prisma schema; added idempotent migrations for legacy memories, NPC location knowledge, name-reveal state, and 350g inn services.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
