import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { getHungerState, getThirstState, hungerEffects, thirstEffects } from '../containers/effectContainer.js';

let cachedHungerDefinitions = null;
let cachedThirstDefinitions = null;

export async function getHungerEffectDefinitions(tx) {
  if (cachedHungerDefinitions && cachedHungerDefinitions.length >= hungerEffects.length) return cachedHungerDefinitions;
  const client = tx || prisma;
  const definitions = await client.effects.findMany({
    where: { effect_type: { in: hungerEffects.map((effect) => effect.effect_type) } },
    orderBy: { id: 'asc' }
  });
  if (definitions.length) cachedHungerDefinitions = definitions;
  return definitions;
}

export async function seedHungerEffects(tx) {
  cachedHungerDefinitions = null;
  const records = [];
  for (const { name, effect_type, description } of hungerEffects) {
    const existing = await tx.effects.findFirst({ where: { name }, orderBy: { id: 'asc' } });
    const data = { name, effect_type, description, deleted: false };
    records.push(existing ? await tx.effects.update({ where: { id: existing.id }, data }) : await tx.effects.create({ data }));
  }
  cachedHungerDefinitions = null;
  return records;
}

export async function syncHungerEffects(tx, characterId, stats) {
  const definitions = await getHungerEffectDefinitions(tx);
  const hunger = getHungerState(stats);
  const active = hunger && definitions.find((effect) => !effect.deleted && effect.name === hunger.name);
  if (hunger && !active) throw new Error('Hunger effect definitions are missing.');

  const definitionIds = definitions.map((effect) => effect.id);
  const currentEffects = await tx.character_effects.findMany({
    where: { character_id: characterId, effect_id: { in: definitionIds }, deleted: false }
  });
  const activeEffectId = active ? active.id : null;
  const currentActive = currentEffects.find((effect) => effect.effect_id === activeEffectId);
  const extraneousEffects = currentEffects.filter((effect) => effect.effect_id !== activeEffectId);

  if (extraneousEffects.length === 0 && ((!active && currentEffects.length === 0) || (active && currentActive))) return hunger;
  if (extraneousEffects.length > 0) {
    await tx.character_effects.updateMany({
      where: { character_id: characterId, effect_id: { in: extraneousEffects.map((effect) => effect.effect_id) }, deleted: false },
      data: { deleted: true }
    });
  }
  if (active && !currentActive) {
    await tx.character_effects.upsert({
      where: { effect_id_character_id: { effect_id: active.id, character_id: characterId } },
      create: { effect_id: active.id, character_id: characterId, duration_turn: 0, deleted: false },
      update: { duration_turn: 0, deleted: false }
    });
  }
  return hunger;
}

export async function refreshCharacterEffects(userId) {
  try {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.characters.findUnique({ where: { user_id: userId }, include: { character_stat: true } });
      if (!character || character.deleted || !character.character_stat) return null;
      await syncHungerEffects(tx, character.id, character.character_stat);
      await syncThirstEffects(tx, character.id, character.character_stat);
      return character.character_stat;
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    throw databaseError('refreshCharacterEffects', 'refresh hunger and thirst effects', error);
  }
}

export async function getThirstEffectDefinitions(tx) {
  if (cachedThirstDefinitions && cachedThirstDefinitions.length >= thirstEffects.length) return cachedThirstDefinitions;
  const client = tx || prisma;
  const definitions = await client.effects.findMany({
    where: { effect_type: { in: thirstEffects.map((effect) => effect.effect_type) } },
    orderBy: { id: 'asc' }
  });
  if (definitions.length) cachedThirstDefinitions = definitions;
  return definitions;
}

export async function seedThirstEffects(tx) {
  cachedThirstDefinitions = null;
  for (const { name, effect_type, description } of thirstEffects) {
    const existing = await tx.effects.findFirst({ where: { name }, orderBy: { id: 'asc' } });
    const data = { name, effect_type, description, deleted: false };
    if (existing) await tx.effects.update({ where: { id: existing.id }, data });
    else await tx.effects.create({ data });
  }
  cachedThirstDefinitions = null;
}

export async function syncThirstEffects(tx, characterId, stats) {
  const definitions = await getThirstEffectDefinitions(tx);
  const thirst = getThirstState(stats);
  const active = thirst && definitions.find((effect) => !effect.deleted && effect.name === thirst.name);
  if (thirst && !active) throw new Error('Thirst effect definitions are missing.');

  const definitionIds = definitions.map((effect) => effect.id);
  const currentEffects = await tx.character_effects.findMany({
    where: { character_id: characterId, effect_id: { in: definitionIds }, deleted: false }
  });
  const activeEffectId = active ? active.id : null;
  const currentActive = currentEffects.find((effect) => effect.effect_id === activeEffectId);
  const extraneousEffects = currentEffects.filter((effect) => effect.effect_id !== activeEffectId);

  if (extraneousEffects.length === 0 && ((!active && currentEffects.length === 0) || (active && currentActive))) return thirst;
  if (extraneousEffects.length > 0) {
    await tx.character_effects.updateMany({
      where: { character_id: characterId, effect_id: { in: extraneousEffects.map((effect) => effect.effect_id) }, deleted: false },
      data: { deleted: true }
    });
  }
  if (active && !currentActive) {
    await tx.character_effects.upsert({
      where: { effect_id_character_id: { effect_id: active.id, character_id: characterId } },
      create: { effect_id: active.id, character_id: characterId, duration_turn: 0, deleted: false },
      update: { duration_turn: 0, deleted: false }
    });
  }
  return thirst;
}
