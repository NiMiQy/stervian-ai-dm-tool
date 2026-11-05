import { databaseError } from '../../../database/databaseError.js';
import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  AFFINITY_PRICE_PENALTIES,
  AFFINITY_SERVICE_DISCOUNTS,
  AFFINITY_STATUS_THRESHOLDS,
  HOSTILE_AFFINITY,
  RELATIONSHIP_HISTORY_LIMIT,
  RELATIONSHIP_NOTE_MAX_LENGTH,
  RELATIONSHIP_STATUS,
} from '../../../configs/constants.js';

export { RELATIONSHIP_STATUS };

export const AFFINITY_STATUS = RELATIONSHIP_STATUS;

export function clampAffinity(value) {
  return Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, Math.trunc(Number(value) || 0)));
}

export function getAffinityStatus(value) {
  const affinity = clampAffinity(value);
  return AFFINITY_STATUS_THRESHOLDS.find((threshold) => affinity <= threshold.max)?.status || RELATIONSHIP_STATUS.DEVOTED;
}

export function getAffinityPriceMultiplier(value, service = false) {
  const affinity = clampAffinity(value);
  if (affinity === HOSTILE_AFFINITY) return null;
  const penalty = AFFINITY_PRICE_PENALTIES.find((tier) => affinity <= tier.max);
  if (penalty) return penalty.multiplier;
  if (!service) return 1;
  return AFFINITY_SERVICE_DISCOUNTS.find((tier) => affinity >= tier.min)?.multiplier ?? 1;
}

export function evaluateRelationshipTransition(currentStatus, affinity) {
  if (affinity === undefined || affinity === null) {
    return RELATIONSHIP_STATUS[currentStatus] || RELATIONSHIP_STATUS.STRANGER;
  }
  return getAffinityStatus(affinity);
}

export function computeRelationshipStatus(affinity = 0) {
  return getAffinityStatus(affinity);
}

export class NpcRelationshipManager {
  constructor() {
    this.store = new Map();
  }

  _makeKey(userId, characterId, npcName) {
    return `${String(userId || 'default_user').trim().toLowerCase()}::${String(characterId || 'default_char').trim().toLowerCase()}::${String(npcName || 'unknown_npc').trim().toLowerCase()}`;
  }

  getNpcRelationship(userId, characterId, npcName) {
    const existing = this.store.get(this._makeKey(userId, characterId, npcName));
    if (existing) return { ...existing, history: [...existing.history] };
    return { affinity: 0, status: RELATIONSHIP_STATUS.STRANGER, isPlayerNameRevealed: false, history: [] };
  }

  getNpcAffinity(userId, characterId, npcName) {
    return this.getNpcRelationship(userId, characterId, npcName);
  }

  async hydrateFromDb({ db, playerCharId, npcCharId, userId, characterId, npcName }) {
    const key = this._makeKey(userId, characterId, npcName);
    if (this.store.has(key)) return this.getNpcRelationship(userId, characterId, npcName);
    if (!db?.player_npc_relationships || !playerCharId || !npcCharId) return this.getNpcRelationship(userId, characterId, npcName);

    try {
      const where = { player_character_id_npc_character_id: { player_character_id: Number(playerCharId), npc_character_id: Number(npcCharId) } };
      let record = await db.player_npc_relationships.findUnique({ where });
      if (!record || record.deleted) {
        record = await db.player_npc_relationships.upsert({
          where,
          update: { deleted: false },
          create: { player_character_id: Number(playerCharId), npc_character_id: Number(npcCharId), affinity: 0, status: RELATIONSHIP_STATUS.STRANGER, interaction_notes: 'Initial encounter (Stranger)' }
        });
      }
      const affinity = Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, Number(record.affinity) || 0));
      const loaded = {
        affinity,
        status: record.status ? (RELATIONSHIP_STATUS[record.status] || record.status) : evaluateRelationshipTransition(record.status, affinity),
        isPlayerNameRevealed: Boolean(record.is_player_name_revealed),
        history: record.interaction_notes ? [{ timestamp: record.updated_at?.toISOString?.() || new Date().toISOString(), reason: record.interaction_notes }] : []
      };
      this.store.set(key, loaded);
      if ((record.status !== loaded.status || record.affinity !== affinity) && typeof db?.player_npc_relationships?.update === 'function') {
        await db.player_npc_relationships.update({ where, data: { affinity, status: loaded.status } });
      }
      return { ...loaded, history: [...loaded.history] };
    } catch (error) {
      throw databaseError('NpcRelationshipManager.hydrateFromDb', 'read player NPC relationship', error);
    }
  }

  recordRelationshipChange(userId, characterId, npcName, newStatus, reason = '', options = {}) {
    const current = this.getNpcRelationship(userId, characterId, npcName);
    const requestedStatus = (newStatus && RELATIONSHIP_STATUS[newStatus])
      ? RELATIONSHIP_STATUS[newStatus]
      : evaluateRelationshipTransition(newStatus || current.status, current.affinity);
    const updated = { ...current, status: requestedStatus, history: [...current.history, { timestamp: new Date().toISOString(), reason: String(reason || 'Interaction observed').trim() }].slice(-RELATIONSHIP_HISTORY_LIMIT) };
    this.store.set(this._makeKey(userId, characterId, npcName), updated);
    if (options.db && options.playerCharId && options.npcCharId) {
      this.persistRelationshipToDb({ ...options, status: requestedStatus, affinity: current.affinity, reason }).catch(() => {});
    }
    return { ...updated, history: [...updated.history] };
  }

  markPlayerNameRevealed(userId, characterId, npcName) {
    const current = this.getNpcRelationship(userId, characterId, npcName);
    const updated = { ...current, isPlayerNameRevealed: true };
    this.store.set(this._makeKey(userId, characterId, npcName), updated);
    return updated;
  }

  async persistRelationshipToDb({ db, playerCharId, npcCharId, status, affinity = 0, reason = '' }) {
    if (!db?.player_npc_relationships?.upsert || !playerCharId || !npcCharId) return null;
    try {
      const value = clampAffinity(affinity);
      const resolvedStatus = (status && RELATIONSHIP_STATUS[status]) ? RELATIONSHIP_STATUS[status] : evaluateRelationshipTransition(status, value);
      const where = { player_character_id_npc_character_id: { player_character_id: Number(playerCharId), npc_character_id: Number(npcCharId) } };
      const saved = await db.player_npc_relationships.upsert({
        where,
        update: { affinity: value, status: resolvedStatus, interaction_notes: reason ? String(reason).slice(0, RELATIONSHIP_NOTE_MAX_LENGTH) : undefined, deleted: false },
        create: { player_character_id: Number(playerCharId), npc_character_id: Number(npcCharId), affinity: value, status: resolvedStatus, interaction_notes: String(reason || '').slice(0, RELATIONSHIP_NOTE_MAX_LENGTH) }
      });
      return saved;
    } catch (error) {
      throw databaseError('NpcRelationshipManager.persistRelationshipToDb', 'upsert player NPC relationship', error);
    }
  }

  getAllNpcRelationships(userId, characterId) {
    const prefix = `${String(userId || 'default_user').trim().toLowerCase()}::${String(characterId || 'default_char').trim().toLowerCase()}::`;
    return [...this.store.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ npcName: key.slice(prefix.length), ...value }));
  }

  getAllNpcAffinities(userId, characterId) {
    return this.getAllNpcRelationships(userId, characterId);
  }

  resetNpcAffinity(userId, characterId, npcName) {
    this.store.delete(this._makeKey(userId, characterId, npcName));
  }

  clearAll() {
    this.store.clear();
  }
}

export const NpcAffinityManager = NpcRelationshipManager;
export const npcRelationshipManager = new NpcRelationshipManager();
export const npcAffinityManager = npcRelationshipManager;
