# Server-Side Game Logic Plan

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

## Scope

### Scope 2
- Make a inventory rule. Make it basic, Item has size, some item can stackable, summary their size < max slots. 

- Equipment's rule, these are some items with two hand (weapon) will not allow to wear in both hand. If that weapon already weared, force it into left hand, and lock the right hand equipment slot. Equipment has their type, make it fit to slot type. 

- Character can only equip their equipment and using their items ONLY WHEN THAT ITEMS ARE IN THEIR INVENTORY. That mean player's Character owned the item. (no doubt)

- Finalize formulas for calculating all stats when equip items. 

### Scope 3
- Find a progression by any game RPG that could help. Best in first stage lv1-10 progression. 
- Make and create database NPCs for lv1-10 progression (include NPCs, enemies, allies, quest npc)