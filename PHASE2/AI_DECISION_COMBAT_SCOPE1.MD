# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about PHASE2 AI DECISION IN COMBAT

Find plan in PHASE2/plans/AI_DECISION_COMBAT.MD

Schema : PRISMA.MD file - Structure

## Scope
Implement the AI_DEICISION_COMBAT template.


## WANT TO ARCHIVE:
- Worked AI decision in combat.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Shared Aggressive/Cautious/Desperate template with the planned action weights, strict HP thresholds, two-turn caution refresh, and no consecutive defense.
- NPC skills consume no energy or spell slots. Desperate selection estimates damage after mitigation, including expected critical damage.
- Basic Strike fallback and a default Defend that doubles physical/magic armor when no effective defense skill exists. Defense expires at the defender's next turn.
- Existing single-target selection retained. Group-target and healing skills are excluded until their effects are supported by the NPC resolver.
- State changes and actions appear in battle logs; no client layout or schema changes.
- Verification: `node --test tests/npcCombat.test.js` (7 passing checks; 20 consecutive runs passed), JavaScript syntax checks, and Prisma validation passed. Tests isolate the real battle functions from database access.
- Corrected test-only random injection so NPC decisions and damage use the controlled test source. Production randomness is unchanged.
- Distribution checks cover 40,000 decisions across the three states and the post-defense restriction; the agreed weights are unchanged.
- Live authenticated browser verification passed using MCP `publish_encounter` with Wolf after restarting the local server to load the implementation.
- Observed: 15/65 HP loss triggered Cautious; Defend reduced the next Strike from 15 to 13 damage; the following NPC turn attacked; at 7/65 HP the Wolf entered Desperate and used Bite.
- Completed the battle through the UI. Victory displayed and saved 180 EXP, 241 gold, and one Wolf Skin; player finished at 7/53 HP. Automated checks cover the other state and probability cases.
