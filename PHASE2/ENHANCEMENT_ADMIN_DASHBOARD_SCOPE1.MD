# Admin Dashboard

## Goal

Adapt every tab's UX/UI in `admin.html` and its supporting frontend scripts, styles, and backend services to strictly align with the authoritative database schema defined in `src/prisma/models/*.prisma`. Support full CRUD operations, relations, and modern administration controls across all models without exposing raw database errors or leaking sensitive data.

Schema: `src/prisma/models/*.prisma`

## Scope

- Check and audit all 13 database models against the admin console.
- Modernize UX/UI for all tabs: filters, search, table representations, sortable columns, and customized sub-tabs/modals.
- Integrate missing models: `prefixes`, `suffixes`, `stories`.
- Ensure complex relations are fully manageable: character vault (`character_vaults` + `vault_items`), inventory upgrade level & affixes, item granted skills (`skills_in_items`), status effects, sublocation shop/inn items (`sublocations_items`), and debuff cure flags.
- Provide soft-delete management and restoration for user accounts.

## IMPORTANT:
- Do not change irrelevant files.
- Keep browser behavior in `public/js` and server/database behavior in `src`.
- Use the `databaseError()` wrapper for server errors; never leak raw SQL or stack traces.
- DO NOT import information of `src/.env` into any markdown file.

## TRY TO:
- Stick to existing project workflows and design patterns.
- Ensure all inputs and models validate cleanly against Prisma.

## Implemented
- **Full 13-Tab Coverage**:
  - **Users (`users`)**: Credential management, admin role toggle, soft-delete toggle (`user_active`), metadata overview, linked character card with job and level, and table "Restore" action.
  - **Characters (`characters`)**: 5 organized sub-tabs (Identity, Stats, Equipment & Bag, Skills & Magic, Lifeskills & Lore). Added `sublocation_id` (dynamically filtered by location), `respawn_location_id`, `is_updated_by_user`, item upgrade levels (`current_level_upgraded`, `prefix_id`, `suffix_id`), character vault storage (`character_vaults` + `vault_items`), and story narrative preview card.
  - **Items (`items`)**: Support for 16 item types, 10 weapon types, 7 rarities, stack parameters, max upgrade level, buyable flag, food/water recovery bonuses (`current_food_bonus`, `current_water_bonus`), granted skills editor (`skills_in_items`), and linked status effects (`itembonus_effects`).
  - **Skills (`skills`)**: Target rules, damage types, AP cost, duration, healing current HP, combat amplifiers, 7 elemental damage ratings, and status effect triggers with turn duration and debuff cure checkboxes (`is_cure_all`, `is_poison_cure`, `is_stun_cure`, `is_daze_cure`, `is_weak_cure`, `is_blind_cure`).
  - **Effects (`effects`)**: Full support for all 16 `EffectType` enum states including survival debuffs (`HUNGRY`, `STARVING`, `STARVATION`, `THIRSTY`, `DEHYDRATED`, `SEVERE_DEHYDRATION`) with color-coded badges.
  - **Lifeskills (`lifeskills`)**: Trade name and description management with active character counters and search filter.
  - **Regions (`regions`)**: World lore fields (geography, politics, culture) and location counts.
  - **Locations (`locations`)**: Region grouping optgroups, 8 location types, `is_safe_zone` toggle, and sub-lore fields.
  - **SubLocations (`sublocations`)**: 10 sublocation types, description length capped at 200 characters (`@db.VarChar(200)`), and conditional Shop/Inn item inventory manager (`sublocations_items`).
  - **Loot Groups (`loot_groups`)**: Independent drop chance %, min/max quantities, item search toolbar, and monster assignment cards.
  - **Prefixes (`prefixes`)**: Item prefix affixes with rarity, 4 power tiers (`TIER_1`..`TIER_4`), crit chance/damage, core attributes, combat amplifiers, and elemental resistances.
  - **Suffixes (`suffixes`)**: Item suffix affixes with rarity, 4 power tiers (`TIER_1`..`TIER_4`), crit chance/damage, core attributes, combat amplifiers, and elemental resistances.
  - **Stories (`stories`)**: AI DM narrative management with character picker, auto-resolving owner UUID, latest player action prompt, rich story narrative editor, and timestamps.
- **Backend & Whitelisting (`src/server.js`, `src/containers/adminContainer.js`)**:
  - Whitelisted `'prefixes'`, `'suffixes'`, and `'stories'` in `adminMutation`.
  - Added relation synchronization for character vaults, bag affixes/upgrades, item granted skills, skill cure flags, and sublocation shop items.
  - Implemented soft-delete restoration for user accounts via `PATCH /api/admin/users/:id` with `{ deleted: false }`.
- **Styling & Responsive Layout (`public/style/admin.css`)**:
  - Added tier badges (`.badge-tier-1` to `.badge-tier-4`), `.badge-effect-survival`, and `.vaultRow`.
  - Updated `.invRow` to cleanly accommodate upgrade level, prefix, and suffix selectors.
- **Verification**:
  - Syntax validated with `node -c` on `public/js/admin.js`, `src/containers/adminContainer.js`, and `src/server.js` (exit code 0).
  - Prisma schema validated with `npx prisma validate --config src/prisma.config.ts` (exit code 0).

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.
