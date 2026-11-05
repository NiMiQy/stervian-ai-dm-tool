# Repository Guidelines

## Whole Project

Stervian AI DM is a browser RPG in which an AI acts as Dungeon Master. Players create characters, explore regions, locations and sublocations, talk with AI-roleplayed NPCs, take quests, fight turn-based battles, trade, craft, gather, farm and fish.
- Backend: Node.js (ES modules) and Express 5, with a WebSocket service.
- Database: Prisma 7 on MySQL/MariaDB. The client is generated to `src/generated/prisma-fixed`, and `npm start` runs `prisma generate` first.
- AI: LangChain and LangGraph agent harness (OpenAI, DeepSeek or Ollama models), NPC roleplay and memory subagents, and an MCP server for lookup tools.
- Frontend: plain HTML/CSS/JS pages in `public/`, with no framework. Three.js 0.186 is vendored in `public/vendor/three` and used for the 3D combat button dock.

## Project Current Stage

Phase 5 (gameplay polish). Scopes live in `PHASE5/scopes`; finished scopes are summarized in `PHASE5/scopes/done/` (latest: `improved_gameplay_1.md`).
- Done in phase 5:
  - Quest board: offers on the left and active quests on the right, abandon, max 5 active.
  - NSFW gating: `players.verified && players.is_nsfw` hides NSFW items, quests, memories and relationships, including from AI context.
  - World map: pin tooltips with monsters and average level.
  - Evade and accuracy:
    - Evade: base 10% + DEX + gear + level gap, the Dodge skill, cap 85%. Stun sets evade to 0; Daze lowers it by 25.
    - Accuracy: from the main-hand weapon and accessories. Blind lowers it by 75.
  - Main hand and sub hand equipping.
  - Crit moved to `character_stats.base_crit_*` plus gear `crit_*_bonus`.
  - SKILL_SCROLL items and the ANY_WEAPON skill restriction.
  - Inventory search, filter and sort.
  - Training dummy: an in-memory sandbox battle that is never stored in the DB.
  - Armor reduction `reduced()` now uses floor.
- Combat damage formula:
  - Armor and magic armor: `floor(raw × 100 / (100 + armor))`.
  - Elemental resists: `floor(raw × (1 − resist/100))`.
  - Every hit deals at least 1 damage.
- Migrations: new DB changes are scripts in `src/prisma/updates/`, run with `npm run migrate:*` (see `package.json`).
- Leftovers to delete: `public/game_threejs.html`, `public/js/gameThreeEnhance.js`, `public/style/game-three.css`. `public/combat_thressjs.html` and `public/js/combatThreeTest.js` are a 3D test page.

## Project Structure

```text
src/
├── server.js, index.js     # Express entry
├── prisma.config.ts        # Prisma CLI config
├── api/                    # REST routes; auth in middleware.js; characters/ sub-routes
├── containers/             # Business logic per feature (character, quest, party, travel, vault, admin...)
│   └── core/               # Game rules: battleSystemCore, fateRules, lifeskillCore
├── services/               # Services only (no rules, no helpers)
│   ├── ai/                 # agentHarness/ (LangGraph + tools), lifecycle/, prompts/, subagents/, contextManager.js
│   ├── mcp/                # MCP lookup tools/ and logics/
│   └── *Service.js         # memory, NSFW, clock, weather, ambience, party, websocket, prismaClient...
├── components/             # helpers/ (jsonParser, formatters), logics/ (items, characters, locations)
├── configs/                # constants.js (game rules/enums), aiConfig.js
├── database/               # databaseError.js (required DB error wrapper)
├── prisma/                 # schema.prisma, models/, updates/ (migrations), seeds — see PRISMA.md
├── generated/prisma-fixed/ # Generated Prisma client (do not edit)
├── logs/                   # harnessLogger, responseLogger
└── backup/
public/
├── *.html                  # index, login, game, combat, shop, crafting, admin
├── js/                     # containers/ (page controllers), components/ (UI), logics/ (API clients), constants.js
├── style/                  # CSS per page/feature
├── resources/              # Static assets
└── vendor/three/           # Three.js
tests/                      # Node test scripts
template_db/                # JSON templates (effects, items, NPCs, monsters)
logs/                       # Runtime logs
PHASE1–PHASE5/              # Scope and plan docs per phase
PRISMA.md                   # Schema notes
```

## Development Commands

Install dependencies and run the local server:

```powershell
npm install
npm start
```

The application runs at `http://localhost:3000`. Run the database seed with:

```powershell
npm run seed
```

Validate the Prisma schema without changing data:

```powershell
npx prisma validate --config src/prisma.config.ts
```

`npm test` currently reports that no automated tests are configured.

## Coding Style

Use ES modules, two-space indentation, semicolons, and single quotes in JavaScript. Use descriptive camelCase names for variables and functions; retain the existing snake_case names for Prisma models and database fields. Keep browser behavior in `public/js` and server/database behavior in `src`.

All database operations should use the project’s `databaseError()` wrapper and must not expose raw Prisma errors, SQL, credentials, or stack traces to clients.

## Testing Guidelines

No test framework or coverage requirement is configured. Before submitting changes, run syntax checks for modified JavaScript files, validate Prisma, and manually smoke-test affected API and browser flows.

Testing file must be in folder tests. 

- If there are test records inserted into DB, reroll database to normal after testing.
- DO NOT PROVIDE A RETURN MOCKUP DATA AND CLAIM THAT IS CORRECT TESTS. THE TEST MUST AND ONLY CORRECT WHEN PROVIDE TRUE INFOR FROM ENVIRONMENT  

## Commits and Pull Requests
No Git history is available in this workspace, so no established commit convention can be inferred. 

## Security and Configuration

Keep `src/.env` local and never commit credentials. Store database and AI configuration server-side. Admin APIs and `/admin.html` must remain protected by authenticated users with `users.is_admin = true`.

DO NOT IMPORT INFORMATION OF `src/.env` into any MD file when create/update. 

## Commenting
DO NOT COMMENTING ON CODE FUNCTION OR PRISMA SCHEMA
