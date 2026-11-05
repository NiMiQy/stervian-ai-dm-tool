# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Scope

Currently admin.html, some functional have already developed and work very well.
Following - ```Max HP =
floor(
  10
  + Proficiency
  + (2 × Constitution)
  + Strength
  + (0.5 × Dexterity)
  + Equipment Max HP Bonuses
)``` fomulas. 
- But when I upgrade my stats STR, CON, DEX . My MAX HP is not update. 
=> Check and fix the issue . 


## IMPORTANT:
- Do not change inrelavent files.
- The currently UX/UI layout for admin.html is working fine and correct, do not current delete layout, just add or adjust. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- Corrected calculation HP after upgraded stats.

## Implemented
- MAX HP now recalculates and persists after stat upgrades, including equipment bonuses.
- Stat upgrade boxes disable when no spend points remain.
- “Click to upgrade” hides when spend points reach zero.
- Insufficient-point errors display in the visible toast popup.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
