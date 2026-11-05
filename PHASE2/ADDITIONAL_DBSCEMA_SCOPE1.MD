# Game Logic

## Goal

Build and verify the authoritative RPG rules on the server before connecting the final game UI/UX. The server must own stat calculations, inventory mutations, equipment validation, progression, and all persistence rules. The browser should only send player intent and render the server result.

The scope is about additional database schema, adjust client/server logics depend on schema.

## Scope
I have updated a db schema. 
- In items -> added max_stack (Item stackable will consume inventory slot when max cap)
- In item_bonus :
    1. Added base_crit_chance, base_crit_dmg (Define base crit chance and crit damage for item)
    2. Changed status_resistant_bonus -> effect_resistant_bonus
    3. Add all elemental resistant (fire, ice, earth, lightning, wind, holy , dark)
    4. Add physical_attack_bonus, magical_attack_bonus -> define attack type
    5. Add base_accuracy
- In skills :
    1. Added skill_damage_type for define a skill dealing damage type.
    2. Changed skill_type -> skill_menu_type for define which menu command dock they are in.
    3. Changed magic_attack_amplifier, magic_armor_amplifier -> magical_attack_amplifier, magical_armor_amplifier
- In item_bonus -> added max_upgrad_level . 
- Added character_vaults and vaults_item -> added schema for vaults logics.
- Added sublocations, sublocations_items -> for define shop, shop selling item. 
Following schema, edit a client/server logics.
- In item_inventory -> added prefix_id, suffix_id
- Added prefixes table, suffixes table
- Correct some typo text.
- In characters -> added respawn_at_location_id .


## WANT TO ARCHIVE:
- Apdapted new schema to client/server side logic. 
- Worked functions after adapted new logics.

## IMPORTANT:
- Do not change inrelavent files. 
- The layout client side is working very well. Do not change style. 

## TRY TO:
- Stick the current workflow and designed .
- If there is anything error or missing and need to execute a huge change, list the issues and stop. 

## Implemented

- Updated server/client logic for stack limits, 40-slot inventories, vaults, shops, affixes, elemental resistance, attack bonuses, critical stats, and skill damage types.
- Updated admin forms, seed data, Prisma mappings, and generated client for corrected schema names.
- Verified Prisma validation, live mapped queries, JavaScript syntax, and server startup.
- Added character respawn locations, server-side defeat recovery, and client respawn refresh/notification.
- Pending: migrate the live database for the new `prefixes`, `suffixes`, and inventory-affix columns.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.