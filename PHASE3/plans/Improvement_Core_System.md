# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## PLANS - TODO LIST :
Base on my currently, I have plans for improve some features:
1. NEED TO HAVE:
- Using Items (Comsumable) in combat -> implemented
- Authoritative Escape / Flee system (need formulas -> fail or success) -> implemented
- Persist the combat session (battle reconnect / anti-combat-log) -> implemented

- Status Effects Tick Engine (need logics for status effects like STUN, POISON, DAZE,...) -> Implemented 

- Death Spiral Protection (stop player from death to death again after they got wipe their equipment)
- World travel, Location Travel system (moving location to location)
- A log for combat/player tracking action in combat

2. NICE TO HAVE:
- UPGRADE - CRAFTING system.
- Floating battle text damage.
- Quest/bounty board (Journal tab)
- Party / Companion combatants -> implemented
- Lifeskill systems
- Gear Stat Comparison Tooltip