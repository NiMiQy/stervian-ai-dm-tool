import { databaseError } from '../../../database/databaseError.js';
import { DEFAULT_NPC_LOCATION_KNOWLEDGE, DEFAULT_NPC_RELATIONSHIP_TYPE } from '../../../configs/constants.js';
import { nsfwWhere } from '../../nsfwAccessService.js';

export async function getNpcSocialAndSpatialContext(npcCharacterId, db, nsfwAllowed = false) {
  if (!npcCharacterId || !db) {
    return { knownNpcs: [], knownPlaces: [] };
  }

  const knownNpcs = [];
  const knownPlaces = [];
  const charId = Number(npcCharacterId);

  // 1. Social Graph: npc_relationships
  if (db.npc_relationships?.findMany) {
    try {
      const rels = await db.npc_relationships.findMany({
        where: {
          source_npc_id: charId,
          deleted: false,
          ...nsfwWhere(nsfwAllowed)
        },
        include: {
          target_npc: {
            include: {
              character: {
                select: { id: true, name: true, job: true }
              }
            }
          }
        }
      });

      for (const r of rels) {
        const targetChar = r.target_npc?.character;
        const targetName = targetChar?.name || `NPC #${r.target_npc_id}`;
        const type = r.relationship_type || DEFAULT_NPC_RELATIONSHIP_TYPE;
        const note = r.context_note ? `: ${r.context_note}` : '';
        knownNpcs.push(`RELATION: ${targetName} (${type})${note}`);
      }
    } catch (socialErr) {
      databaseError('getNpcSocialAndSpatialContext', 'findMany npc_relationships', socialErr);
    }
  }

  if (db.npc_known_locations?.findMany) {
    try {
      const locs = await db.npc_known_locations.findMany({
        where: {
          character_id: charId,
          deleted: false
        },
        include: {
          location: { select: { id: true, name: true } },
          sublocation: { select: { id: true, name: true, sublocation_type: true } }
        }
      });

      for (const kl of locs) {
        const placeName = kl.sublocation?.name || kl.location?.name;
        if (placeName) {
          const kType = kl.location_knowledge_type || DEFAULT_NPC_LOCATION_KNOWLEDGE;
          const memory = kl.location_semantic_memory ? `: ${kl.location_semantic_memory}` : '';
          knownPlaces.push(`LANDMARK: ${placeName} (${kType})${memory}`);
        }
      }
    } catch (spatialErr) {
      databaseError('getNpcSocialAndSpatialContext', 'findMany npc_known_locations', spatialErr);
    }
  }

  return { knownNpcs, knownPlaces };
}

// ============================================================================
