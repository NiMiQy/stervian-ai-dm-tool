# MCP & API Authentication Plan

## Goal

Secure the Stervian MCP server and public-facing endpoints to support external players and third-party AI DM clients safely, eliminating IDOR (Insecure Direct Object Reference) and unauthorized state mutations.

---

## 1. Vulnerability Analysis

- **Unauthenticated Transport**: The `/mcp` HTTP route currently accepts tool invocations without verifying the caller's identity.
- **BOLA / IDOR in Tool Schemas**: Tools (`get_character_info`, `publish_encounter`, `publish_story_to_game`) require a client-supplied `userId`. Any caller knowing or guessing another player's UUID can inspect private character stats or force combat encounters onto that player.

---

## 2. Architecture & Security Controls

### A. Personal API Tokens (Bearer Auth)
- Each player can generate a scoped **Personal Access Token (PAT)** from their game settings.
- Tokens are hashed (SHA-256) before storing in the database.
- MCP clients authenticate via standard HTTP Authorization header:
  ```http
  Authorization: Bearer stv_live_<token>
  ```

### B. Context-Derived Identity (Eliminate `userId` Argument)
- **Remove `userId` from public MCP tool input schemas**.
- The MCP server automatically binds the authenticated `user_id` from the request context to every tool execution.
- Tools automatically operate **only** on the character owned by the authenticated token.

### C. Role Separation
1. **Player DM Tier (Default)**:
   - Scope: Self character only.
   - Permitted tools: `get_character_info`, `publish_encounter` (self only), `publish_story_to_game` (self only).
2. **Admin / System DM Tier**:
   - Scope: Multi-character / global world events.
   - Protected by master server secret (`users.is_admin = true`).
   - Permitted tools: Global narrative and administrative moderation.

### D. Rate Limiting & Griefing Protection
- Limit combat and story trigger frequency (e.g., maximum 1 encounter creation every 30 seconds per token) to prevent spamming active battle modals.

---

## 3. Database Schema Updates

Add a lightweight token model in `schema.prisma`:

```prisma
model api_tokens {
  id           Int       @id @default(autoincrement())
  user_id      String    @db.VarChar(36)
  name         String    @default("Default DM Token") @db.VarChar(100)
  token_hash   String    @unique @db.VarChar(64)
  last_used_at DateTime?
  expires_at   DateTime?
  created_at   DateTime  @default(now())
  deleted      Boolean   @default(false)

  user         users     @relation(fields: [user_id], references: [user_id], onDelete: Cascade)

  @@index([user_id])
}
```

---

## 4. Implementation Steps

1. **Token Service**: Create `src/services/apiTokenService.js` to generate, hash, and validate bearer tokens.
2. **MCP Auth Middleware**: Update `src/services/mcp/mcp.js` to intercept requests to `/mcp`, parse `Authorization: Bearer <token>`, and reject invalid/missing tokens with `401 Unauthorized`.
3. **Refactor Tool Handlers**:
   - Remove `userId` from Zod schemas in `characterTools.js` and `gameTools.js`.
   - Pass `request.authenticatedUser.id` directly into `getCharacterSheet`, `createEncounter`, and `publishStory`.
4. **Token Management UI**: Provide a simple "Generate DM Token" button inside player settings in the client.
