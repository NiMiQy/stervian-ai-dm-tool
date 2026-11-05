# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## PLANS - TODO LIST :
Base on my currently, I have plans for improve some features:
1. NEED TO HAVE:

- Death Spiral Protection (stop player from death to death again after they got wipe their equipment) ( could solve this in crafting system ) - (this could be done through the crafting system)
- World travel, Location Travel system (moving location to location) - implemented
- A log for combat/player tracking action in combat - implemented

2. NICE TO HAVE:
- UPGRADE - CRAFTING system. - implemented
- Floating battle text damage.
- Quest/bounty board (Journal tab) - implemented
- Lifeskill systems - implemented
- Gear Stat Comparison Tooltip
- Day/Night cycle (night hunting system) - REMOVED OUT OF PLANS

3. NEED TO IMPROVE:
- JSON payload too long , server error. - implemented
- Refactor code - implemented
- UX/UI game client. - implemented
- Improve AI DM , tools, sub agent, gameplay, NPC, world - implemented