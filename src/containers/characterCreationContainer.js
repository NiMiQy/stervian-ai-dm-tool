import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import {
  CHARACTER_FIELD_MAX_LENGTHS,
  CHARACTER_MAX_AGE,
  CHARACTER_MIN_AGE,
  DEFAULT_BACKPACK_SLOTS,
  EQUIP_SLOT,
  ITEM_LOCATION,
  STARTER_COMBAT_SKILLS,
  STARTER_CONSUMABLES,
  STARTER_LIFESKILLS,
  STARTER_WEAPON_MAP,
  STARTING_LOCATION,
  STARTING_REGION,
  VALID_CHARACTER_SEXES,
} from '../configs/constants.js';

export function resolveStarterWeaponName(weaponKeyOrName) {
  if (typeof weaponKeyOrName !== 'string') return null;
  const normalized = weaponKeyOrName.trim();
  const upper = normalized.toUpperCase();
  if (STARTER_WEAPON_MAP[upper]) {
    return STARTER_WEAPON_MAP[upper];
  }
  const matched = Object.values(STARTER_WEAPON_MAP).find(
    (name) => name.toLowerCase() === normalized.toLowerCase()
  );
  return matched || null;
}

function validateCharacter(input) {
  for (const [field, maxLength] of Object.entries(CHARACTER_FIELD_MAX_LENGTHS)) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].trim().length > maxLength) {
      return `Please provide a ${field} of no more than ${maxLength} characters.`;
    }
  }
  const age = Number(input.age);
  if (!Number.isInteger(age) || age < CHARACTER_MIN_AGE || age > CHARACTER_MAX_AGE) {
    return `Age must be a whole number between ${CHARACTER_MIN_AGE} and ${CHARACTER_MAX_AGE}.`;
  }
  const cleanSex = String(input.sex || '').trim().toUpperCase();
  if (!VALID_CHARACTER_SEXES.includes(cleanSex)) {
    return 'Please choose a valid sex: Male, Female, or Other.';
  }
  const weapon = resolveStarterWeaponName(input.startingWeapon || input.weapon);
  if (!weapon) {
    return `Please choose 1 starting weapon: Wooden [${Object.keys(STARTER_WEAPON_MAP).join(', ')}].`;
  }
  return null;
}

async function getHoneywoodLocation(tx) {
  const existing = await tx.locations.findFirst({
    where: { name: STARTING_LOCATION.name, deleted: false }
  });
  if (existing) return existing;

  let region = await tx.regions.findFirst({ where: { name: STARTING_REGION.name, deleted: false } });
  if (!region) {
    region = await tx.regions.create({
      data: { ...STARTING_REGION }
    });
  }
  return tx.locations.create({
    data: {
      region_id: region.id,
      ...STARTING_LOCATION
    }
  });
}

async function getStarterLifeSkills(tx) {
  const existing = await tx.lifeskills.findMany({ where: { name: { in: STARTER_LIFESKILLS.map((skill) => skill.name) } } });
  const existingByName = new Map(existing.map((skill) => [skill.name, skill]));
  for (const skill of STARTER_LIFESKILLS) {
    if (!existingByName.has(skill.name)) existingByName.set(skill.name, await tx.lifeskills.create({ data: { ...skill } }));
  }
  return STARTER_LIFESKILLS.map((skill) => existingByName.get(skill.name));
}

export async function createStarterCharacter(userId, input) {
  const validationError = validateCharacter(input);
  if (validationError) return { error: validationError };

  const chosenWeaponName = resolveStarterWeaponName(input.startingWeapon || input.weapon);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.characters.findUnique({ where: { user_id: userId } });
      if (existing) return { error: 'This account already has a character.' };

      const location = await getHoneywoodLocation(tx);
      const lifeSkills = await getStarterLifeSkills(tx);

      // 1. Resolve starter weapon
      const weaponItem = await tx.items.findFirst({
        where: { name: chosenWeaponName, deleted: false }
      });
      if (!weaponItem) {
        throw new Error(`Starter weapon "${chosenWeaponName}" could not be found in database.`);
      }

      // 2. Resolve starter inventory items (weapon + consumables bundle)
      const inventoryItemData = [
        {
          item_id: weaponItem.id,
          quantity: 1,
          location: ITEM_LOCATION.EQUIPPED,
          equip_slot: EQUIP_SLOT.LEFT_HAND,
          current_level_upgraded: 0
        }
      ];

      for (const c of STARTER_CONSUMABLES) {
        const item = await tx.items.findFirst({
          where: {
            name: { in: [c.name, ...c.alternates] },
            deleted: false
          }
        });
        if (item) {
          inventoryItemData.push({
            item_id: item.id,
            quantity: c.quantity,
            location: ITEM_LOCATION.BACKPACK,
            current_level_upgraded: 0
          });
        }
      }

      // 3. Resolve combat skills (Strike, Defend + weapon skills from skills_in_items)
      const baseSkills = await tx.skills.findMany({
        where: { name: { in: [...STARTER_COMBAT_SKILLS] }, deleted: false }
      });
      const skillIdSet = new Set(baseSkills.map((s) => s.id));

      const boundSkills = await tx.skills_in_items.findMany({
        where: { item_id: weaponItem.id, deleted: false }
      });
      for (const bs of boundSkills) {
        skillIdSet.add(bs.skill_id);
      }

      const character = await tx.characters.create({
        data: {
          name: input.name.trim(),
          race: input.race.trim(),
          age: Number(input.age),
          sex: String(input.sex).trim().toUpperCase(),
          job: input.job.trim(),
          alignment: input.alignment.trim(),
          appearance: input.appearance.trim(),
          description: input.description.trim(),
          location: { connect: { id: location.id } },
          respawn_location: { connect: { id: location.id } },
          character_stat: { create: {} },
          player: { create: {} },
          character_spellpoints: { create: {} },
          character_inventory: {
            create: { max_slots: DEFAULT_BACKPACK_SLOTS }
          },
          vault: { create: {} },
          character_items: { create: inventoryItemData.map(({ item_id: itemId, ...item }) => ({ ...item, items: { connect: { id: itemId } } })) },
          story: { create: { user_id: userId, story: '' } },
          character_lifeskills: { create: lifeSkills.map((skill) => ({ lifeskill_id: skill.id })) },
          skills: skillIdSet.size > 0
            ? { create: Array.from(skillIdSet).map((id) => ({ skill_id: id })) }
            : undefined,
          user: { connect: { user_id: userId } }
        },
        select: {
          id: true,
          name: true,
          level: true,
          location: { select: { id: true, name: true } }
        }
      });

      return { character };
    });
  } catch (error) {
    throw databaseError('createStarterCharacter', 'create character', error);
  }
}
