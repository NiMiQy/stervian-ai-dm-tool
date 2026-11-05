import { databaseError } from '../database/databaseError.js';
import { nsfwWhere } from './nsfwAccessService.js';
import { inspectCurrentLocation } from './ai/agentHarness/tools/worldTools.js';
import {
  DEFAULT_NPC_LOCATION_KNOWLEDGE,
  DEFAULT_NPC_RELATIONSHIP_TYPE,
  PLAYER_TOOL,
  PLAYER_TOOL_LIST,
  PLAYER_TOOL_NPC_NAME_MAX_LENGTH,
  PLAYER_TOOLS_NEEDING_TARGET
} from '../configs/constants.js';

export class PlayerToolError extends Error {}

function nameWords(value) {
  return String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function matchesName(candidateName, requestedName) {
  const candidate = nameWords(candidateName);
  const requested = nameWords(requestedName);
  return requested.length > 0 && candidate.some((_, start) =>
    requested.every((word, offset) => candidate[start + offset] === word)
  );
}

export function normalizePlayerTools(rawTools, { targetNpcId = null } = {}) {
  if (rawTools === undefined || rawTools === null) return [];
  if (!Array.isArray(rawTools)) throw new PlayerToolError('Tool calls must be a list.');
  const seen = new Set();
  const tools = [];
  for (const entry of rawTools) {
    const tool = String(entry?.tool || '').trim();
    if (!PLAYER_TOOL_LIST.includes(tool)) throw new PlayerToolError(`Unknown tool: ${tool || '(empty)'}.`);
    if (seen.has(tool)) throw new PlayerToolError(`${tool} was requested twice.`);
    seen.add(tool);
    if (PLAYER_TOOLS_NEEDING_TARGET.includes(tool) && !targetNpcId) {
      throw new PlayerToolError(`${tool} needs a target NPC. Select who you are talking to first.`);
    }
    let npcName = null;
    if (tool === PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC) {
      npcName = String(entry?.npcName || '').replace(/\s+/g, ' ').trim();
      if (!npcName) throw new PlayerToolError('Choose or type the NPC to ask about.');
      if (npcName.length > PLAYER_TOOL_NPC_NAME_MAX_LENGTH) {
        throw new PlayerToolError(`NPC names must be ${PLAYER_TOOL_NPC_NAME_MAX_LENGTH} characters or fewer.`);
      }
    }
    tools.push({ tool, npcName });
  }
  return tools;
}

async function readNpcKnownPlaces(db, npcCharacterId) {
  try {
    const rows = await db.npc_known_locations.findMany({
      where: { character_id: Number(npcCharacterId), deleted: false },
      include: {
        location: { select: { name: true } },
        sublocation: { select: { name: true, sublocation_type: true } }
      },
      orderBy: { id: 'asc' }
    });
    const seen = new Set();
    const places = [];
    for (const row of rows) {
      const place = row.sublocation?.name || row.location?.name;
      if (!place) continue;
      const key = `${place}|${row.location?.name || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({
        place,
        location: row.sublocation ? (row.location?.name || null) : null,
        knowledge: row.location_knowledge_type || DEFAULT_NPC_LOCATION_KNOWLEDGE,
        note: row.location_semantic_memory || null
      });
    }
    return places;
  } catch (error) {
    throw databaseError('readNpcKnownPlaces', 'read NPC known places', error);
  }
}

async function readNpcRelationshipWith(db, npcCharacterId, otherNpcName, nsfwAllowed) {
  try {
    const rows = await db.npc_relationships.findMany({
      where: { source_npc_id: Number(npcCharacterId), deleted: false, ...nsfwWhere(nsfwAllowed) },
      include: { target_npc: { include: { character: { select: { id: true, name: true, deleted: true } } } } }
    });
    const match = rows.find((row) => {
      const character = row.target_npc?.character;
      return character && !character.deleted && matchesName(character.name, otherNpcName);
    });
    if (!match) return { knows: false, name: otherNpcName };
    return {
      knows: true,
      name: match.target_npc.character.name,
      relationshipType: match.relationship_type || DEFAULT_NPC_RELATIONSHIP_TYPE,
      note: match.context_note || null
    };
  } catch (error) {
    throw databaseError('readNpcRelationshipWith', 'read NPC relationship', error);
  }
}

export async function runPlayerTools({ db, characterId, targetNpc = null, tools = [], nsfwAllowed = false }) {
  const targetId = targetNpc ? Number(targetNpc.character_id || targetNpc.character?.id || targetNpc.id) : null;
  const targetName = targetNpc ? (targetNpc.character?.name || targetNpc.name || 'the target NPC') : null;
  const results = [];
  for (const { tool, npcName } of tools) {
    if (tool === PLAYER_TOOL.INSPECT_CURRENT_LOCATION) {
      results.push({ tool, data: await inspectCurrentLocation(db, characterId) });
    } else if (tool === PLAYER_TOOL.NPC_KNOWN_PLACES && targetId) {
      results.push({ tool, npcName: targetName, data: { places: await readNpcKnownPlaces(db, targetId) } });
    } else if (tool === PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC && targetId) {
      results.push({ tool, npcName: targetName, data: await readNpcRelationshipWith(db, targetId, npcName, nsfwAllowed) });
    }
  }
  return results;
}

function formatInspectResult(data) {
  if (data?.error) return `- Lookup failed: ${data.error}`;
  const places = data.isInsideSublocation ? (data.otherPlacesInLocation || []) : (data.nearbyPointsOfInterest || []);
  const lines = [
    `- Location: ${data.territory}${data.locationDescription ? ` — ${data.locationDescription}` : ''}`,
    `- Player position: ${data.isInsideSublocation ? `inside "${data.currentSublocation}" (${data.sublocationType})` : 'outdoors in the open area'}`,
    `- ${data.isInsideSublocation ? 'Other places in this location (not visible from inside)' : 'Places in this location'}:`,
    ...(places.length ? places.map((place) => `  - ${place.name} (${place.type})${place.description ? `: ${place.description}` : ''}`) : ['  - None recorded.']),
    `- Visible ground items: ${data.visibleGroundItems?.length ? data.visibleGroundItems.join(', ') : 'none'}`
  ];
  return lines.join('\n');
}

function formatKnownPlace(place) {
  const where = place.location ? ` in ${place.location}` : '';
  return `- ${place.place}${where} (${place.knowledge})${place.note ? `: ${place.note}` : ''}`;
}

function formatKnownPlacesResult(npcName, data, perspective) {
  const places = data?.places || [];
  const subject = perspective === 'npc' ? 'You know' : `${npcName} knows`;
  if (!places.length) {
    return perspective === 'npc'
      ? '- You know no recorded places. You cannot give real directions; at most you have vague rumours.'
      : `- ${npcName} knows no recorded places. ${npcName} cannot give real directions.`;
  }
  return [
    `${subject} these places:`,
    ...places.map(formatKnownPlace),
    perspective === 'npc'
      ? '- You do not know any other place. You may mention rumours, but you cannot give directions to places outside this list.'
      : `- ${npcName} does not know places outside this list: no real directions to them in the brief.`
  ].join('\n');
}

function formatRelationshipResult(npcName, data, perspective) {
  if (!data?.knows) {
    return perspective === 'npc'
      ? `- You do NOT know anyone called "${data?.name}". Treat the name as unfamiliar; never invent a shared past with them.`
      : `- ${npcName} does NOT know "${data?.name}". In the brief, ${npcName} treats the name as unfamiliar and never invents a shared past.`;
  }
  const note = data.note ? ` Your note about them: ${data.note}` : '';
  return perspective === 'npc'
    ? `- You know ${data.name}: ${data.relationshipType}.${note}`
    : `- ${npcName} knows ${data.name}: ${data.relationshipType}.${data.note ? ` ${npcName}'s note: ${data.note}` : ''}`;
}

export function formatPlayerToolResultsForPrompt(results = []) {
  if (!Array.isArray(results) || !results.length) return '';
  const sections = [
    '### Player-Requested Lookups (system-run this turn, canonical)',
    'The player asked the system to check these records before you plan. They are true for this turn: build the brief on them and never contradict them.'
  ];
  for (const result of results) {
    if (result.tool === PLAYER_TOOL.INSPECT_CURRENT_LOCATION) {
      sections.push(`#### ${result.tool}\n${formatInspectResult(result.data)}`);
    } else if (result.tool === PLAYER_TOOL.NPC_KNOWN_PLACES) {
      sections.push(`#### ${result.tool} — what ${result.npcName} knows\n${formatKnownPlacesResult(result.npcName, result.data, 'master')}`);
    } else if (result.tool === PLAYER_TOOL.SEARCH_NPC_IN_RELATIONSHIP_WITH_NPC) {
      sections.push(`#### ${result.tool} — does ${result.npcName} know "${result.data?.name}"?\n${formatRelationshipResult(result.npcName, result.data, 'master')}`);
    }
  }
  return sections.join('\n\n');
}

export function formatPlayerToolResultsForRoleplay(results = []) {
  const npcResults = (Array.isArray(results) ? results : []).filter((result) => PLAYER_TOOLS_NEEDING_TARGET.includes(result.tool));
  if (!npcResults.length) return '';
  const lines = ['### Facts Checked This Turn (canonical)'];
  for (const result of npcResults) {
    if (result.tool === PLAYER_TOOL.NPC_KNOWN_PLACES) lines.push(formatKnownPlacesResult(result.npcName, result.data, 'npc'));
    else lines.push(formatRelationshipResult(result.npcName, result.data, 'npc'));
  }
  return lines.join('\n');
}
