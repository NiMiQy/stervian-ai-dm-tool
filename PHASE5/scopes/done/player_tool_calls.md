# Player Tool Calls

## Goal

- The AI DM no longer moves the player or the party. Only the Move button moves anyone.
- The player can force lookups for the AI DM on a turn with a **Tools call** button, so the Master and the roleplay NPC work from real records instead of guessing.

## 1. Remove AI movement (solo and party)

- Remove `enter_sublocation` and `exit_sublocation` (`worldTools.js`) from `HARNESS_TOOLS`, `MASTER_TOOLS` and the harness exports.
- Remove `EXIT_SUBLOCATION_PATTERN` and its auto-exit block in `lifecycle/context.js`.
- Prompt (`sections.js`): the DM never moves the player and never narrates them entering or leaving a place. If the player says they walk in or out, the DM narrates them at the threshold and the move waits for the Move button.
- Remove the tests that call the removed tools from `tests/sublocationLocationSeparation.test.js`.

## 2. NPCs know only their recorded places

- `getNpcSocialAndSpatialContext` stops adding every sublocation of the location as `LOCAL_LANDMARK`.
- An NPC knows a place only if it has an `npc_known_locations` row. The admin adds rows for common places, such as the inn.

## 3. Tools call button and modal

- Button **Tools call** to the right of **Move**. It opens a modal with:
  - an action text box (required; a tool cannot be sent alone),
  - one checkbox per tool, with its description,
  - an NPC B dropdown for the relationship check.
- The two NPC tools are disabled when no target NPC is selected.
- Same rule as Checks: blocked in party turn mode and for non-leaders.
- **NPC B dropdown:** NPCs the player has met (`player_npc_relationships`), plus free text for names heard only in the story. New endpoint `GET /api/npcs/met`.

| Tool | Reads | Answers |
|---|---|---|
| `inspect_current_location` | location + all sublocations + ground items | Every place in the current location, also when the player is inside a sublocation |
| `npc_known_places` | target NPC's `npc_known_locations` | Places this NPC actually knows, in any location |
| `search_npc_in_relationship_with_npc` | target NPC's `npc_relationships` | Does this NPC know NPC B, and how |

- `search_world_npc` is unchanged (the Master's canonical NPC check).

## 4. Server flow

- `POST /api/characters/:id/action` accepts `playerTools: [{ tool, npcName? }]`. The server validates it (known tools, no duplicates, target required for the NPC tools, `npcName` required for the relationship check).
- The server runs the tools before the Master. Results are canonical for this turn only.
- Results go to:
  - the Master's Current State: `### Player-Requested Lookups`,
  - the roleplay NPC's prompt: `### Facts Checked This Turn` (only the two NPC tools).
- The Master may still call `inspect_current_location` itself. A second call in the same turn is harmless (read-only).

## Done when

- Master tool list has no movement tools; typing "I leave the inn" does not move the player or the party.
- An NPC with no `npc_known_locations` row for a place does not get it in its prompt.
- With **Tools call** → `npc_known_places` on Zanla, the Master brief and her reply use her recorded places.
- With `search_npc_in_relationship_with_npc` for a name the target has no relationship with, both the brief and the reply treat that person as unknown.
- Syntax checks pass; the flow is smoke-tested in the browser.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.