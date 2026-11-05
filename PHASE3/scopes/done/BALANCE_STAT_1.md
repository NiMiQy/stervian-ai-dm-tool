# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
Base on my currently, stats system:
1. I've found that DEX is a strongest stats within bonus MAX_HP, Armor, Initiatives, Atk Dmg. 
    - Remove MAX_HP bonus for DEX in formulas.
2. I've found that MAGICAL_ARMOR is not gain by any stat.
    - Make gain MAGICAL_ARMOR by WIS(x1) , 1 WIS = 1 MAGICAL_ARMOR.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Removed DEX contribution from the maximum HP formula.
- Added magical armor from WIS at 1:1 above the base value.
- Updated stat tooltips and added regression coverage.


# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.