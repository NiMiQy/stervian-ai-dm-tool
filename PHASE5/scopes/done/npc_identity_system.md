# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

Schema : PRISMA.MD file - Structure

## Scope
- NPC identity system: players can give NPCs a true or a false name. Each NPC remembers the player by the name it was told. The real name only becomes known through an explicit "Reveal real name" action.

### 1. Data (`player_npc_relationships`, per player and NPC)
- `known_as_name` (String?, VarChar 60): the name this NPC believes the player has.
  - null means it was never told and the NPC calls the player "stranger".
- `nickname` (String?, VarChar 60): a short call-name, used only after the real name is revealed.
- `is_player_name_revealed` (existing): becomes true only through the Reveal button flow (section 4).
- Memories stay linked by `target_character_id` (character id), never by name, so duplicate or fake names cannot mix memories up.

### 2. Introductions in chat (AI tool `reveal_player_name_to_npc` is replaced by `introduce_name_to_npc`)
- Parameters:
  - `npc_name`: the canonical NPC that heard it.
  - `spoken_names`: the names exactly as said, in order.
  - `subject`: `self` or `party`.
- `subject = self`: the speaker's `known_as_name` is set to the first spoken name.
- This applies to every name, true or false, including the real name. It NEVER sets `is_player_name_revealed`.
- Changing a fake name before revealing ("I'm Quinn Whalter", later "call me Q") quietly updates `known_as_name`, at no affinity cost.
- `subject = party`: the leader introduces party members. The names map in FIFO order to party members #2, #3, ... in join order. Only real player characters count; companion NPCs are skipped.
  - The party section of the DM prompt lists the members numbered in that order.
  - Extra names beyond the member count are ignored.
- After the real name is revealed: "call me Q" sets `nickname`, and `known_as_name` stays as the real name.
- Introductions only work for the party leader's turn, because only the leader can act in a party.

### 3. Auto-create relationships for the whole party
- When `roleplay_npc` actually runs for a canonical NPC (not merely when it is targeted), every real-player party member who has no relationship row with that NPC gets one created:
  - STRANGER, affinity 0, `known_as_name` null.
- Only members in the same location / sublocation as the leader.
- Fixes the bug where party members who never met the NPC had no relationship.

### 4. "Reveal real name" chip button
- Visible only when:
  - a canonical NPC chip is selected,
  - that NPC does not know the player's real name yet (`is_player_name_revealed` false), and
  - the player is not a non-leader party member.
- It is hidden once the name is revealed.
- Party members who are not the leader cannot use it; they must leave the party, or reveal when they are their own leader.
- Pressing it sends an automatic story turn: "I tell <NPC> my real name: <real name>."
- The DM must call the tool `reveal_real_name_to_npc`, which compares `known_as_name` with the real name (case-insensitive, trimmed):
  - **Match, or `known_as_name` null:** set `is_player_name_revealed = true` and `known_as_name = real name` quietly; the DM narrates normally.
  - **Mismatch (the player lied):**
    - Set `is_player_name_revealed = true` and `known_as_name = real name`.
    - Affinity −100 (subtract 100, clamped to −400..500, status recalculated) for the liar AND every current party member who is in the same location / sublocation. No members elsewhere, and no future party members.
    - Memories:
      - On the liar: "The one I knew as <old known_as_name> is really <real name>; they lied to me."
      - On each other penalized member: "<member> travels with <real name>, who lied to me about their name."
    - The DM narrates the NPC's reaction to the lie.

### 5. AI DM rules
- The prompt tells the targeted NPC only what it knows:
  - "<NPC> knows the player as <known_as_name>", or "does not know the player's name" when null.
  - If revealed: the real name, or the nickname when set.
- Rule: NPCs NEVER use the player's real name until it is revealed. After the reveal they use `nickname` if set, otherwise the real name.
- Memory redaction (`redactPlayerNameFromMemory`) keeps hiding the real name until it is revealed.

### Decisions recorded
- Aliases are per NPC.
- Party introductions are for real player characters only; companions are not introduced.
- Lie penalty: fixed −100 (subtracted), no scaling, applied to the whole party present.
- NPCs never share memories about other players (privacy kept; see the Zanla / Quinn / LoneWolf test).

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 
- If there is testing cases and inserted test records in database. Rollback to normal after finish testing records (remove test records out of database). 

## Implemented

### NPC identity system (v1)
- Migration: `npm run migrate:npc-identity` adds `known_as_name` and `nickname` (VARCHAR 60, nullable) to `player_npc_relationships`.
- `src/services/npcIdentityService.js`: the core logic.
  - Introductions, party relationship auto-create, reveal + lie penalty, prompt text.
  - Clears the relationship cache, so a penalty is not overwritten by stale cached affinity.
- AI tool `introduce_name_to_npc(npc_name, spoken_names[], subject: self|party)` replaces `reveal_player_name_to_npc`.
  - It only sets `known_as_name`; after a reveal it sets `nickname` instead.
  - Party FIFO uses join order (`slot_order`), real players only. The party section of the prompt lists "#2 = ..., #3 = ...".
- Reveal flow: the client sends `revealNpcId` with the auto story turn.
  - The server (`api/characters/actions.js`) checks the name BEFORE the DM turn, deterministically, so it cannot be skipped or triggered by typed text.
  - It passes the result to the DM as "### Name Reveal (system-confirmed)".
  - This replaces the DM-called check from the design; the outcome is the same.
- Lie: −100 subtracted (clamped −400..500, status recalculated) for the liar plus party players in the same location / sublocation.
  - Memories: EPISODIC on the liar, plus one on each other penalized member, written with the name the NPC knew them by.
- `roleplay_npc`: creates STRANGER rows for present party players and gives the NPC actor only the name it knows.
- Memory writer: new memories use the name the NPC knows ("a stranger" if none), never the hidden real name.
- Prompt: "### NPC Name Knowledge" replaces "NPC Name Disclosure". The strict rule that NPCs never use the real name until it is revealed is included.
- Client: a "Reveal real name" chip appears next to "End conversation" (existing chip style).
  - Shown for a selected canonical NPC that does not know the real name, hidden for non-leader party members.
  - Clicking sends "I tell <NPC> my real name: <name>."
- `GET /api/npcs/nearby` now includes `name_revealed` per NPC.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.