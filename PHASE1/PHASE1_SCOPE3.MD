# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server owns stat calculations and battle-card seed data. The browser requests the server result and renders it without submitting derived values.

## Scope

In the game.html -> Character Sheet (Player information):
- At Attributes: 
    1. Make player could click to the stat box (INT, STR, DEX, CHA, CON, WIS) they want to invest in, pop up a confirmation and a message ask for confirm.
    2. Implement upgrade stat logics in server side if the logic is not exists yet. 
- At Equipment: 
    1. Fix the issue that the item which player equipped is not appearing.
- At Inventory Backpack: 
    1. Enhancement display, if the item type Equipment is equipping by player. Display a small yellow circle next to the item's name. 
    2. Make a tooltip when hover on item will show it's stats and information.
- At TOTAL ATTACK box:
    1. It should be seperated into two difference type : Atk Dmg , M.Atk Dmg
- At ARMOR box:
    1. It should be seperated into two difference type : Armor, M.Armor
- There is nowhere displayed Character's stats like : Fire_Resistant, Ice_Resistant, ...

## IMPORTANT:
- Do not change inrelavent files. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## WANT TO ARCHIVE:
- Worked battle system core logics. 
- Mockup data now to dynamic data.
- Log tracking (show on console)

## Implemented

- Server-authoritative attribute upgrades with confirmation, point costs, and atomic persistence.
- Dynamic equipment display, including `MAIN_HAND` items checked against both hand slots.
- Equipped-item indicators and top-positioned dynamic inventory tooltips.
- Separate Atk Dmg / M. Atk Dmg and Armor / M. Armor displays.
- Fire, Ice, Earth, Lightning, Wind, Holy, Dark, and Status resistance displays.
- Dynamic derived combat stats and equipment bonuses; removed character-sheet mockup values.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.