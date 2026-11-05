# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to enhance the location system:
1. Location, sublocation now have their own ambiences:

enum CrowdLevel { 
    EMPTY
    FEW
    SOME
    BUSY
    PACKED
}

2. Depend on the weather and the time in day (
  MORNING
  AFTERNOON
  EVENING
  NIGHT
  ANY):
  -> The location , sublocation will have a difference (random) ambiences
For example: Morning -> many non-canonical NPC with only for story narrative could stay in Honeywood(Location), GUILD OFFICE (sublocation)
with PACKED, or BUSY, or just SOME at evening or night ... 

Random figures with : " a cleric" , "Group of mercenaries" , "group of elves" , "a high priest" , "a noble of next village" , "some merchant", ...

### Agreed design (decisions)
- Templates are per place. The admin creates them manually for each location (outdoors / main area) and each sublocation.
- A sublocation follows the outdoor weather of its location, but has its own ambiences.
- Rolling happens only when the time of day changes (MORNING -> AFTERNOON -> EVENING -> NIGHT). A weather change mid-slot does not reroll.
- Template matching:
  - The time slot must equal the current slot, or be ANY.
  - The weather must equal the location's current weather, or be empty (any weather).
  - The pick is weighted by template weight.
- Figures:
  - A random number between min and max figures is drawn from the template's figure list.
  - Figures are weighted, picked without repeats; a low weight means rare.
  - The picked ambience and figures are frozen until the next time slot.
- Shared world state: every player (single or multiplayer) in the same place sees the same ambience and figures.
- On each time-slot change, every online player inside that place receives a story narration notice, for example: "*Morning gives way to afternoon in Guild Office.* {scene}. The place is quiet, with only a few people; among those here: a cleric and a group of mercenaries."
- No UI widget. Players discover the ambience only through narration.
- The AI DM is told plainly that background figures are non-canonical and narration-only:
  - They cannot be targeted, cannot give or sell quests, items, gold, keys, maps, rewards or quest information, and cannot join a party.
  - This prevents fake-item and fake-quest exploits.
- Talking to figures (UNE + Mythic GME 2e) will be handled in a future scope.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

### Ambience system
- Uses the existing enums `CrowdLevel`, `TimeSlot` and `WeatherType` (the scope's `CrowdType` is the existing `CrowdLevel`).
- Tables (migration: `npm run migrate:ambiences`, script `src/prisma/updates/addAmbienceSystem.js`):
  - `ambiences`: a template.
    - Fields: `location_id`, optional `sublocation_id`, `title`, `time_slot`, optional `weather`, `crowd_level`, `description`, `weight`, `min_figures`, `max_figures`, `is_active`, soft `deleted`.
  - `ambience_figures`: `ambience_id`, `label`, `weight`.
  - `location_ambience_states`: the frozen roll per place.
    - Keyed by `scope_key` = `"<location_id>:<sublocation_id|0>"`, which avoids the MySQL NULL-unique issue.
    - Holds a snapshot of crowd, description and picked figures (JSON) and `slot_started_at`, so editing a template does not change an active scene.
  - Back-relations: `locations.ambiences` / `ambience_states`, `sublocations.ambiences` / `ambience_states`.
- `src/services/gameClockService.js`: new `onGameTimeSlotChange(listener)`, fired after the `world:time_changed` broadcast.
- `src/services/locationAmbienceService.js`:
  - `rollAllAmbiences` runs on every slot change for each place that has active templates.
    - Rolls once per slot, guarded against concurrent rolls.
    - Saves a story turn (with location/sublocation) for every **online** player in that place.
    - Pushes `world:ambience_notice` to that player.
    - Offline players get nothing, so their history is not spammed.
  - `getCurrentAmbience` rolls lazily if the stored roll is from an older slot (server restart / first visit).
  - On server start, all places are rolled silently.
  - If no template matches the slot and weather, no ambience is shown and the AI DM narrates freely.
- AI DM: an `### Ambience` section (crowd, scene, background figures and strict non-canonical rules), after Local Weather.
- Admin: new **Ambiences** tab in `admin.html`.
  - Search, location, time and crowd filters.
  - Editor: place (sublocation list follows the chosen location), time, weather, crowd, weight, active, title, scene description, min/max figures, and figure rows with weights.
  - Server validation: the location must exist, and the sublocation must belong to it.
- Game client: `world:ambience_notice` is appended to the story feed and history (no style changes).
- Rules in `src/configs/constants.js`: `AMBIENCE` (crowd wording, limits) and `CROWD_LEVEL`.

### Admin: World State (live view)
- New **World State** tab in `admin.html`: `public/js/admin.js` -> `renderWorldState`.
  - Server: `src/containers/worldStateContainer.js` and `GET /api/admin/world-state`.
- It shows:
  - The current time slot, with a live countdown to the next one.
  - For every location and its sublocations:
    - weather and when it ends (sublocations show sheltered / exposed and follow the location's weather)
    - the active ambience (title, crowd, scene, picked figures), plus a "Stale" badge if rolled for an earlier slot
    - the number of active templates
    - the players present, with online status
- Refreshes automatically every 15s; the countdowns tick every second.
- Testing buttons (`POST /api/admin/world-state/reroll`):
  - **Re-roll ambience** clears that place's roll and rolls it again immediately. It also fixes an empty roll cached before templates existed.
  - **Re-roll weather** expires the location's weather and rolls the next transition.
  - Neither sends a story notice; players see the change on their next turn.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.