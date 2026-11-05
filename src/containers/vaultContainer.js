import prisma from '../services/prismaClient.js';
import { getBattleForUser } from './core/battleSystemCore.js';
import { characterItemInclude, projectCharacterItems } from '../components/logics/characterItems.js';
import { databaseError } from '../database/databaseError.js';
import { filterNsfw, getNsfwAccess, nsfwItemWhere } from '../services/nsfwAccessService.js';

import { BATTLE_STATUS, DEFAULT_BACKPACK_SLOTS, DEFAULT_VAULT_SLOTS, DEFAULT_VAULT_TIER, ERROR_NAMES, HTTP_STATUS, ITEM_LOCATION, STORAGE_LOCATIONS, VALID_VAULT_TRANSFER_DIRECTIONS, VAULT_TRANSFER_DIRECTION } from '../configs/constants.js';

const integer = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
};

export class VaultAccessError extends Error {
  constructor(message) {
    super(message);
    this.name = ERROR_NAMES.VAULT_ACCESS;
    this.status = HTTP_STATUS.FORBIDDEN;
  }
}

class VaultRuleError extends Error {
  constructor(message) {
    super(message);
    this.name = ERROR_NAMES.VAULT_RULE;
    this.status = HTTP_STATUS.BAD_REQUEST;
  }
}

function quantity(value) {
  const parsed = integer(value);
  if (parsed < 1) throw new VaultRuleError('Quantity must be a positive whole number.');
  return parsed;
}

function itemMaxStack(item) {
  return item?.is_stackable ? Math.max(1, integer(item.max_stack, 1)) : 1;
}

async function accessQuery(client, userId) {
  const character = await client.characters.findUnique({
    where: { user_id: userId },
    select: {
      id: true,
      deleted: true,
      character_stat: { select: { current_hp: true } },
      location: { select: { id: true, name: true, is_safe_zone: true } }
    }
  });

  if (!character || character.deleted) throw new VaultAccessError('Character not found.');
  if (getBattleForUser(userId)?.status === BATTLE_STATUS.IN_PROGRESS) throw new VaultAccessError('The vault cannot be opened during combat.');
  if (integer(character.character_stat?.current_hp) <= 0) throw new VaultAccessError('The vault cannot be opened while defeated.');
  if (!character.location?.is_safe_zone) throw new VaultAccessError('The vault is only available in a safe zone.');
  return character;
}

export async function validateVaultAccess(userId) {
  try {
    return await accessQuery(prisma, userId);
  } catch (error) {
    if (error instanceof VaultAccessError) throw error;
    throw databaseError('validateVaultAccess', 'validate vault access', error);
  }
}

async function getVaultForCharacter(client, characterId) {
  return client.character_vaults.upsert({
    where: { character_id: characterId },
    create: { character_id: characterId, max_slots: DEFAULT_VAULT_SLOTS, tier: DEFAULT_VAULT_TIER, stored_gold: 0 },
    update: { deleted: false }
  });
}

export async function getCharacterVault(userId) {
  try {
    const character = await accessQuery(prisma, userId);
    const vault = await getVaultForCharacter(prisma, character.id);
    const nsfwAllowed = await getNsfwAccess(prisma, character.id);
    const [fullVault, inventory, allRows] = await Promise.all([
      prisma.character_vaults.findUnique({ where: { id: vault.id } }),
      prisma.character_inventory.findUnique({ where: { character_id: character.id } }),
      prisma.character_items.findMany({
        where: { character_id: character.id, deleted: false, location: { in: STORAGE_LOCATIONS } },
        include: characterItemInclude,
        orderBy: { id: 'asc' }
      })
    ]);

    const rows = filterNsfw(allRows, nsfwAllowed, (row) => row.items);
    const view = { id: character.id, character_inventory: inventory, character_items: rows, vault: fullVault };
    projectCharacterItems(view, rows);
    return { vault: view.vault, inventory: view.character_inventory, location: character.location };
  } catch (error) {
    if (error instanceof VaultAccessError) throw error;
    throw databaseError('getCharacterVault', 'read', error);
  }
}

async function transferItem(userId, itemId, requestedQuantity, direction) {
  const requested = quantity(requestedQuantity);
  const parsedItemId = integer(itemId, -1);
  if (parsedItemId < 1) throw new VaultRuleError('A valid item is required.');

  try {
    return await prisma.$transaction(async (tx) => {
      const character = await accessQuery(tx, userId);
      const nsfwAllowed = await getNsfwAccess(tx, character.id);
      const item = await tx.items.findFirst({
        where: { id: parsedItemId, deleted: false, ...nsfwItemWhere(nsfwAllowed) },
        select: { id: true, name: true, is_stackable: true, max_stack: true }
      });
      if (!item) throw new VaultRuleError('Item not found.');

      const vault = await getVaultForCharacter(tx, character.id);
      const inventory = await tx.character_inventory.findUnique({
        where: { character_id: character.id },
        select: { id: true, max_slots: true }
      });
      if (!inventory) throw new VaultRuleError('Inventory not found.');

      const isDeposit = direction === VAULT_TRANSFER_DIRECTION.DEPOSIT;
      const sourceLocation = isDeposit ? ITEM_LOCATION.BACKPACK : ITEM_LOCATION.VAULT;
      const targetLocation = isDeposit ? ITEM_LOCATION.VAULT : ITEM_LOCATION.BACKPACK;
      const sourceRows = await tx.character_items.findMany({
        where: { character_id: character.id, item_id: parsedItemId, location: sourceLocation, deleted: false },
        orderBy: { id: 'asc' },
        select: { id: true, quantity: true }
      });
      const available = sourceRows.reduce((total, row) => total + Math.max(0, integer(row.quantity, 1)), 0);
      if (available < requested) throw new VaultRuleError(`Not enough ${item.name || 'items'} available.`);

      const targetRows = await tx.character_items.findMany({
        where: { character_id: character.id, item_id: parsedItemId, location: targetLocation, deleted: false },
        orderBy: { id: 'asc' },
        select: { id: true, quantity: true }
      });
      const maxStack = itemMaxStack(item);
      const maxSlots = isDeposit ? integer(vault.max_slots, DEFAULT_VAULT_SLOTS) : integer(inventory.max_slots, DEFAULT_BACKPACK_SLOTS);
      const usedSlots = await tx.character_items.count({
        where: { character_id: character.id, location: targetLocation, deleted: false }
      });

      let remaining = requested;
      const targetUpdates = [];
      for (const row of targetRows) {
        const added = Math.min(remaining, Math.max(0, maxStack - integer(row.quantity, 1)));
        if (added) {
          targetUpdates.push({ id: row.id, added });
          remaining -= added;
        }
        if (!remaining) break;
      }

      if (Math.ceil(remaining / maxStack) > Math.max(0, maxSlots - usedSlots)) {
        throw new VaultRuleError(`${isDeposit ? 'Vault' : 'Backpack'} is full.`);
      }

      for (const update of targetUpdates) {
        await tx.character_items.update({ where: { id: update.id }, data: { quantity: { increment: update.added } } });
      }
      while (remaining) {
        const added = Math.min(remaining, maxStack);
        await tx.character_items.create({
          data: { character_id: character.id, item_id: parsedItemId, location: targetLocation, quantity: added }
        });
        remaining -= added;
      }

      let sourceRemaining = requested;
      for (const row of sourceRows) {
        const removed = Math.min(sourceRemaining, Math.max(0, integer(row.quantity, 1)));
        const next = integer(row.quantity, 1) - removed;
        await tx.character_items.update({ where: { id: row.id }, data: { quantity: next, deleted: next === 0 } });
        sourceRemaining -= removed;
        if (!sourceRemaining) break;
      }

      return { itemId: parsedItemId, quantity: requested, direction };
    });
  } catch (error) {
    if (error instanceof VaultAccessError || error instanceof VaultRuleError) throw error;
    throw databaseError(`transfer${direction === VAULT_TRANSFER_DIRECTION.DEPOSIT ? 'To' : 'From'}Vault`, 'transfer item', error);
  }
}

export const transferToVault = (userId, input) => transferItem(userId, input?.itemId, input?.quantity, VAULT_TRANSFER_DIRECTION.DEPOSIT);
export const transferFromVault = (userId, input) => transferItem(userId, input?.itemId, input?.quantity, VAULT_TRANSFER_DIRECTION.WITHDRAW);

export async function transferVaultGold(userId, input) {
  const amount = quantity(input?.amount);
  const direction = input?.direction;
  if (!VALID_VAULT_TRANSFER_DIRECTIONS.includes(direction)) throw new VaultRuleError('Gold direction must be deposit or withdraw.');

  try {
    return await prisma.$transaction(async (tx) => {
      const character = await accessQuery(tx, userId);
      const vault = await getVaultForCharacter(tx, character.id);
      const player = await tx.players.findUnique({ where: { character_id: character.id }, select: { gold: true } });
      if (!player) throw new VaultRuleError('Player record not found.');

      const carried = Math.max(0, integer(player.gold));
      const stored = Math.max(0, integer(vault.stored_gold));
      if (direction === VAULT_TRANSFER_DIRECTION.DEPOSIT && carried < amount) throw new VaultRuleError('You do not have enough gold.');
      if (direction === VAULT_TRANSFER_DIRECTION.WITHDRAW && stored < amount) throw new VaultRuleError('The vault does not contain enough gold.');

      await tx.players.update({
        where: { character_id: character.id },
        data: { gold: direction === VAULT_TRANSFER_DIRECTION.DEPOSIT ? carried - amount : carried + amount }
      });
      await tx.character_vaults.update({
        where: { id: vault.id },
        data: { stored_gold: direction === VAULT_TRANSFER_DIRECTION.DEPOSIT ? stored + amount : stored - amount }
      });
      return { amount, direction };
    });
  } catch (error) {
    if (error instanceof VaultAccessError || error instanceof VaultRuleError) throw error;
    throw databaseError('transferVaultGold', 'transfer gold', error);
  }
}

export default { getCharacterVault, validateVaultAccess, transferToVault, transferFromVault, transferVaultGold };
