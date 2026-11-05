# Combat Defeat Result

## Scope

When a monster or NPC defeats the player:

- Respawn with 1 HP, 1 energy, 20 food, and 20 water.
- Reload the page after the defeat result is dismissed.
- Tell the AI Dungeon Master who defeated the player and where they respawned, then continue the story.

Keep the existing battle UI and avoid unrelated changes.

## Implemented

- The server saves the respawn location and vitals in the defeat transaction and updates hunger and thirst effects.
- Closing the defeat result reloads the page. Once combat is over, the client sends the defeat notice through the existing story action flow. If narration fails, the notice stays queued for the next reload.

## Verification

JavaScript syntax, Prisma validation, and focused status-combat tests passed. The authenticated defeat flow was not manually exercised because the local browser required sign-in.
