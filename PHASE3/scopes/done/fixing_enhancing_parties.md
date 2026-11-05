# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Fixing and enhancing the parties system.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Fixed Party tab layout and join/leave notifications.
- Added visible party-member appearance and equipment to the DM context.
- Removed private member data: level, job, vitals, spell points, derived stats, skills, slot order, username, and avatar.
- Restricted player invites and acceptance to the same location and sublocation.
- Added a nearby NPC tab/modal for non-monster NPCs with exact location scoping.
- Added a placeholder NPC party-invite button; party logic is not connected yet.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.