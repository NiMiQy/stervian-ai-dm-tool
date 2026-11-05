# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, I want to move the /combat detect by AI to system handle:

- Create a button "Combat" next to the left of "Move" Button :
  -> Clicked, open modal : 
   . Can choice monster appear in area to combat, max cap 5. 
   . If it's NPC, NPC must be attackable, only 1.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented:

Decisions: the AI /combat path is removed fully; monsters can be mixed (total max 5); targets come from the player's current spot (sublocation if inside, else location-level spawns), the same rule as the NPC chips; no story turn, the client goes straight to the combat page.

- **Combat button** (`⚔ Combat`) left of **Move**. It opens `#combatSelectModal` (reuses the checks-modal styles):
  - one card per monster with a count (0–5), total capped at 5;
  - one checkbox per attackable NPC. An NPC is fought alone: picking one locks the monsters, and picking monsters locks the NPCs.
  - Same rule as Checks: blocked in party turn mode and for non-leaders.
- **Server** (`src/containers/areaCombatContainer.js`):
  - `GET /api/battles/area-targets` → `{ monsters, npcs }` at the current spot, `is_attackable = true` only.
  - `POST /api/battles/area-encounter` `{ targets: [{ id, count }] }` checks ids, counts, no duplicates, total ≤ 5, presence at the spot, one NPC alone, and leader only, then calls `createEncounter`.
- **Removed the AI combat detection:**
  - `/story|/combat` select;
  - `trigger_combat_encounter` (moved to `_to_delete/combatTools.js`) and its registry exports;
  - the nodes.js combat fallback, permission check and encounter capture;
  - the toolHooks combat check;
  - the `/combat` prompt rules and the Selected Action Mode line.
  - `ACTION_MODES` is now `{ STORY }`.
  - The prompt now says the DM never starts combat and only narrates the build-up.
- Kept: `GET /api/battles/encounter` + `enterCombatRoute` (still used by the sublocation hostile ambush), the MCP `publish_encounter` dev tool, and the passive `encounter` fields in harness state/workflow/lifecycle (nothing sets them now).
- Test: `tests/combatEncounter.test.js` rewritten (selection rules + real-DB area check, read-only, no test records).

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.