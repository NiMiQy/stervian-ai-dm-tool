# Combat Persistence & Anti-Dodge System

## Goal
Eliminate combat dodging, page-refresh resets, and modal bypass exploits by implementing a **server-authoritative combat persistence engine**. Combat state must survive browser refreshes, tab closures, and server process restarts, while maintaining ultra-low latency for turn calculations.

The selected architecture is **Two-Tier Hybrid: In-Memory L1 Cache + MySQL Write-Through L2 Persistence**.

---

## 1. Problem Statement & Exploit Vectors

Under the current implementation:
1. **In-Memory Volatility**: Active combat sessions are stored only in a transient Node.js `Map` (`sessions` in `battleSystemCore.js`). A server restart or crash permanently loses combat state.
2. **Client-Controlled Modal Closure**: In `battleContainer.js`, the close button (`[data-close-battle]`) and Escape button (`#btnMenuEscape`) only toggle the CSS class `modal.classList.remove('is-open')`. The server is not informed, allowing players to walk away from combat.
3. **Missing Boot-Time Reconnection**: On page reload (`F5`), `gameContainer.js` initializes without checking whether the player is currently in battle.
4. **Non-Combat Action Exploits**: While secretly in battle, players can continue to move between sublocations, shop, equip/unequip gear, and consume items because those endpoints lack combat checks.
5. **Encounter Re-roll Exploit**: Triggering an encounter while already in combat unconditionally overwrites `sessions.set(userId, battle)`, letting players restart difficult fights with full health monsters.

---

## 2. Architecture: Two-Tier Hybrid (L1 Memory + L2 MySQL)

```
       +-------------------------------------------------------------+
       |                        Client (Browser)                     |
       +-------------------------------------------------------------+
               |                                            ^
  POST /api/battles/actions                      Re-hydration on Boot
  (Skill, Item, Flee)                           (GET /api/battles/active)
               |                                            |
               v                                            |
       +-------------------------------------------------------------+
       |                  Express Server / battleSystemCore          |
       +-------------------------------------------------------------+
               |                                            ^
     1. Instant Read/Action                                 | 3. Cache Miss Hydration
               v                                            |
       +--------------------+                      +--------------------+
       |  L1 In-Memory Map  |                      |   L2 MySQL Table   |
       |  (Node.js Heap)    |                      |  (combat_sessions) |
       |                    |                      |                    |
       | < 0.1ms execution  |                      | Survives restart & |
       | Turn simulation    | ---- 2. Async Write ->| page refreshes     |
       | RNG & Monster AI   |     Through per turn |                    |
       +--------------------+                      +--------------------+
```

### Key Performance Advantages
- **Turn Execution at Microsecond Speeds**: Turn queue sorting, damage calculations, and NPC AI decisions run 100% in Node.js memory ($< 0.1\text{ms}$).
- **Zero Database Lock Contention during Calculation**: The database is never queried during the mid-turn decision loop.
- **Write-Through at Turn Boundaries**: Once the player's action and all subsequent NPC counter-turns resolve, the consolidated snapshot is written to MySQL in a single fast, indexed `upsert`.
- **Fault-Tolerant Reconnection**: If the player reloads or the server restarts, the server checks L1; if empty, it queries MySQL L2, warms L1, and forces the client back into the combat modal.

---

## 3. Database Schema Design

### Prisma Model: `src/prisma/models/combat_sessions.prisma`

```prisma
model combat_sessions {
  id           Int        @id @default(autoincrement())
  user_id      String     @unique
  character_id Int        @unique
  status       String     @default("IN_PROGRESS") // "IN_PROGRESS", "VICTORY", "DEFEAT", "FLED"
  battle_state Json       // Compact serialized battle snapshot
  created_at   DateTime   @default(now()) @db.DateTime(0)
  updated_at   DateTime   @updatedAt @db.DateTime(0)

  character    characters @relation(fields: [character_id], references: [id], onDelete: Cascade)
  user         users      @relation(fields: [user_id], references: [user_id], onDelete: Cascade)

  @@index([user_id])
  @@index([character_id])
}
```

### JSON Snapshot Optimization
To keep payload size small ($< 4\text{KB}$) and writes fast:
- **Include dynamic runtime data**: Current turn number, turn queue IDs/order, player vital state (`hp`, `maxHp`, `energy`, `spellPoints`), monster runtime states (`id`, `name`, `current_hp`, `max_hp`, `statuses`, `activeDefense`), consumables inventory, and recent combat logs.
- **Exclude static database definitions**: Do not serialize full item dictionaries or NPC monster stat tables; reference their IDs.

---

## 4. Server-Side Implementation Details

### A. State Lifecycle in `src/containers/core/battleSystemCore.js`

1. **Cache-Aside Retrieval (`getOrRestoreBattle`)**:
   ```javascript
   export async function getOrRestoreBattle(userId) {
     // 1. Check L1 Memory Map
     if (sessions.has(userId)) {
       return sessions.get(userId);
     }

     // 2. Cache miss: Read from L2 MySQL
     const record = await prisma.combat_sessions.findUnique({
       where: { user_id: userId, status: 'IN_PROGRESS' }
     });

     if (record?.battle_state) {
       sessions.set(userId, record.battle_state);
       return record.battle_state;
     }

     return null;
   }
   ```

2. **Encounter Initialization Guard**:
   In `createEncounter(userId, characterSupplier, monsterNames)`:
   - Call `await getOrRestoreBattle(userId)`.
   - If an active battle already exists with `status === 'IN_PROGRESS'`, **return the existing battle immediately** instead of generating a new one.

3. **Turn Persistence (`performBattleAction`)**:
   - Resolve player action.
   - Execute `runNpcTurns(battle)`.
   - If battle is still `'IN_PROGRESS'`:
     - Update L1 cache: `sessions.set(userId, battle)`.
     - Write-through to L2 MySQL:
       ```javascript
       await prisma.combat_sessions.upsert({
         where: { user_id: userId },
         create: {
           user_id: userId,
           character_id: characterId,
           battle_state: battle,
           status: 'IN_PROGRESS'
         },
         update: {
           battle_state: battle,
           status: battle.status
         }
       });
       ```
   - If battle ends (`VICTORY`, `DEFEAT`, or `FLED`):
     - Execute `finalizeBattle(userId, battle)`.

4. **Atomic Teardown (`finalizeBattle`)**:
   - Inside the existing `prisma.$transaction` for rewards/penalties:
     ```javascript
     await tx.combat_sessions.deleteMany({ where: { user_id: userId } });
     ```
   - Clear L1 cache: `sessions.delete(userId)`.

---

### B. Combat Lock Guard (Anti-Exploit Middleware)

Create an assertion helper in `battleSystemCore.js` or `characterContainer.js`:

```javascript
export async function assertNotInCombat(userId) {
  const activeBattle = await getOrRestoreBattle(userId);
  if (activeBattle?.status === 'IN_PROGRESS') {
    const error = new Error('You cannot perform this action while engaged in combat.');
    error.statusCode = 409;
    error.inCombat = true;
    throw error;
  }
}
```

Apply `assertNotInCombat(session.user_id)` to protected routes in `src/server.js`:
- `/api/characters/:id/equip`
- `/api/characters/:id/unequip`
- `/api/characters/:id/use-item`
- `/api/characters/:id/sublocation`
- `/api/characters/:id/buy-item`
- `/api/characters/:id/sell-item`
- `/api/characters/:id/stats`
- `/api/vault/*`
- `/api/characters/:id/long-rest`

---

### C. Active Battle Endpoint

Add in `src/server.js`:

```javascript
app.get('/api/battles/active', async (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  try {
    const battle = await getOrRestoreBattle(session.user_id);
    if (battle && battle.status === 'IN_PROGRESS') {
      return response.json({ inCombat: true, battle });
    }
    return response.json({ inCombat: false });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to check active battle status.' });
  }
});
```

---

### D. Authoritative Escape / Flee Action

Replace the client-side close escape with a server-side turn action:

1. **Formula**:
   $$\text{FleeChance} = \text{clamp}\left(40 + (\text{PlayerDex} - \text{AverageEnemyDex}) \times 3,\; 10,\; 85\right)$$
2. **Resolution**:
   - **Success**: Battle status becomes `'FLED'`. `combat_sessions` is removed. Player returns to safety without death penalties or loot.
   - **Failure**: Player turn is consumed. Log message: *"Escape failed!"*. NPCs take their turn. Updated state is persisted to L1/L2.

---

## 5. Client-Side Implementation Details

### A. Re-hydration on Page Load
In `public/js/containers/gameContainer.js`:
- During initial boot (after `getCharacter`):
  ```javascript
  const activeCheck = await getActiveBattle();
  if (activeCheck?.inCombat && activeCheck.battle) {
    await battleModalController.openWithExistingState(activeCheck.battle);
  }
  ```

### B. Modal Lockdown in `public/js/containers/battleContainer.js`
1. **Disable Dismissal**:
   - While `state.status === 'IN_PROGRESS'`, hide or disable all close triggers (`[data-close-battle]` and `Escape` key).
2. **Server-Bound Escape**:
   - Change `#btnMenuEscape` from calling local `close()` to executing:
     ```javascript
     await act('flee'); // Sends flee action to POST /api/battles/actions
     ```
3. **Window Unload Warning**:
   - Register `beforeunload` when combat starts:
     ```javascript
     window.addEventListener('beforeunload', (event) => {
       if (isBattleActive()) {
         event.preventDefault();
         event.returnValue = 'Combat is in progress. Leaving will not exit or reset the battle.';
       }
     });
     ```

---

## 6. Edge Cases & Safety Mechanisms

1. **Server Restarts During Combat**:
   - L1 memory is flushed on restart.
   - Next player request (or active battle check) hits `getOrRestoreBattle`, finds the L2 record in MySQL, restores the battle into L1, and continues seamlessly.
2. **Abandoned Combat Sessions (TTL Cleanup)**:
   - Introduce a background job or threshold query: sessions older than 24 hours with no player action can either be automatically flagged as `'DEFEAT'` or cleaned up to prevent orphaned records.
3. **Concurrent Action Throttling**:
   - Preserve `battle.isProcessingAction` lock on the session to reject duplicate rapid clicks (`409 Conflict: Action in progress`).

---

## 7. Implementation Roadmap

| Step | Scope | Description |
| :--- | :--- | :--- |
| **Phase 1** | Schema | Add `combat_sessions.prisma`, run Prisma validate & generate. |
| **Phase 2** | Core Engine | Implement `getOrRestoreBattle`, write-through upsert, and reconnect check in `battleSystemCore.js`. |
| **Phase 3** | Server APIs | Add `/api/battles/active` and apply `assertNotInCombat` guards to `src/server.js`. |
| **Phase 4** | Client UI | Update `battleContainer.js` (lockdown close, flee action) and `gameContainer.js` (reconnect on boot). |
| **Phase 5** | Verification | Verify against test scenarios: page refresh during combat, closing browser tab, server restart mid-fight, and flee failure/success. |
