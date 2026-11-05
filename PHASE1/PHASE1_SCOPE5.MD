# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server owns stat calculations and battle-card seed data. The browser requests the server result and renders it without submitting derived values.

## Scope
Currently, in game.html, on the .battle-card. I want to enhance some components :
- Move the .battle-combat-log to above .battle-stage
- Increase 2px text in .battle-combat-log
- At .battle-command-dock section, add a button menu M.Attack:
  1. Display skills with type=MAGIC_ATTACK in M.Attack menu
- There is a text "Attack · 2 EP" or "Defensive action · 2 EP" in every .battle-skill-btn:
  1. Change the text to the type of the skill. For example : Basic Strike (Atk - 2 EP) , Fire Bolt (M.Atk - 2 EP), Defend (Def - 2 EP),...
- On the .battle-initiative-track section, make dynamic active turn. For example (My turn -> My .initiative-pill active, enemy turn -> enemy's .initiative-pill, ... ) do it dynamic if many character in the encounter. 


## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- Enhanced components. 
- Dynamic .initiative-pill active
- Battle command dock with new M.Atk menu and skills. 

## Implemented

- Moved the combat log above the battle stage and increased its text size by 2px.
- Added an M.Attack menu for `MAGIC_ATTACK` skills.
- Added concise skill type and EP labels: `Atk`, `M.Atk`, `Def`, and `Spell`.
- Added dynamic initiative-pill highlighting for player and enemy turns.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.