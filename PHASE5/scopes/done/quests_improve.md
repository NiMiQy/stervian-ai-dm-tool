# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to enhance the Quest modal UX/UI , and Quest server Logics
1. Add margin-bottom: 10px for .nearby-npc-card
2. Actived Quest could be abadoned.
3. Seperate the group quest:
  - Group Quests.
  - Group Repeated Quest.
4. Limit the player can only active 5 quests as same time. 
5. "Hina Zunko · One time · Reward: 400 gold · 150 EXP · 5 affinity" enhance the text for more readable in .nearby-npc-card


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

1. `public/style/npcs.css`: `.nearby-npc-card` now has `margin-bottom: 10px`.
2. Abandon quest: new `abandonQuest()` in `src/containers/questContainer.js` (locks the character, sets the ACTIVE run to `FAILED`, resets progress, so no schema change) and `POST /api/quests/:runId/abandon` in `src/api/quests.js`. The client `abandonQuest()` lives in `authApi.js`, and active quest cards get an "Abandon" button that asks for confirmation. Abandoned one-time quests can be accepted again.
3. Available quests are split into "GROUP QUESTS" (one-time, `#questOffersList`) and "GROUP REPEATED QUESTS" (repeatable, `#repeatQuestOffersList`) in `public/game.html` and `gameContainer.js`.
4. The 5-active-quest limit was already enforced on the server (`MAX_ACTIVE_QUESTS = 5` in `acceptQuest`). The UI now also disables Accept and shows "Quest Log Full" when all slots are used.
5. The card meta is split into two lines: `Quest giver: Hina Zunko (One-time quest)` and `Rewards: 400 Gold, 150 EXP, +5 Affinity`.
- The Quests modal now also opens when you have active quests but no local offers, so you can abandon them anywhere.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
