import { characterItemInclude, buildEquipment } from '../components/logics/characterItems.js';
import { CONSUME_BONUS_MODE, CURE_EFFECT_NONE, ITEM_LOCATION, ITEM_STAT_BONUS_FIELDS } from '../configs/constants.js';

const MS_PER_MINUTE = 60 * 1000;
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function consumeBonusMode(bonus) {
  const mode = bonus?.consume_bonus_mode;
  return Object.values(CONSUME_BONUS_MODE).includes(mode) ? mode : CONSUME_BONUS_MODE.NONE;
}

export function itemStatBonuses(bonus = {}) {
  return ITEM_STAT_BONUS_FIELDS
    .map(([field, label]) => ({ field, label, value: number(bonus?.[field]) }))
    .filter((entry) => entry.value !== 0);
}

export function describeStatBonuses(bonus = {}) {
  return itemStatBonuses(bonus).map(({ label, value }) => `${value > 0 ? '+' : ''}${value} ${label}`).join(', ');
}

export function hasInstantEffect(bonus = {}) {
  const cure = bonus?.cure_effect_type;
  return ['healing_current_hp', 'current_food_bonus', 'current_water_bonus', 'current_energy_bonus'].some((field) => number(bonus?.[field]) !== 0)
    || Boolean(cure && cure !== CURE_EFFECT_NONE);
}

export function isActiveBonusTime(row, now = new Date()) {
  if (!row || row.deleted) return false;
  if (consumeBonusMode(row.item?.item_bonus) === CONSUME_BONUS_MODE.NONE) return false;
  return Boolean(row.is_permanent) || Boolean(row.expires_at && new Date(row.expires_at) > now);
}

export function bonusEquipmentFromRows(rows = [], now = new Date()) {
  return Object.fromEntries(rows.filter((row) => isActiveBonusTime(row, now)).map((row) => [`item_bonus_time_${row.id}`, row.item]));
}

export function describeActiveBonusTimes(rows = [], now = new Date()) {
  return rows.filter((row) => isActiveBonusTime(row, now)).map((row) => ({
    item_id: row.item_id,
    name: row.item?.name || `Item #${row.item_id}`,
    is_permanent: Boolean(row.is_permanent),
    expires_at: row.is_permanent ? null : row.expires_at,
    remaining_seconds: row.is_permanent ? null : Math.max(0, Math.floor((new Date(row.expires_at).getTime() - now.getTime()) / 1000)),
    bonuses: itemStatBonuses(row.item?.item_bonus)
  }));
}

export const itemBonusTimeInclude = { item: { include: { item_bonus: true } } };

export function loadBonusTimes(client, characterId) {
  return client.character_item_bonus_time.findMany({ where: { character_id: characterId, deleted: false }, include: itemBonusTimeInclude, orderBy: { id: 'asc' } });
}

export async function loadBonusEquipment(client, characterId, now = new Date()) {
  return bonusEquipmentFromRows(await loadBonusTimes(client, characterId), now);
}

export async function expireBonusTimes(client, characterId, now = new Date()) {
  const result = await client.character_item_bonus_time.updateMany({
    where: { character_id: characterId, deleted: false, is_permanent: false, OR: [{ expires_at: null }, { expires_at: { lte: now } }] },
    data: { deleted: true }
  });
  return result.count;
}

export async function clearTemporaryBonusTimes(client, characterId) {
  const result = await client.character_item_bonus_time.updateMany({ where: { character_id: characterId, deleted: false, is_permanent: false }, data: { deleted: true } });
  return result.count;
}

export async function syncStoredMaxHp(client, characterId, calculateDerivedStats) {
  const stats = await client.character_stats.findUnique({ where: { character_id: characterId } });
  if (!stats) return null;
  const equippedRows = await client.character_items.findMany({ where: { character_id: characterId, deleted: false, location: ITEM_LOCATION.EQUIPPED }, include: characterItemInclude });
  const equipment = { ...buildEquipment(equippedRows), ...await loadBonusEquipment(client, characterId) };
  const { maxHP } = calculateDerivedStats(stats, equipment);
  const currentHp = Math.min(number(stats.current_hp ?? maxHP), maxHP);
  return client.character_stats.update({ where: { id: stats.id }, data: { max_hp: maxHP, current_hp: currentHp } });
}

async function findBonusTime(client, characterId, itemId) {
  return client.character_item_bonus_time.findUnique({ where: { character_id_item_id: { character_id: characterId, item_id: itemId } } });
}

export async function consumeBonusBlockReason(client, characterId, item) {
  const bonus = item?.item_bonus || {};
  if (consumeBonusMode(bonus) !== CONSUME_BONUS_MODE.PERMANENT_ONCE || hasInstantEffect(bonus)) return null;
  const existing = await findBonusTime(client, characterId, item.id);
  return existing && !existing.deleted && existing.is_permanent ? `You have already absorbed the power of ${item.name}. Using it again would have no effect.` : null;
}

export async function applyConsumeBonus(client, characterId, item, now = new Date()) {
  const bonus = item?.item_bonus || {};
  const mode = consumeBonusMode(bonus);
  const summary = describeStatBonuses(bonus);
  if (mode === CONSUME_BONUS_MODE.NONE || !summary) return { changed: false, message: '' };
  const existing = await findBonusTime(client, characterId, item.id);
  const where = { character_id_item_id: { character_id: characterId, item_id: item.id } };

  if (mode === CONSUME_BONUS_MODE.PERMANENT_ONCE) {
    if (existing && !existing.deleted && existing.is_permanent) return { changed: false, message: 'Its permanent power has already been absorbed.' };
    await client.character_item_bonus_time.upsert({
      where,
      create: { character_id: characterId, item_id: item.id, is_permanent: true, expires_at: null },
      update: { is_permanent: true, expires_at: null, deleted: false }
    });
    return { changed: true, message: `Permanently gained ${summary}.` };
  }

  const minutes = Math.max(0, Math.trunc(number(bonus.buff_duration_minutes)));
  if (minutes <= 0) return { changed: false, message: '' };
  if (existing && !existing.deleted && existing.is_permanent) return { changed: false, message: 'Its power is already permanently yours.' };
  const refreshed = Boolean(existing && !existing.deleted && existing.expires_at && new Date(existing.expires_at) > now);
  const expiresAt = new Date(now.getTime() + minutes * MS_PER_MINUTE);
  await client.character_item_bonus_time.upsert({
    where,
    create: { character_id: characterId, item_id: item.id, is_permanent: false, expires_at: expiresAt },
    update: { is_permanent: false, expires_at: expiresAt, deleted: false }
  });
  return { changed: true, message: `${refreshed ? 'Refreshed' : 'Gained'} ${summary} for ${minutes} minute${minutes === 1 ? '' : 's'}.` };
}
