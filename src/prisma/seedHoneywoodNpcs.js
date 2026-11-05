import { pathToFileURL } from 'node:url';
import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { addHoneywoodQuests } from './updates/addHoneywoodQuests.js';
import { updateHinaZunko } from './updates/updateHinaZunko.js';
import { updateMaiShiranui } from './updates/updateMaiShiranui.js';
import { addWoodenWeaponsToHoneywoodInn } from './updates/addWoodenWeaponsToHoneywoodInn.js';

export async function seedHoneywoodNpcs(client = prisma) {
  try {
    return await client.$transaction(async (tx) => {
      // 1. Locate Honeywood Village
      const honeywood = await tx.locations.findFirst({
        where: { name: 'Honeywood Village', deleted: false }
      });
      if (!honeywood) throw new Error('Honeywood Village not found.');

      // 2. Ensure sublocations: Honey Zanla's Inn & Shiranui's Dojo
      let inn = await tx.sublocations.findFirst({
        where: { location_id: honeywood.id, name: "Honey Zanla's Inn", deleted: false }
      });
      if (!inn) {
        inn = await tx.sublocations.create({
          data: {
            location: { connect: { id: honeywood.id } },
            name: "Honey Zanla's Inn",
            description: 'Quite Cozy and cheap Inn. Belongs to Zanla.',
            sublocation_type: 'INN'
          }
        });
      }

      let dojo = await tx.sublocations.findFirst({
        where: { location_id: honeywood.id, name: "Shiranui's Dojo", deleted: false }
      });
      if (!dojo) {
        dojo = await tx.sublocations.create({
          data: {
            location: { connect: { id: honeywood.id } },
            name: "Shiranui's Dojo",
            description: 'A traditional martial arts dojo in Honeywood Village, where disciples train in agility and flame-arts under 16th Grandmaster Mai Shiranui.',
            sublocation_type: 'DEFAULT'
          }
        });
      }
      await tx.sublocations.update({ where: { id: dojo.id }, data: { sublocation_type: 'DEFAULT' } });

      let guildOffice = await tx.sublocations.findFirst({
        where: { location_id: honeywood.id, name: 'Guild Office', deleted: false }
      });
      if (!guildOffice) {
        guildOffice = await tx.sublocations.create({
          data: {
            location: { connect: { id: honeywood.id } },
            name: 'Guild Office',
            description: 'The local adventurers guild posts contracts and keeps records of completed work.',
            sublocation_type: 'GUILD_OFFICE'
          }
        });
      }

      // 3. Ensure custom martial skills for Mai Shiranui
      const newSkillsToSeed = [
        {
          name: 'High Kick',
          type: 'ATTACK',
          skill_damage_type: 'PHYSICAL',
          skill_target_rule: 'ON_SELECTED_ENEMY',
          attack_amplifier: 1.15,
          magical_attack_amplifier: 0,
          energy_consume_cost: 3,
          rarity: 'NORMAL'
        },
        {
          name: 'Flame Knife',
          type: 'ATTACK',
          skill_damage_type: 'PHYSICAL',
          skill_target_rule: 'ON_SELECTED_ENEMY',
          attack_amplifier: 1.4,
          magical_attack_amplifier: 0,
          energy_consume_cost: 5,
          rarity: 'UNCOMMON'
        },
        {
          name: 'Flame Charge',
          type: 'MAGIC_ATTACK',
          skill_damage_type: 'MAGICAL',
          skill_target_rule: 'ON_SELECTED_ENEMY',
          attack_amplifier: 0,
          magical_attack_amplifier: 1.4,
          fire_damage: 22,
          energy_consume_cost: 10,
          rarity: 'RARE'
        },
        {
          name: 'Quick Thrust',
          type: 'ATTACK',
          skill_damage_type: 'PHYSICAL',
          skill_target_rule: 'ON_SELECTED_ENEMY',
          attack_amplifier: 1.2,
          magical_attack_amplifier: 0,
          energy_consume_cost: 4,
          rarity: 'NORMAL'
        },
        {
          name: 'Swipe',
          type: 'ATTACK',
          skill_damage_type: 'PHYSICAL',
          skill_target_rule: 'ALL_ENEMIES',
          attack_amplifier: 0.85,
          magical_attack_amplifier: 0,
          energy_consume_cost: 6,
          rarity: 'NORMAL'
        }
      ];

      for (const s of newSkillsToSeed) {
        const existing = await tx.skills.findFirst({ where: { name: s.name } });
        if (existing) {
          await tx.skills.update({ where: { id: existing.id }, data: { ...s, deleted: false } });
        } else {
          await tx.skills.create({ data: s });
        }
      }

      // 4. Cache Items, Skills, Lifeskills
      const items = await tx.items.findMany({ where: { deleted: false } });
      const itemByName = new Map(items.map((i) => [i.name, i.id]));

      const skills = await tx.skills.findMany({ where: { deleted: false } });
      const skillByName = new Map(skills.map((s) => [s.name, s.id]));

      // Ensure spear items are bound to spear skills
      const spearItemNames = ['Wooden Spear', 'Iron Spear', 'Steel Spear'];
      const spearSkillNames = ['Basic Strike', 'Quick Thrust', 'Swipe'];
      for (const itemName of spearItemNames) {
        const itemId = itemByName.get(itemName);
        if (itemId) {
          for (const skillName of spearSkillNames) {
            const skillId = skillByName.get(skillName);
            if (skillId) {
              await tx.skills_in_items.upsert({
                where: { item_id_skill_id: { item_id: itemId, skill_id: skillId } },
                create: { item_id: itemId, skill_id: skillId },
                update: { deleted: false }
              });
            }
          }
        }
      }

      const lifeskills = await tx.lifeskills.findMany();
      const lifeskillByName = new Map(lifeskills.map((ls) => [ls.name, ls.id]));

      // 4. Define NPC Profiles
      const npcConfigs = [
        {
          character: {
            name: 'Zanla Lehey',
            character_type: 'NPC',
            level: 3,
            race: 'Human',
            age: 24,
            job: 'Innkeeper',
            sex: 'FEMALE',
            alignment: 'NEUTRAL_GOOD',
            appearance: 'A radiant young woman with warm amber eyes, rosy cheeks, and honey-gold hair tied loosely in a red ribbon. She wears a crisp linen blouse, a practical brown corset apron dusted with flour, and an inviting, cheerful smile that immediately eases weary travelers.',
            description: "Zanla Lehey is the beloved proprietor and heart of Honey Zanla's Inn in Honeywood Village. Inheriting the cozy establishment from her family at a young age, she turned it into a sanctuary for fatigued adventurers and wandering merchants alike. Known for her hearty stew, warm hearth, and uncanny ability to listen to troubled souls, Zanla manages the tavern with gentleness and grace. Though she prefers hospitality over bloodshed, she is deft with her wooden kitchen knife and won't hesitate to give rowdy drunks a swift lesson in tavern etiquette."
          },
          relations: {
            location: { connect: { id: honeywood.id } },
            sublocation: { connect: { id: inn.id } },
            respawn_location: { connect: { id: honeywood.id } }
          },
          stats: {
            proficiency: 2,
            strength: 7,
            dexterity: 9,
            constitution: 8,
            intelligent: 8,
            wisdom: 9,
            charisma: 12,
            armor: 5,
            magic_armor: 4,
            max_hp: 45,
            current_hp: 45,
            max_energy: 100,
            current_energy: 100,
            fire_element_resistant: 5,
            ice_element_resistant: 5,
            earth_element_resistant: 5,
            lightning_element_resistant: 5,
            wind_element_resistant: 5,
            holy_element_resistant: 3,
            dark_element_resistant: 3,
            status_resistant: 4
          },
          equipment: {
            right_hand: 'Wooden Knife'
          },
          inventoryItems: [
            { name: 'Wooden Knife', quantity: 1, current_level_upgraded: 0, is_equipped: true }
          ],
          skills: ['Basic Strike', 'Strike'],
          lifeskills: [
            { name: 'Cooking', level: 3 },
            { name: 'Gathering', level: 2 }
          ],
          appearanceRule: {
            location_id: null,
            sublocation_id: inn.id
          }
        },
        {
          character: {
            name: 'Mai Shiranui',
            character_type: 'NPC',
            level: 8,
            race: 'Human',
            age: 26,
            job: 'Dojo Master',
            sex: 'FEMALE',
            alignment: 'CHAOTIC_GOOD',
            appearance: 'A stunning martial artist in peak physical condition, boasting an alluring athletic physique and graceful poise. Her chestnut hair is gathered into a sweeping high ponytail bound with white ribbon. She wears a vibrant crimson-and-white sleeveless ninja tunic that allows complete freedom of movement, accentuated by ornate floral sashes, fingerless wraps, and an iron knife balanced effortlessly at her hip.',
            description: "Mai Shiranui is the formidable 16th-generation Grandmaster of the Shiranui Dojo in Honeywood Village. Heir to the ancient Shiranui style of ninjutsu and flame-infused martial arts, she upholds her ancestors' legacy with fierce pride, unyielding discipline, and a warm, protective heart for the villagers. Beneath her glamorous appearance and lively charm lies an extraordinarily lethal combatant whose acrobatic knife techniques and blazing strikes can dismantle hostile beasts and outlaws in the blink of an eye. She now trains aspiring adventurers and guards the tranquility of Honeywood."
          },
          relations: {
            location: { connect: { id: honeywood.id } },
            sublocation: { connect: { id: dojo.id } },
            respawn_location: { connect: { id: honeywood.id } }
          },
          stats: {
            proficiency: 4,
            strength: 22,
            dexterity: 24,
            constitution: 20,
            intelligent: 16,
            wisdom: 15,
            charisma: 18,
            armor: 20,
            magic_armor: 14,
            max_hp: 280,
            current_hp: 280,
            max_energy: 140,
            current_energy: 140,
            fire_element_resistant: 50,
            ice_element_resistant: -25,
            earth_element_resistant: -10,
            lightning_element_resistant: 10,
            wind_element_resistant: 15,
            holy_element_resistant: 10,
            dark_element_resistant: 10,
            status_resistant: 15
          },
          equipment: {
            right_hand: 'Iron Knife',
            helmet: 'Feather Cap',
            armor: 'Feather Armor',
            gloves: 'Feather Gloves',
            shoes: 'Feather Boots'
          },
          inventoryItems: [
            { name: 'Iron Knife', quantity: 1, current_level_upgraded: 2, is_equipped: true },
            { name: 'Feather Cap', quantity: 1, current_level_upgraded: 2, is_equipped: true },
            { name: 'Feather Armor', quantity: 1, current_level_upgraded: 2, is_equipped: true },
            { name: 'Feather Gloves', quantity: 1, current_level_upgraded: 2, is_equipped: true },
            { name: 'Feather Boots', quantity: 1, current_level_upgraded: 2, is_equipped: true }
          ],
          skills: [
            'Chou Hissatsu Shinobi-Bachi',
            'Dragon Flame Dance',
            'Fire shield',
            'High Kick',
            'Flame Knife',
            'Punch Strike',
            'Defend'
          ],
          lifeskills: [],
          appearanceRule: {
            location_id: null,
            sublocation_id: dojo.id
          },
          is_recruitable: true
        },
        {
          character: {
            name: "Honeywood's Guard",
            character_type: 'NPC',
            level: 10,
            race: 'Human',
            age: 35,
            job: 'Guard Captain',
            sex: 'MALE',
            alignment: 'LAWFUL_NEUTRAL',
            appearance: 'An imposing Honeywood sentinel standing at over six feet, clad head-to-toe in mirror-polished masterwork steel plate armor emblazoned with the crest of Honeywood Village. Wielding an ornate, finely tempered Steel Spear with a battle-hardened grip, their vigilant visor conceals steely eyes that never miss a single disturbance along the village paths.',
            description: 'The veteran commander of the Honeywood Village Guard, entrusted by the elders to safeguard the peaceful settlement against wilderness beasts, marauding bandits, and disorderly adventurers. Armed with a max-grade steel spear and impenetrable tempered plate armor, the Honeywood Guard represents the ultimate line of defense. Anyone foolish enough to start trouble or draw steel within the village borders will quickly discover why peace is so strictly kept in Honeywood.'
          },
          relations: {
            location: { connect: { id: honeywood.id } },
            sublocation: undefined,
            respawn_location: { connect: { id: honeywood.id } }
          },
          stats: {
            proficiency: 4,
            strength: 26,
            dexterity: 20,
            constitution: 24,
            intelligent: 12,
            wisdom: 14,
            charisma: 12,
            armor: 30,
            magic_armor: 16,
            max_hp: 380,
            current_hp: 380,
            max_energy: 120,
            current_energy: 120,
            fire_element_resistant: 10,
            ice_element_resistant: 10,
            earth_element_resistant: 10,
            lightning_element_resistant: 10,
            wind_element_resistant: 10,
            holy_element_resistant: 6,
            dark_element_resistant: 6,
            status_resistant: 12
          },
          equipment: {
            left_hand: 'Steel Spear',
            helmet: 'Steel Helm',
            armor: 'Steel Plate Armor',
            gloves: 'Steel Gauntlets',
            shoes: 'Steel Greaves'
          },
          inventoryItems: [
            { name: 'Steel Spear', quantity: 1, current_level_upgraded: 4, is_equipped: true },
            { name: 'Steel Helm', quantity: 1, current_level_upgraded: 4, is_equipped: true },
            { name: 'Steel Plate Armor', quantity: 1, current_level_upgraded: 4, is_equipped: true },
            { name: 'Steel Gauntlets', quantity: 1, current_level_upgraded: 4, is_equipped: true },
            { name: 'Steel Greaves', quantity: 1, current_level_upgraded: 4, is_equipped: true }
          ],
          skills: ['Basic Strike', 'Strike', 'Heavy Strike', 'Defend', 'Bash', 'Quick Thrust', 'Swipe'],
          lifeskills: [],
          appearanceRule: {
            location_id: honeywood.id,
            sublocation_id: null
          }
        }
      ];

      const createdNpcs = [];

      // 5. Upsert each NPC
      for (const config of npcConfigs) {
        let character = await tx.characters.findFirst({
          where: { name: config.character.name, character_type: 'NPC', deleted: false }
        });

        const relationData = {};
        if (config.relations.location) relationData.location = config.relations.location;
        if (config.relations.sublocation) {
          relationData.sublocation = config.relations.sublocation;
        } else if (character) {
          relationData.sublocation = { disconnect: true };
        }
        if (config.relations.respawn_location) relationData.respawn_location = config.relations.respawn_location;

        if (character) {
          character = await tx.characters.update({
            where: { id: character.id },
            data: {
              ...config.character,
              ...relationData
            }
          });
        } else {
          character = await tx.characters.create({
            data: {
              ...config.character,
              ...relationData
            }
          });
        }

        // Upsert character_stats
        await tx.character_stats.upsert({
          where: { character_id: character.id },
          create: { character_id: character.id, ...config.stats },
          update: { ...config.stats, deleted: false }
        });

        // Upsert npcs record
        await tx.npcs.upsert({
          where: { character_id: character.id },
          create: {
            character_id: character.id,
            is_attackable: true,
            is_speakable: true,
            is_recruitable: Boolean(config.is_recruitable)
          },
          update: {
            is_attackable: true,
            is_speakable: true,
            is_recruitable: Boolean(config.is_recruitable),
            deleted: false
          }
        });

        // Upsert character_inventory metadata
        let inventory = await tx.character_inventory.findFirst({
          where: { character_id: character.id }
        });
        if (!inventory) {
          inventory = await tx.character_inventory.create({
            data: { character_id: character.id, max_slots: 40 }
          });
        }

        // Clear existing character_items to avoid duplicate stacks
        await tx.character_items.deleteMany({
          where: { character_id: character.id }
        });

        const slotMap = {
          helmet: 'HELMET',
          armor: 'ARMOR',
          gloves: 'GLOVES',
          shoes: 'SHOES',
          left_hand: 'LEFT_HAND',
          right_hand: 'RIGHT_HAND',
          left_earring: 'LEFT_EARRING',
          right_earring: 'RIGHT_EARRING',
          left_ring: 'LEFT_RING',
          right_ring: 'RIGHT_RING',
          necklace: 'NECKLACE',
          belt: 'BELT'
        };

        const equippedItemNames = new Set();
        for (const [slot, itemName] of Object.entries(config.equipment || {})) {
          if (!itemName) continue;
          const itemId = itemByName.get(itemName);
          if (!itemId) continue;
          equippedItemNames.add(itemName);

          const invMatch = (config.inventoryItems || []).find((item) => item.name === itemName && item.is_equipped);
          const upgradeLevel = invMatch ? (invMatch.current_level_upgraded || 0) : 0;
          const equipSlot = slotMap[slot.toLowerCase()] || slot.toUpperCase();

          await tx.character_items.create({
            data: {
              character_id: character.id,
              item_id: itemId,
              location: 'EQUIPPED',
              equip_slot: equipSlot,
              quantity: 1,
              current_level_upgraded: upgradeLevel
            }
          });
        }

        for (const itemEntry of config.inventoryItems || []) {
          if (itemEntry.is_equipped && equippedItemNames.has(itemEntry.name)) {
            continue;
          }
          const itemId = itemByName.get(itemEntry.name);
          if (itemId) {
            await tx.character_items.create({
              data: {
                character_id: character.id,
                item_id: itemId,
                location: 'BACKPACK',
                quantity: itemEntry.quantity || 1,
                current_level_upgraded: itemEntry.current_level_upgraded || 0
              }
            });
          }
        }

        // Bind skills
        await tx.character_skills.deleteMany({
          where: { character_id: character.id }
        });
        for (const skillName of config.skills) {
          const skillId = skillByName.get(skillName);
          if (skillId) {
            await tx.character_skills.create({
              data: { character_id: character.id, skill_id: skillId }
            });
          }
        }

        // Bind lifeskills
        await tx.character_lifeskills.deleteMany({
          where: { character_id: character.id }
        });
        for (const ls of config.lifeskills) {
          const lsId = lifeskillByName.get(ls.name);
          if (lsId) {
            await tx.character_lifeskills.create({
              data: { character_id: character.id, lifeskill_id: lsId, current_level: ls.level, current_exp: 0 }
            });
          }
        }

        // Setup npcs_in_locations_or_sublocations
        await tx.npcs_in_locations_or_sublocations.deleteMany({
          where: { npc_id: character.id }
        });
        await tx.npcs_in_locations_or_sublocations.create({
          data: {
            npc_id: character.id,
            location_id: config.appearanceRule.location_id,
            sublocation_id: config.appearanceRule.sublocation_id,
            deleted: false
          }
        });

        createdNpcs.push({
          id: character.id,
          name: character.name,
          level: character.level,
          job: character.job,
          location: config.appearanceRule.sublocation_id ? (config.appearanceRule.sublocation_id === inn.id ? "Honey Zanla's Inn" : "Shiranui's Dojo") : 'Honeywood Village'
        });
      }

      const guildRegistrarData = {
        name: 'Guild Registrar',
        character_type: 'NPC',
        level: 1,
        race: 'Human',
        age: 42,
        job: 'Guild Registrar',
        sex: 'OTHER',
        alignment: 'LAWFUL_NEUTRAL',
        appearance: 'A patient registrar in a dark green guild coat, seated behind a broad oak counter stacked with ledgers and sealed contracts.',
        description: 'The Guild Registrar manages local adventurer contracts and records each completed commission.',
        location_id: honeywood.id,
        sublocation_id: guildOffice.id,
        deleted: false
      };
      let guildRegistrar = await tx.characters.findFirst({
        where: { name: guildRegistrarData.name, character_type: 'NPC', deleted: false }
      });
      guildRegistrar = guildRegistrar
        ? await tx.characters.update({ where: { id: guildRegistrar.id }, data: guildRegistrarData })
        : await tx.characters.create({ data: guildRegistrarData });

      await tx.character_stats.upsert({
        where: { character_id: guildRegistrar.id },
        create: { character_id: guildRegistrar.id },
        update: { deleted: false }
      });
      await tx.npcs.upsert({
        where: { character_id: guildRegistrar.id },
        create: { character_id: guildRegistrar.id, is_attackable: false, is_speakable: true, is_recruitable: false },
        update: { is_attackable: false, is_speakable: true, is_recruitable: false, deleted: false }
      });
      await tx.npcs_in_locations_or_sublocations.upsert({
        where: { npc_id_sublocation_id: { npc_id: guildRegistrar.id, sublocation_id: guildOffice.id } },
        create: { npc_id: guildRegistrar.id, sublocation_id: guildOffice.id, deleted: false },
        update: { location_id: null, deleted: false }
      });

      await addHoneywoodQuests(tx);
      await updateHinaZunko(tx);
      await updateMaiShiranui(tx);
      await addWoodenWeaponsToHoneywoodInn(tx);

      return {
        success: true,
        sublocations: ["Honey Zanla's Inn", "Shiranui's Dojo", 'Guild Office'],
        npcs: [...createdNpcs, { id: guildRegistrar.id, name: guildRegistrar.name, level: guildRegistrar.level, job: guildRegistrar.job, location: 'Guild Office' }]
      };
    }, { timeout: 30000 });
  } catch (error) {
    throw databaseError('seedHoneywoodNpcs', 'seed Honeywood NPCs', error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedHoneywoodNpcs()
    .then((result) => console.log('Seeded successfully:', JSON.stringify(result, null, 2)))
    .catch((error) => { console.error('Failed to seed Honeywood NPCs:', error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
