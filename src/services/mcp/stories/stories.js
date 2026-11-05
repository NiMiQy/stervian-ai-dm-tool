import prisma from '../../prismaClient.js';
import { Prisma } from '../../../generated/prisma-fixed/index.js';
import { databaseError } from '../../../database/databaseError.js';
import { validateStory } from '../../storyService.js';
import { getStoryBroadcaster } from '../../webSocketService.js';
import { defineTable } from '../core/defineTable.js';
import { McpInputError, isMcpInputError } from '../core/mcpError.js';
import { MCP_DB_FIELD_TYPE, MCP_DB_MESSAGES } from '../../../configs/constants.js';

const { DATE_TIME, INT, JSON_DATA, STRING } = MCP_DB_FIELD_TYPE;

const storiesTable = defineTable({
  table: 'stories',
  description: 'Story turns (player action + DM narration). Readable and writable.',
  keys: ['id'],
  writable: true,
  fields: {
    id: { type: INT },
    user_id: { type: STRING },
    conversation_session_id: { type: STRING, nullable: true },
    location_id: { type: INT, nullable: true },
    sublocation_id: { type: INT, nullable: true },
    character_id: { type: INT },
    story: { type: STRING },
    action_from_player: { type: STRING },
    party_turn: { type: JSON_DATA, nullable: true },
    fate_check: { type: JSON_DATA, nullable: true },
    skill_check: { type: JSON_DATA, nullable: true },
    dialogue_session_id: { type: INT, nullable: true },
    dialogue_message_ids: { type: JSON_DATA, nullable: true },
    created_at: { type: DATE_TIME, nullable: true },
    updated_at: { type: DATE_TIME, nullable: true }
  }
});

export default storiesTable;

const STORY_SELECT = Object.freeze(Object.fromEntries(storiesTable.visibleFields.map((name) => [name, true])));
const isActive = { OR: [{ deleted: false }, { deleted: null }] };
const has = (input, name) => Object.prototype.hasOwnProperty.call(input, name) && input[name] !== undefined;

async function loadCharacter(client, characterId) {
  const character = await client.characters.findFirst({
    where: { id: characterId, ...isActive },
    select: { id: true, user_id: true, location_id: true, sublocation_id: true }
  });
  if (!character) throw new McpInputError(MCP_DB_MESSAGES.STORY_CHARACTER_NOT_FOUND);
  if (!character.user_id) throw new McpInputError(MCP_DB_MESSAGES.STORY_CHARACTER_NO_USER);
  return character;
}

async function resolvePlace(client, locationId, sublocationId) {
  if (sublocationId !== null && sublocationId !== undefined) {
    const sublocation = await client.sublocations.findFirst({ where: { id: sublocationId, ...isActive }, select: { id: true, location_id: true } });
    if (!sublocation) throw new McpInputError(MCP_DB_MESSAGES.STORY_SUBLOCATION_NOT_FOUND);
    if (locationId !== null && locationId !== undefined && sublocation.location_id !== locationId) {
      throw new McpInputError(MCP_DB_MESSAGES.STORY_SUBLOCATION_MISMATCH);
    }
    return { location_id: sublocation.location_id ?? locationId ?? null, sublocation_id: sublocation.id };
  }
  if (locationId !== null && locationId !== undefined) {
    const location = await client.locations.findFirst({ where: { id: locationId, ...isActive }, select: { id: true } });
    if (!location) throw new McpInputError(MCP_DB_MESSAGES.STORY_LOCATION_NOT_FOUND);
  }
  return { location_id: locationId ?? null, sublocation_id: null };
}

async function checkDialogueLink(client, characterId, sessionId, messageIds) {
  if (sessionId === null || sessionId === undefined) {
    if (Array.isArray(messageIds) && messageIds.length) throw new McpInputError(MCP_DB_MESSAGES.STORY_MESSAGES_NEED_SESSION);
    return;
  }
  const session = await client.dialogue_sessions.findFirst({ where: { id: sessionId }, select: { id: true, player_id: true } });
  if (!session) throw new McpInputError(MCP_DB_MESSAGES.STORY_DIALOGUE_NOT_FOUND);
  if (session.player_id !== characterId) throw new McpInputError(MCP_DB_MESSAGES.STORY_DIALOGUE_MISMATCH);
  if (Array.isArray(messageIds) && messageIds.length) {
    const found = await client.dialogue_messages.count({ where: { id: { in: messageIds }, session_id: sessionId } });
    if (found !== new Set(messageIds).size) throw new McpInputError(MCP_DB_MESSAGES.STORY_MESSAGES_MISMATCH);
  }
}

function checkStoryText(story) {
  const error = validateStory(story);
  if (error) throw new McpInputError(error);
}

function notifyGame(story) {
  getStoryBroadcaster()?.(story.user_id, { characterId: story.character_id, storyId: story.id, updatedAt: story.updated_at });
}

async function runWrite(operation, task) {
  try {
    return await task();
  } catch (error) {
    if (isMcpInputError(error)) throw error;
    throw databaseError('mcp.stories', operation, error);
  }
}

export function createStory(input) {
  return runWrite('create', async () => {
    checkStoryText(input.story);
    const character = await loadCharacter(prisma, input.character_id);
    if (has(input, 'user_id') && input.user_id !== character.user_id) throw new McpInputError(MCP_DB_MESSAGES.STORY_OWNER_MISMATCH);
    const placeGiven = has(input, 'location_id') || has(input, 'sublocation_id');
    const place = placeGiven
      ? await resolvePlace(prisma, input.location_id ?? null, input.sublocation_id ?? null)
      : { location_id: character.location_id ?? null, sublocation_id: character.sublocation_id ?? null };
    await checkDialogueLink(prisma, character.id, input.dialogue_session_id, input.dialogue_message_ids);

    const record = await prisma.stories.create({
      data: {
        user_id: character.user_id,
        character_id: character.id,
        story: input.story,
        action_from_player: input.action_from_player ?? '',
        conversation_session_id: input.conversation_session_id ?? null,
        ...place,
        ...(has(input, 'party_turn') && input.party_turn !== null ? { party_turn: input.party_turn } : {}),
        ...(has(input, 'fate_check') && input.fate_check !== null ? { fate_check: input.fate_check } : {}),
        ...(has(input, 'skill_check') && input.skill_check !== null ? { skill_check: input.skill_check } : {}),
        ...(has(input, 'dialogue_session_id') ? { dialogue_session_id: input.dialogue_session_id } : {}),
        ...(has(input, 'dialogue_message_ids') && input.dialogue_message_ids !== null ? { dialogue_message_ids: input.dialogue_message_ids } : {})
      },
      select: STORY_SELECT
    });
    notifyGame(record);
    return { table: 'stories', created: true, record };
  });
}

const EDITABLE_FIELDS = Object.freeze(['story', 'action_from_player', 'conversation_session_id', 'location_id', 'sublocation_id', 'party_turn', 'fate_check', 'skill_check', 'dialogue_session_id', 'dialogue_message_ids']);

export function updateStory({ id, ...changes }) {
  return runWrite('update', async () => {
    const edits = Object.fromEntries(EDITABLE_FIELDS.filter((name) => has(changes, name)).map((name) => [name, changes[name]]));
    if (!Object.keys(edits).length) throw new McpInputError(MCP_DB_MESSAGES.STORY_NOTHING_TO_UPDATE);
    const current = await prisma.stories.findUnique({ where: { id }, select: STORY_SELECT });
    if (!current) throw new McpInputError(MCP_DB_MESSAGES.NOT_FOUND);
    if (has(edits, 'story')) checkStoryText(edits.story);

    const data = { ...edits };
    if (has(edits, 'sublocation_id') && edits.sublocation_id !== null) {
      Object.assign(data, await resolvePlace(prisma, has(edits, 'location_id') ? edits.location_id : null, edits.sublocation_id));
    } else if (has(edits, 'location_id') || has(edits, 'sublocation_id')) {
      const locationId = has(edits, 'location_id') ? edits.location_id : current.location_id;
      const keepSublocation = !has(edits, 'sublocation_id') && locationId === current.location_id;
      Object.assign(data, keepSublocation
        ? { location_id: locationId, sublocation_id: current.sublocation_id }
        : await resolvePlace(prisma, locationId, null));
    }
    if (has(edits, 'dialogue_session_id') || has(edits, 'dialogue_message_ids')) {
      const sessionId = has(edits, 'dialogue_session_id') ? edits.dialogue_session_id : current.dialogue_session_id;
      const messageIds = has(edits, 'dialogue_message_ids') ? edits.dialogue_message_ids : current.dialogue_message_ids;
      await checkDialogueLink(prisma, current.character_id, sessionId, Array.isArray(messageIds) ? messageIds : []);
    }
    for (const name of ['party_turn', 'fate_check', 'skill_check', 'dialogue_message_ids']) {
      if (has(data, name) && data[name] === null) data[name] = Prisma.DbNull;
    }

    const record = await prisma.stories.update({ where: { id }, data, select: STORY_SELECT });
    notifyGame(record);
    return { table: 'stories', updated: true, record };
  });
}
