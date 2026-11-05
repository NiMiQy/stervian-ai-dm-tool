# ⚔️ STERVIAN AI DM TOOLS

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![MCP](https://img.shields.io/badge/MCP-built--in-8A2BE2)
![Vibe Coding](https://img.shields.io/badge/Vibe-Coding-ff69b4)
![DeepSeek](https://img.shields.io/badge/AI-DeepSeek-4D6BFE)
![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules-339933?logo=nodedotjs&logoColor=white)

A localhost **AI Dungeon Master** toolkit for solo tabletop RPG sessions — Mythic GME 2e oracle, 5e skill checks, dice rolls, AI narration, NPC roleplay with memories, and a turn-based combat system, all in your browser.

---

## 💭 Why this exists

I love D&D, but getting a group together every week is hard. Solo play with Mythic GME and a pile of tables works, but I kept wanting something that could *narrate*, *remember*, and *play the NPCs* for me while I focused on my character.

So I set out to build my own dungeon tools: a localhost app for solo-ing D&D sessions, with the tools I actually use at the table — Mythic GME 2e, 5e skill checks, a dice roller — plus an AI that narrates the story and keeps memories of what happened, and NPCs that remember who you are.

**Result:** Yes — barely, but it works. 🎲 The tools have grown far beyond the first prototype, and they are now usable for a full solo session: create a character, explore the world, talk to NPCs who remember you, roll your checks, ask the oracle, and fight your way through encounters.

---

## 📑 Table of Contents

- [What tools are included](#-what-tools-are-included)
- [Getting Started](#-getting-started)
- [In progress](#-in-progress)
- [How it works](#-how-it-works)
- [Configurations](#%EF%B8%8F-configurations)
- [Features](#-features)
- [Tech stack](#-tech-stack)
- [Why DeepSeek](#-why-deepseek)
- [AI co-op assisted](#-ai-co-op-assisted)
- [License](#-license)
- [Thanks & inspiration](#-thanks--inspiration)
- [Final word](#-final-word)

---

## 🧰 What tools are included

- **Mythic GME 2e** — fate checks with odds and chaos factor, scenes, and random events to drive the story when there is no human GM.
- **5e skill checks** — ability/skill checks with DCs and modifiers from your character sheet, rolled with an animated 3D dice.
- **Agent harness (LangChain + LangGraph)** — the AI Dungeon Master runs as an agent with tools to look up the world, NPCs, scenes and relationships before it writes.
- **Turn-based RPG combat** — initiative, skills, status effects, evade/accuracy, armor and elemental resistances, loot drops.

---

## 🚀 Getting Started

### Requirements

- [Node.js](https://nodejs.org/) (LTS)
- [XAMPP](https://www.apachefriends.org/) (or any MySQL / MariaDB server)
- A [DeepSeek API key](https://platform.deepseek.com/)

### Install & run

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-username>/stervian-ai-dm.git
   cd stervian-ai-dm
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start MySQL** from the XAMPP Control Panel and create an empty database named `stervian`.

4. **Create your environment file** — copy the example and fill in your database login:

   ```bash
   cp src/.env.example src/.env
   ```

5. **Create the tables and seed the world** (regions, locations, NPCs, monsters, items, quests, recipes and ambiences from `src/prisma/seed-data/world.json`)

   ```bash
   npx prisma db push --config src/prisma.config.ts
   npm run seed
   ```

6. **Start the server**

   ```bash
   npm start
   ```

7. Open **http://localhost:3000** in your browser. The MCP server runs at **http://localhost:3001/mcp**.

### Default account

| Username | Password    |
|----------|-------------|
| `Admin`  | `asdasd123` |

> `npm run seed` creates this admin account. You'll create your own character the first time you log in. Change the password before you expose the server to anyone else.

---

## 🚧 In progress

- **Improving the combat system** — balance, AI enemy decisions, and multiplayer combat polish.

---

## 🧠 How it works

1. **AI narration & NPC roleplay workflow**
   - You type an action (optionally with a skill check, fate check or tool call).
   - The **master agent** reads the context — character sheet, location, weather, active scenes, quest log, nearby NPCs and recent story — and decides what happens.
   - When an NPC needs to speak, the master hands off to an **NPC roleplay subagent** that answers *in character*, using that NPC's personality, knowledge, memories and relationship with you.
   - The **narration** step stitches it all into the story you read, with suggested choices.
   - After the turn, **memory workers** summarize what happened into story memories, NPC memories and relationship changes, so the world remembers you next time.
2. **You need a DeepSeek API key.** Enter it in the game — nothing AI-related lives in `.env`.
3. **NSFW support** is available if you want it, behind an account-level verification toggle. ⚠️ **You must be 18 or older** to enable it.

---

## ⚙️ Configurations

### DeepSeek API key

Open the game page and click **🔑 Enter AI API key** (next to *Clear history*). Paste your key and press **Save**.

- The key is stored **only in your browser** (`localStorage`) and sent with each request to your local server.
- It is never written to `.env`, the database, or the logs.
- The button turns **green** when a key is saved; click **Remove** to clear it.

### Model, temperature & tokens

Edit `src/configs/constants.js`:

```js
export const DEFAULT_AI_MODEL = 'deepseek-flash';

export const AI_DEFAULTS = freeze({
  TEMPERATURE: 0.7,      // creativity: lower = steadier, higher = wilder
  TOP_P: 0.95,
  TOP_K: 40,
  MAX_TOKENS: 4000,      // max length of one AI reply
  TIMEOUT_MS: 45000,     // request timeout
});
```

`src/configs/aiConfig.js` reads these values. You can also set `AI_MAX_TOKENS` and `AI_CONTEXT_WINDOW_TOKENS` in `src/.env` to override them without touching the code.

---

## ✨ Features

1. **LangChain / LangGraph** agent harness for the AI Dungeon Master.
2. **MCP server** with database lookup tools — tested with **Claude**, **Antigravity** and **Codex**.
3. **AI tools** — auto-summarize NPC memories and auto-summarize scene stories.
4. **Turn-based RPG combat.**
5. **Living world** — NPCs, NPC memories, NPC knowledge, weather, quests and NPC relationships.
6. **Shop** and **multiplayer sessions** *(works, but needs improving)*.
7. **Idle lifeskill system** — crafting, cooking, alchemy, gathering, processing *(trading is in development)*.
8. **NPC companions** *(in development)*.
9. **Multiplayer combat** *(works, but needs improving)*.
10. **Admin dashboard** — manage items, shops, locations, NPCs and more.

---

## 🛠 Tech stack

- **XAMPP** (MySQL / MariaDB) with **Prisma**
- **Node.js** + **Express**
- **JavaScript**, **HTML / CSS** (no frontend framework)
- **WebSocket** for live party updates
- **Three.js** for the 3D dice and combat dock

---

## 💙 Why DeepSeek

Simple: I love this model. It's **cheap**, it **reasons well**, and it writes good roleplay — perfect for long solo sessions where the AI is talking a lot.

---

## 🤝 AI co-op assisted

This project was built with help from:

- **Claude** (mostly Opus 5.5)
- **Codex** (GPT 6-Sol, Luna)
- **Gemini** (Flash, Argon)

> ⚠️ **BEWARE:** I'm a human and I can make mistakes — and AI can make mistakes too. Read the code before you trust it.

---

## 📜 License

Released under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 NiMiQy (Lis)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Thanks & inspiration

Thanks to those who inspired this tool:

1. **Dungeons & Dragons** Player's Handbook & Dungeon Master's Guide, D&D 5e — *TSR, Wizards of the Coast, Hasbro*
2. **Mythic Game Master Emulator 2e** — *Tana Pigeon*
3. **Universal NPC Emulator** — *Zach Best, Conjecture Games*
4. **Black Desert Online** — *Pearl Abyss*
5. **SillyTavern**
6. **The designer of the world map**

*This is an unofficial fan project and is not affiliated with or endorsed by any of the above.*

---

## 🗡 Final word

Feel free to improve, develop, and use these tools for yourself. Happy adventuring! 🐉
