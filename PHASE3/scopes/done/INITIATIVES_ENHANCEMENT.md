# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Currently, my system has initiatives first turn system.

- Implement: Make Initiative Dynamic (~X around DEX):
 Flat Variance Window Around DEX
 Generate a roll within a fixed range (e.g., 
±
3
±3 or 
±
5
±5) centered around their DEX.

Formula: 
Initiative
=
DEX
+
random
(
−
V
,
+
V
)
+
⌊
Level
/
5
⌋
Initiative=DEX+random(−V,+V)+⌊Level/5⌋

=>  If Player DEX is 12 and Monster DEX is 11, either one has a chance to take the first turn, but a high-DEX rogue (DEX 20) will consistently outspeed a lumbering golem (DEX 6).


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Implemented dynamic initiative calculation using a flat variance window centered around DEX: `Math.max(1, Math.floor(DEX) + random(-V, +V) + Math.floor(Level / 5))` with default variance `V = 3`.
- Updated turn queue tie-breaking in `makeBattle()` and `nextTurn()` to prioritize higher innate DEX when initiative rolls tie (`b.dex - a.dex`), preserving fair speed advantages.
- Preserved existing UI contracts and styling, automatically reflecting dynamic initiative ratings in combat pills without client-side regressions.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
