# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server owns stat calculations and battle-card seed data. The browser requests the server result and renders it without submitting derived values.

## Scope
Fix issues I've found:
Currently, in game.html, .battle-card modal: 

- There is still mock up Spells, Attack, Defend, etc... . (I don't know if that in server side or client side, please remove it, there have already dynamic data on local database with character schema). 

- Critical: MCP Client could create an encounter for a random player. MCP Client must ask for User_ID to proceed the encounter generation.

For a AI Decision Making for NPC and Monster (logic should stay in src/containers/aiDecisionContainer.js):
- Basically right now these aren't much monster right now and lack of skill for monster. Just use the Bite skill for them. (This will enhance later)

## IMPORTANT:
- Do not change inrelavent files. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- AI Decision logic.
- Mock up remove. If there is anything missing (data, component, etc...), show the needed
- MCP CLient - MCP Server need authentication for calling tools because of many characters, players will play as same time.

## Implemented

- Battle skills now render dynamically from each character's database records.
- Battle inventory displays owned consumable items only.
- Removed the mock Kaelen companion and other hardcoded battle actions.
- Enemy HP uses the database `current_hp` and `max_hp` values.
- Monster AI is isolated in `src/containers/aiDecisionContainer.js` and selects Bite.
- MCP encounter generation requires a valid User_ID with an existing character.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.

