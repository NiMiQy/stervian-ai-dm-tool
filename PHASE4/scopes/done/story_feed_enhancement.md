# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, enhancement AI DM story feed, player story action:
  1. At .actionInput area, Add a options button for players to choice which type of action they want:
     - /story
     - /say
     - /combat

- If the player choice /story:
-> AI DM would use tools for checking if objects exists in Database, even not exists, it could still going narrative the story. BUT DO NOT NEVER GENERATE A COMBAT SESSION (never using triggerCombatEncounterTool), even Player want to combat with a NPC or Monster exists in DB. Only narrative like a story telling that player and NPC is combat in story.
DO NOT GENERATE MEMORY, RELATIONSHIP FOR objects not exists in DB.

- If the player choice /say:
-> AI DM would use tools for checking if objects exists in Database, even not exists, it could still going to ROLEPLAY ONLY. BUT DO NOT NEVER GENERATE A COMBAT SESSION (never using triggerCombatEncounterTool), even Player want to combat with a NPC or Monster exists in DB. Only narrative roleplay that NPC telling that player and NPC is combat in story.
DO NOT GENERATE MEMORY,  RELATIONSHIP FOR objects not exists in DB.

- If the player choice /combat:
-> AI DM would use tools for checking if objects exists in Database, ONLY DO GENERATE A COMBAT SESSION IF THE objects NPCs, Monsters existed in database. 



## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## TESTING CASES:

- DO NOT PROVIDE A RETURN MOCKUP DATA AND CLAIM THAT IS CORRECT TESTS. THE TEST MUST AND ONLY CORRECT WHEN PROVIDE TRUE INFOR FROM ENVIRONMENT  

- #### Correct testings case (MUST MAKE LIKE THIS):
  - Mockup data create base on Schema, could be records in db or mockup data in array of testing files BUT MUST BE FOLLOWING SCHEMA.
  - DO NOT FIND A SHORTCUT WAY TO WRITE TEST CASES.
  - DO NOT PROVIDE TEST CASES OUT OF SCOPE. 

## Implemented
- Added `/story`, `/say`, and `/combat` action modes to the game composer and request flow.
- Restricted combat to `/combat` and validated targets against canonical, present, attackable NPCs or monsters.
- Kept unknown entities narrative-only, without memory or relationship persistence.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.