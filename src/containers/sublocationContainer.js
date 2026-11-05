import prisma from '../services/prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { adjustNpcPrice, getSublocationOwnerAffinity } from '../services/npcEconomyService.js';
import { TRADING_SUBLOCATION_TYPES } from '../configs/constants.js';
import { getNsfwAccessByUserId, nsfwItemWhere } from '../services/nsfwAccessService.js';

export async function getSublocation(sublocationId) {
  try {
    return await prisma.sublocations.findFirst({
      where: { id: sublocationId, deleted: false },
      include: {
        location: true,
        sublocations_items: {
          where: { deleted: false },
          include: { item: { include: { item_bonus: true } } }
        }
      }
    });
  } catch (error) {
    throw databaseError('getSublocation', 'read', error);
  }
}

export async function getShopItems(sublocationId, playerCharacterId, userId = null) {
  try {
    const nsfwAllowed = await getNsfwAccessByUserId(prisma, userId);
    const shop = await prisma.sublocations.findFirst({
      where: { id: sublocationId, deleted: false, sublocation_type: { in: TRADING_SUBLOCATION_TYPES } },
      select: {
        id: true,
        name: true,
        sublocation_type: true,
        owner_id: true,
        long_rest_price: true,
        food_water_refill_price: true,
        sublocations_items: {
          where: { deleted: false, item: { deleted: false, is_buyable: true, ...nsfwItemWhere(nsfwAllowed) } },
          include: { item: { include: { item_bonus: true } } },
          orderBy: { id: 'asc' }
        }
      }
    });

    if (!shop) return null;
    const ownerRelationship = await getSublocationOwnerAffinity(prisma, playerCharacterId, shop);
    return {
      id: shop.id,
      name: shop.name,
      sublocation_type: shop.sublocation_type,
      owner_id: shop.owner_id,
      owner_name: ownerRelationship.owner?.name || null,
      affinity: ownerRelationship.affinity,
      relationship_status: ownerRelationship.status,
      hostile: ownerRelationship.hostile,
      long_rest_price: shop.long_rest_price,
      adjusted_long_rest_price: adjustNpcPrice(shop.long_rest_price, ownerRelationship.affinity, true),
      food_water_refill_price: shop.food_water_refill_price,
      adjusted_food_water_refill_price: adjustNpcPrice(shop.food_water_refill_price, ownerRelationship.affinity, true),
      items: ownerRelationship.hostile ? [] : shop.sublocations_items.map(({ item, ...relation }) => ({
        ...item,
        base_price: Number(item.price ?? 0),
        price: adjustNpcPrice(item.price, ownerRelationship.affinity, false),
        shop_relation_id: relation.id
      }))
    };
  } catch (error) {
    throw databaseError('getShopItems', 'read', error);
  }
}

export default { getSublocation, getShopItems };
