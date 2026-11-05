# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- Currently, I want to enhance the location system:
1. Location now have their own weather. 
enum WeatherType { 
CLEAR
RAIN
HEAVYRAIN
STORM
FOG
}

1. Every location have it own weather.
2. The weather duration will be half of game day (30 minutes) then auto change to another weather.
3. The weather will have transition following:
   - CLEAR -> could have chance to transition to RAIN, HEAVYRAIN.
   - RAIN -> could have chance to transition to CLEAR or HEAVYRAIN or STORM.
   - HEAVYRAIN -> could have chance to transition to CLEAR or STORM or FOG
   - STORM -> could have chance to transition to CLEAR or RAIN or FOG.
   - FOG -> could have chance to CLEAR.


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

### Location weather (narration only)
- Agreed changes to the scope:
  - Each weather lasts a random 15–30 real minutes, so locations are naturally staggered.
  - Any weather can stay the same.
  - SUNNY was added.
  - STORM -> RAIN or FOG.
  - FOG -> CLEAR (100%).
  - Weather has no gameplay effect yet.
- Table `location_weathers` (`src/prisma/models/location_weathers.prisma`): one row per location, holding `weather WeatherType`, `started_at` and `expires_at`. `locations.weather` is the back-relation.
- Migration: `npm run migrate:location-weather` (`src/prisma/updates/addLocationWeather.js`). It creates the table and gives every location a random starting weather.
- Rules in `src/configs/constants.js` → `LOCATION_WEATHER`. Edit them freely:
  - durations
  - sweep interval
  - `TRANSITIONS` weights (the stay-the-same weight is the cell where a weather maps to itself)
  - labels
  - prompt text
  - at EVENING and NIGHT, SUNNY is shown as "Clear" and narrated as a clear night sky
- `src/services/locationWeatherService.js`:
  - A sweep runs every 60s from `server.js`. It advances expired weathers by one transition and pushes `world:weather_changed` to players currently in that location.
  - Reads also advance the weather lazily if it has expired.
  - After server downtime, the weather moves on one step; the missed history is not replayed.
- `GET /api/world/weather`: weather at the session character's location.
- AI DM: a `### Local Weather` section after World Time.
  - In a sublocation with `is_sheltered = true`, the player knows the weather outside but is not affected.
  - In unsheltered sublocations and outdoors, the player is exposed.
- Client: `#worldWeather` span in `.sidebar-bottom`, before the clock, with no new styles.
  - It refreshes on location change, on time-slot change and on the WebSocket push.
- Test: `node tests/locationWeatherTest.js`. It checks transitions and durations, writes no DB records, and needs `prisma generate` first.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.