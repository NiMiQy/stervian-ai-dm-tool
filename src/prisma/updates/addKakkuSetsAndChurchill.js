import { pathToFileURL } from 'node:url';
import prisma from '../../services/prismaClient.js';
import { databaseError } from '../../database/databaseError.js';

const zeroBonus = {
  item_trigger_type: 'NONE',
  consume_bonus_mode: 'NONE',
  max_hp_bonus: 0,
  healing_current_hp: 0,
  cure_effect_type: null,
  current_food_bonus: 0,
  current_water_bonus: 0,
  current_energy_bonus: 0,
  proficiency_bonus: 0,
  intelligent_bonus: 0,
  strength_bonus: 0,
  dexterity_bonus: 0,
  charisma_bonus: 0,
  constitution_bonus: 0,
  wisdom_bonus: 0,
  physical_attack_bonus: 0,
  magical_attack_bonus: 0,
  armor_bonus: 0,
  magical_armor_bonus: 0,
  effect_resistant_bonus: 0,
  fire_element_resistant: 0,
  ice_element_resistant: 0,
  earth_element_resistant: 0,
  lightning_element_resistant: 0,
  wind_element_resistant: 0,
  holy_element_resistant: 0,
  dark_element_resistant: 0,
  crit_chance_bonus: 0,
  crit_damage_bonus: 0,
  evade_chance_bonus: 0,
  accuracy_bonus: 0,
  buff_duration_minutes: 0
};

const normalBossSets = [
  {
    name: 'SlimmyFriend Helm',
    type: 'HELMET',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'A resilient helm forged for the SlimmyFriend warrior set, empowering raw physical might.',
    bonus: { max_hp_bonus: 25, strength_bonus: 2, physical_attack_bonus: 3, armor_bonus: 8, magical_armor_bonus: 4 }
  },
  {
    name: 'SlimmyFriend Armor',
    type: 'ARMOR',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Heavy frontline breastplate of the SlimmyFriend set, built to maximize strength and physical strikes.',
    bonus: { max_hp_bonus: 55, strength_bonus: 4, physical_attack_bonus: 6, armor_bonus: 18, magical_armor_bonus: 8 }
  },
  {
    name: 'SlimmyFriend Gloves',
    type: 'GLOVES',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Weighted gauntlets of the SlimmyFriend set that add crushing force behind every blow.',
    bonus: { max_hp_bonus: 15, strength_bonus: 3, physical_attack_bonus: 5, armor_bonus: 6, magical_armor_bonus: 3 }
  },
  {
    name: 'SlimmyFriend Boots',
    type: 'SHOES',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Anchored greaves of the SlimmyFriend set that ground the wearer for heavy physical combat.',
    bonus: { max_hp_bonus: 15, strength_bonus: 2, physical_attack_bonus: 3, armor_bonus: 6, magical_armor_bonus: 3 }
  },
  {
    name: 'GladioFriend Helm',
    type: 'HELMET',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'An arcane circlet-helm of the GladioFriend set that sharpens intellect and spell potency.',
    bonus: { max_hp_bonus: 20, intelligent_bonus: 2, magical_attack_bonus: 4, armor_bonus: 5, magical_armor_bonus: 8 }
  },
  {
    name: 'GladioFriend Armor',
    type: 'ARMOR',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Runed battle vestments of the GladioFriend set, channeling high intelligence into destructive magic.',
    bonus: { max_hp_bonus: 45, intelligent_bonus: 4, magical_attack_bonus: 8, armor_bonus: 12, magical_armor_bonus: 18 }
  },
  {
    name: 'GladioFriend Gloves',
    type: 'GLOVES',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Spell-woven gloves of the GladioFriend set that amplify magical attack power.',
    bonus: { max_hp_bonus: 12, intelligent_bonus: 3, magical_attack_bonus: 5, armor_bonus: 4, magical_armor_bonus: 6 }
  },
  {
    name: 'GladioFriend Boots',
    type: 'SHOES',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Enchanted boots of the GladioFriend set that steady the caster while channeling spells.',
    bonus: { max_hp_bonus: 12, intelligent_bonus: 2, magical_attack_bonus: 3, armor_bonus: 4, magical_armor_bonus: 6 }
  },
  {
    name: 'Noble Guardian Helm',
    type: 'HELMET',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'A stalwart greathelm of the Noble Guardian set, fortifying vitality and mental resilience.',
    bonus: { max_hp_bonus: 45, constitution_bonus: 2, wisdom_bonus: 2, armor_bonus: 10, magical_armor_bonus: 7, effect_resistant_bonus: 3 }
  },
  {
    name: 'Noble Guardian Armor',
    type: 'ARMOR',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Bulwark plate of the Noble Guardian set, crafted for maximum health, constitution, and wisdom.',
    bonus: { max_hp_bonus: 95, constitution_bonus: 4, wisdom_bonus: 3, armor_bonus: 22, magical_armor_bonus: 14, effect_resistant_bonus: 6 }
  },
  {
    name: 'Noble Guardian Gloves',
    type: 'GLOVES',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Heavy guardian gauntlets of the Noble Guardian set that bolster endurance and ward off harm.',
    bonus: { max_hp_bonus: 25, constitution_bonus: 2, wisdom_bonus: 2, armor_bonus: 8, magical_armor_bonus: 5, effect_resistant_bonus: 2 }
  },
  {
    name: 'Noble Guardian Boots',
    type: 'SHOES',
    rarity: 'NORMAL',
    max_upgrade_level: 5,
    price: 9800,
    is_buyable: false,
    description: 'Unyielding sabatons of the Noble Guardian set that grant immense staying power in battle.',
    bonus: { max_hp_bonus: 25, constitution_bonus: 2, wisdom_bonus: 2, armor_bonus: 8, magical_armor_bonus: 5, effect_resistant_bonus: 2 }
  }
];

const kakkuRareItems = [
  {
    name: 'Kakku Helm',
    type: 'HELMET',
    rarity: 'RARE',
    max_upgrade_level: 5,
    price: 11500,
    is_buyable: false,
    description: 'The scarred warlord helm of Bandit Leader Kakku, balancing ruthless strength with razor reflexes.',
    bonus: { max_hp_bonus: 35, strength_bonus: 2, dexterity_bonus: 2, physical_attack_bonus: 3, armor_bonus: 10, magical_armor_bonus: 5, evade_chance_bonus: 2 }
  },
  {
    name: 'Kakku Armor',
    type: 'ARMOR',
    rarity: 'RARE',
    max_upgrade_level: 5,
    price: 11500,
    is_buyable: false,
    description: 'Bandit Leader Kakku’s custom brigandine-plate harness, engineered for both ferocious power and agility.',
    bonus: { max_hp_bonus: 75, strength_bonus: 4, dexterity_bonus: 4, physical_attack_bonus: 6, armor_bonus: 22, magical_armor_bonus: 10, evade_chance_bonus: 4 }
  },
  {
    name: 'Kakku Gloves',
    legacyNames: ["Kakku's Gloves"],
    type: 'GLOVES',
    rarity: 'RARE',
    max_upgrade_level: 5,
    price: 11500,
    is_buyable: false,
    description: 'Reinforced battle gloves worn by Kakku, etched with bandit notches and tuned for strength and dexterity.',
    bonus: { max_hp_bonus: 20, strength_bonus: 3, dexterity_bonus: 3, physical_attack_bonus: 5, armor_bonus: 8, magical_armor_bonus: 4, crit_chance_bonus: 3 }
  },
  {
    name: 'Kakku Boots',
    type: 'SHOES',
    rarity: 'RARE',
    max_upgrade_level: 5,
    price: 11500,
    is_buyable: false,
    description: 'Spurred combat greaves worn by Bandit Leader Kakku for explosive lunges and nimble footwork.',
    bonus: { max_hp_bonus: 20, strength_bonus: 2, dexterity_bonus: 3, physical_attack_bonus: 3, armor_bonus: 8, magical_armor_bonus: 4, evade_chance_bonus: 4 }
  },
  {
    name: 'Kakku Ring',
    type: 'RING',
    rarity: 'RARE',
    max_upgrade_level: 5,
    price: 12000,
    is_buyable: false,
    description: 'Bandit Leader Kakku’s signet ring, honed to guide twin blades with unerring accuracy.',
    bonus: { accuracy_bonus: 15, dexterity_bonus: 2, strength_bonus: 1, physical_attack_bonus: 2, crit_chance_bonus: 3 }
  }
];

async function upsertGearItem(tx, spec) {
  const searchNames = [spec.name, ...(spec.legacyNames || [])];
  const existing = await tx.items.findFirst({
    where: { name: { in: searchNames } },
    orderBy: { id: 'asc' }
  });

  const itemData = {
    name: spec.name,
    type: spec.type,
    weapon_type: 'SWORD',
    rarity: spec.rarity,
    size: 1,
    is_stackable: false,
    max_stack: 1,
    max_upgrade_level: spec.max_upgrade_level,
    description: spec.description,
    price: spec.price,
    is_buyable: spec.is_buyable,
    is_consumable: false,
    is_material: false,
    is_nsfw: false,
    deleted: false
  };

  const saved = existing
    ? await tx.items.update({ where: { id: existing.id }, data: itemData })
    : await tx.items.create({ data: itemData });

  const fullBonus = { ...zeroBonus, ...spec.bonus, deleted: false };
  await tx.item_bonus.upsert({
    where: { item_id: saved.id },
    create: { item_id: saved.id, ...fullBonus },
    update: fullBonus
  });

  return saved;
}

export async function addKakkuSetsAndChurchill(client = prisma) {
  try {
    return await client.$transaction(async (tx) => {
      const savedNormalItems = [];
      for (const spec of normalBossSets) {
        savedNormalItems.push(await upsertGearItem(tx, spec));
      }

      const savedKakkuItems = new Map();
      for (const spec of kakkuRareItems) {
        const item = await upsertGearItem(tx, spec);
        savedKakkuItems.set(spec.name, item);
      }

      const kakku = await tx.characters.findFirst({
        where: { name: 'Bandit Leader Kakku', character_type: 'NPC', deleted: false }
      });
      if (!kakku) throw new Error('Bandit Leader Kakku not found.');

      const steelSword = await tx.items.findFirst({
        where: { name: 'Steel Sword', deleted: false }
      });
      if (!steelSword) throw new Error('Steel Sword not found.');

      await tx.character_items.deleteMany({
        where: { character_id: kakku.id, location: 'EQUIPPED' }
      });

      const kakkuEquipped = [
        { equip_slot: 'RIGHT_HAND', item_id: steelSword.id },
        { equip_slot: 'LEFT_HAND', item_id: steelSword.id },
        { equip_slot: 'HELMET', item_id: savedKakkuItems.get('Kakku Helm').id },
        { equip_slot: 'ARMOR', item_id: savedKakkuItems.get('Kakku Armor').id },
        { equip_slot: 'GLOVES', item_id: savedKakkuItems.get('Kakku Gloves').id },
        { equip_slot: 'SHOES', item_id: savedKakkuItems.get('Kakku Boots').id },
        { equip_slot: 'LEFT_RING', item_id: savedKakkuItems.get('Kakku Ring').id }
      ];

      for (const eq of kakkuEquipped) {
        await tx.character_items.create({
          data: {
            character_id: kakku.id,
            item_id: eq.item_id,
            location: 'EQUIPPED',
            equip_slot: eq.equip_slot,
            quantity: 1,
            current_level_upgraded: 0,
            deleted: false
          }
        });
      }

      let kakkuLootGroup = await tx.loot_groups.findFirst({
        where: { name: 'Kakku Drops', deleted: false }
      });
      if (!kakkuLootGroup) {
        kakkuLootGroup = await tx.loot_groups.create({
          data: {
            name: 'Kakku Drops',
            description: 'Boss drops from Bandit Leader Kakku',
            loot_group_rarity: 'BOSS',
            min_gold: 500,
            max_gold: 800,
            deleted: false
          }
        });
      }

      const kakkuTag = await tx.items.findFirst({
        where: { name: "Kakku's Tag", deleted: false }
      });

      await tx.lootgroups_items.deleteMany({
        where: { loot_group_id: kakkuLootGroup.id }
      });

      const lootEntries = [
        ...(kakkuTag ? [{ item_id: kakkuTag.id, chance_pct: 100, min_quantity: 1, max_quantity: 1 }] : []),
        ...[...savedKakkuItems.values()].map((item) => ({
          item_id: item.id,
          chance_pct: 10,
          min_quantity: 1,
          max_quantity: 1
        })),
        ...savedNormalItems.map((item) => ({
          item_id: item.id,
          chance_pct: 35,
          min_quantity: 1,
          max_quantity: 1
        }))
      ];

      await tx.lootgroups_items.createMany({
        data: lootEntries.map((entry) => ({
          loot_group_id: kakkuLootGroup.id,
          ...entry,
          deleted: false
        }))
      });

      const existingKakkuLootLink = await tx.npcmonsters_lootgroups.findFirst({
        where: { npc_monster_id: kakku.id, loot_group_id: kakkuLootGroup.id }
      });
      if (existingKakkuLootLink) {
        await tx.npcmonsters_lootgroups.update({
          where: { id: existingKakkuLootLink.id },
          data: { deleted: false }
        });
      } else {
        await tx.npcmonsters_lootgroups.create({
          data: { npc_monster_id: kakku.id, loot_group_id: kakkuLootGroup.id, deleted: false }
        });
      }

      const honeywood = await tx.locations.findFirst({
        where: { name: 'Honeywood Village', deleted: false }
      });
      if (!honeywood) throw new Error('Honeywood Village not found.');

      const churchillEstate = await tx.sublocations.findFirst({
        where: { location_id: honeywood.id, name: "Churchill's estate", deleted: false }
      });
      if (!churchillEstate) throw new Error("Sublocation Churchill's estate not found.");

      const churchillCharData = {
        name: 'Lord Churchill',
        character_type: 'NPC',
        level: 10,
        race: 'Human',
        age: 51,
        job: 'Village Noble',
        sex: 'MALE',
        alignment: 'Lawful Evil',
        appearance: 'A fifty-one-year-old nobleman with silver-streaked dark hair, cold calculating grey eyes, and a neatly trimmed aristocratic beard. He wears a velvet-lined burgundy coat embroidered with gold thread, heavy signet rings gleaming on his fingers, and carries a silver-headed cane with the poised authority of old wealth.',
        description: 'Lord Churchill is the long-standing patriarch of the noble Churchill family in Honeywood Village. Controlling lucrative estates, land leases, and private loans across the settlement, he masks his ruthless greed and predatory ambitions behind the polished courtesy of a refined village lord.',
        location_id: honeywood.id,
        sublocation_id: churchillEstate.id,
        respawn_location_id: honeywood.id,
        deleted: false
      };

      let churchill = await tx.characters.findFirst({
        where: { name: 'Lord Churchill', character_type: 'NPC' }
      });
      churchill = churchill
        ? await tx.characters.update({ where: { id: churchill.id }, data: churchillCharData })
        : await tx.characters.create({ data: churchillCharData });

      await tx.sublocations.update({
        where: { id: churchillEstate.id },
        data: { owner_id: churchill.id }
      });

      const churchillStats = {
        proficiency: 4,
        intelligent: 22,
        strength: 10,
        dexterity: 12,
        charisma: 26,
        constitution: 16,
        wisdom: 20,
        armor: 14,
        magic_armor: 18,
        max_hp: 260,
        current_hp: 260,
        max_energy: 120,
        current_energy: 120,
        max_food: 100,
        current_food: 100,
        max_water: 100,
        current_water: 100,
        fire_element_resistant: 10,
        ice_element_resistant: 10,
        earth_element_resistant: 10,
        lightning_element_resistant: 10,
        wind_element_resistant: 10,
        holy_element_resistant: 5,
        dark_element_resistant: 15,
        status_resistant: 20,
        accuracy: 1,
        base_crit_chance: 0,
        base_crit_damage: 0,
        deleted: false
      };

      await tx.character_stats.upsert({
        where: { character_id: churchill.id },
        create: { character_id: churchill.id, ...churchillStats },
        update: churchillStats
      });

      await tx.npcs.upsert({
        where: { character_id: churchill.id },
        create: {
          character_id: churchill.id,
          is_attackable: false,
          is_speakable: true,
          is_recruitable: false,
          deleted: false
        },
        update: {
          is_attackable: false,
          is_speakable: true,
          is_recruitable: false,
          deleted: false
        }
      });

      const churchillInv = await tx.character_inventory.findFirst({
        where: { character_id: churchill.id }
      });
      if (!churchillInv) {
        await tx.character_inventory.create({
          data: { character_id: churchill.id, max_slots: 40, deleted: false }
        });
      }

      await tx.npcs_in_locations_or_sublocations.updateMany({
        where: { npc_id: churchill.id },
        data: { deleted: true }
      });
      await tx.npcs_in_locations_or_sublocations.upsert({
        where: { npc_id_sublocation_id: { npc_id: churchill.id, sublocation_id: churchillEstate.id } },
        create: { npc_id: churchill.id, location_id: null, sublocation_id: churchillEstate.id, deleted: false },
        update: { location_id: null, deleted: false }
      });

      const mai = await tx.characters.findFirst({ where: { name: 'Mai Shiranui', character_type: 'NPC', deleted: false } });
      const rolus = await tx.characters.findFirst({ where: { name: 'Rolus', character_type: 'NPC', deleted: false } });
      const guaz = await tx.characters.findFirst({ where: { name: 'Guaz', character_type: 'NPC', deleted: false } });
      const zanla = await tx.characters.findFirst({ where: { name: 'Zanla Lehey', character_type: 'NPC', deleted: false } });
      const hina = await tx.characters.findFirst({ where: { name: 'Hina Zunko', character_type: 'NPC', deleted: false } });

      if (!mai || !rolus || !guaz || !zanla) {
        throw new Error('Required Honeywood NPCs (Mai Shiranui, Rolus, Guaz, Zanla Lehey) not found.');
      }

      const upsertNpcRelation = async (sourceId, targetId, relationshipType, isNsfw, contextNote) => {
        await tx.npc_relationships.upsert({
          where: { source_npc_id_target_npc_id: { source_npc_id: sourceId, target_npc_id: targetId } },
          create: {
            source_npc_id: sourceId,
            target_npc_id: targetId,
            relationship_type: relationshipType,
            is_nsfw: isNsfw,
            context_note: contextNote,
            deleted: false
          },
          update: {
            relationship_type: relationshipType,
            is_nsfw: isNsfw,
            context_note: contextNote,
            deleted: false
          }
        });
      };

      await upsertNpcRelation(
        churchill.id,
        mai.id,
        'BUSINESS_PARTNER',
        true,
        'Mai Shiranui borrowed a large sum of gold from me to repair the Shiranui Dojo. Outwardly I act as her creditor and business partner, but I am quietly sabotaging her ways of earning money in Honeywood so she defaults on her debt and is forced to become my personal servant.'
      );
      await upsertNpcRelation(
        mai.id,
        churchill.id,
        'BUSINESS_PARTNER',
        true,
        'I borrowed money from Lord Churchill to repair my dojo. His lecherous schemes disgust me, and I just want to earn enough gold to pay off all the debt I owe him.'
      );

      await upsertNpcRelation(
        churchill.id,
        rolus.id,
        'FRIEND',
        false,
        'Rolus is a man of refined ambition who understands how power works. As Guild Manager, he is a trusted friend in Honeywood.'
      );
      await upsertNpcRelation(
        rolus.id,
        churchill.id,
        'FRIEND',
        false,
        'Lord Churchill is a long-standing noble of Honeywood and a close friend. We respect each other’s private ambitions.'
      );

      await upsertNpcRelation(
        churchill.id,
        guaz.id,
        'FRIEND',
        false,
        'Captain Guaz keeps order at the village gates and respects the authority of the Churchill estate.'
      );
      await upsertNpcRelation(
        guaz.id,
        churchill.id,
        'FRIEND',
        false,
        'Lord Churchill is a respected village noble who has long supported the Honeywood guard.'
      );

      await upsertNpcRelation(
        churchill.id,
        zanla.id,
        'ACQUAINTANCE',
        false,
        'Zanla Lehey runs the local inn in Honeywood Village. I know of her as a local resident, though I rarely visit common taverns.'
      );
      await upsertNpcRelation(
        zanla.id,
        churchill.id,
        'ACQUAINTANCE',
        false,
        'Lord Churchill is the wealthy village noble from Churchill’s estate. Everyone in Honeywood knows him, though he makes me uneasy when Mai talks about her dojo debt.'
      );

      if (hina) {
        await upsertNpcRelation(
          churchill.id,
          hina.id,
          'ACQUAINTANCE',
          false,
          'Hina Zunko is the Guild Registrar who handles Mai Shiranui’s posted commissions at the Guild Office.'
        );
      }

      const dojo = await tx.sublocations.findFirst({ where: { location_id: honeywood.id, name: "Shiranui's Dojo", deleted: false } });
      const inn = await tx.sublocations.findFirst({ where: { location_id: honeywood.id, name: "Honey Zanla's Inn", deleted: false } });
      const guildOffice = await tx.sublocations.findFirst({ where: { location_id: honeywood.id, name: 'Guild Office', deleted: false } });

      await tx.npc_known_locations.deleteMany({ where: { character_id: churchill.id } });
      const churchillKnownPlaces = [
        { sublocation_id: churchillEstate.id, location_knowledge_type: 'LOCAL_LANDMARK', location_semantic_memory: 'My family seat and private manor in Honeywood Village.' },
        ...(dojo ? [{ sublocation_id: dojo.id, location_knowledge_type: 'LOCAL_LANDMARK', location_semantic_memory: 'The Shiranui Dojo is indebted to my estate; once Mai Shiranui fails to repay her loan, both the dojo and its master will be mine.' }] : []),
        ...(inn ? [{ sublocation_id: inn.id, location_knowledge_type: 'LOCAL_LANDMARK', location_semantic_memory: "Zanla Lehey's local inn in Honeywood Village." }] : []),
        ...(guildOffice ? [{ sublocation_id: guildOffice.id, location_knowledge_type: 'LOCAL_LANDMARK', location_semantic_memory: 'The Honeywood Guild Office managed by my friend Rolus.' }] : [])
      ];
      for (const place of churchillKnownPlaces) {
        await tx.npc_known_locations.create({
          data: {
            character_id: churchill.id,
            location_id: honeywood.id,
            sublocation_id: place.sublocation_id,
            location_knowledge_type: place.location_knowledge_type,
            location_semantic_memory: place.location_semantic_memory,
            deleted: false
          }
        });
      }

      const existingMaiKnownEstate = await tx.npc_known_locations.findFirst({
        where: { character_id: mai.id, location_id: honeywood.id, sublocation_id: churchillEstate.id, deleted: false }
      });
      if (!existingMaiKnownEstate) {
        await tx.npc_known_locations.create({
          data: {
            character_id: mai.id,
            location_id: honeywood.id,
            sublocation_id: churchillEstate.id,
            location_knowledge_type: 'LOCAL_LANDMARK',
            location_semantic_memory: "Lord Churchill's manor, where I was forced to sign the loan contract to repair the Shiranui Dojo.",
            deleted: false
          }
        });
      }

      await tx.character_memories.deleteMany({
        where: { character_id: churchill.id }
      });

      await tx.character_memories.create({
        data: {
          character_id: churchill.id,
          target_character_id: null,
          memory_type: 'SECRET',
          content: 'I am looking for a way to hold Mai Shiranui captive through her debt and make her my personal servant. I quietly use my influence in Honeywood to put Mai Shiranui at a disadvantage in earning money so she can never pay back what she owes me.',
          is_secret: true,
          is_nsfw: true,
          add_from: 'AI_SUMMARIZE',
          deleted: false
        }
      });

      await tx.character_memories.create({
        data: {
          character_id: churchill.id,
          target_character_id: null,
          memory_type: 'EPISODIC',
          content: 'As the long-standing noble of Honeywood Village, I lent Mai Shiranui the gold she needed to repair the Shiranui Dojo under strict repayment terms.',
          is_secret: false,
          is_nsfw: false,
          add_from: 'AI_SUMMARIZE',
          deleted: false
        }
      });

      const maiExistingMemory = await tx.character_memories.findFirst({
        where: {
          character_id: mai.id,
          memory_type: 'EPISODIC',
          content: { contains: 'Churchill' },
          deleted: false
        }
      });

      const maiMemoryContent = 'Disgusting Lord Churchill—I borrowed money from him only to repair the Shiranui Dojo, and now I just want to find a way to earn enough gold and pay off all my debt to him.';

      if (maiExistingMemory) {
        await tx.character_memories.update({
          where: { id: maiExistingMemory.id },
          data: {
            target_character_id: null,
            memory_type: 'EPISODIC',
            content: maiMemoryContent,
            is_secret: false,
            is_nsfw: false,
            deleted: false
          }
        });
      } else {
        await tx.character_memories.create({
          data: {
            character_id: mai.id,
            target_character_id: null,
            memory_type: 'EPISODIC',
            content: maiMemoryContent,
            is_secret: false,
            is_nsfw: false,
            add_from: 'AI_SUMMARIZE',
            deleted: false
          }
        });
      }

      return {
        normalBossSets: savedNormalItems.map((i) => ({ id: i.id, name: i.name, type: i.type, rarity: i.rarity, max_upgrade_level: i.max_upgrade_level })),
        kakkuRareItems: [...savedKakkuItems.values()].map((i) => ({ id: i.id, name: i.name, type: i.type, rarity: i.rarity, max_upgrade_level: i.max_upgrade_level })),
        kakkuId: kakku.id,
        churchillId: churchill.id,
        maiId: mai.id
      };
    }, { timeout: 30000 });
  } catch (error) {
    throw databaseError('addKakkuSetsAndChurchill', 'seed Kakku sets and Lord Churchill', error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  addKakkuSetsAndChurchill()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
