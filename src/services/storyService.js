import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { DIALOGUE_MESSAGE_TYPE, HTTP_STATUS } from '../configs/constants.js';

/**
 * Story Service
 * Manages database persistence, retrieval, updating, and deletion of conversation story turns.
 */

/**
 * Validates story content.
 * @param {string} story
 * @returns {string|null} Error message or null if valid.
 */
export function validateStory(story) {
  if (!story || typeof story !== 'string' || !story.trim()) {
    return 'Story content cannot be empty.';
  }
  return null;
}


/**
 * Fetches all story turns for a given character, ordered chronologically.
 */
export async function getCharacterStoryHistory(characterId) {
  try {
    const stories = await prisma.stories.findMany({
      where: { character_id: Number(characterId) },
      orderBy: { id: 'asc' }
    });
    return stories;
  } catch (error) {
    throw databaseError('storyService', 'getCharacterStoryHistory', error);
  }
}

/**
 * Creates a new story turn in the database.
 */
export async function createStoryTurn({ userId, characterId, actionFromPlayer = '', story = '', conversationSessionId = null, locationId = null, sublocationId = null, partyTurn = null, fateCheck = null, skillCheck = null }) {
  try {
    const record = await prisma.stories.create({
      data: {
        user_id: userId,
        character_id: Number(characterId),
        action_from_player: String(actionFromPlayer || ''),
        story: String(story || ''),
        conversation_session_id: conversationSessionId,
        location_id: locationId ? Number(locationId) : null,
        sublocation_id: sublocationId ? Number(sublocationId) : null,
        ...(Array.isArray(partyTurn) && partyTurn.length ? { party_turn: partyTurn } : {}),
        ...(fateCheck ? { fate_check: fateCheck } : {}),
        ...(skillCheck ? { skill_check: skillCheck } : {})
      }
    });
    return record;
  } catch (error) {
    throw databaseError('storyService', 'createStoryTurn', error);
  }
}

function storyDialogueMessageIds(story) {
  const raw = typeof story?.dialogue_message_ids === 'string' ? JSON.parse(story.dialogue_message_ids || '[]') : story?.dialogue_message_ids;
  return Array.isArray(raw) ? raw.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
}

export async function linkStoryDialogueMessages(storyId, sessionId, messageIds = [], client = prisma) {
  try {
    const ids = messageIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    return await client.stories.update({
      where: { id: Number(storyId) },
      data: { dialogue_session_id: Number(sessionId), dialogue_message_ids: ids },
      select: { id: true, dialogue_session_id: true, dialogue_message_ids: true }
    });
  } catch (error) {
    throw databaseError('storyService', 'linkStoryDialogueMessages', error);
  }
}

async function deleteLinkedDialogueMessages(story, messageType = null) {
  const ids = storyDialogueMessageIds(story);
  if (!ids.length || !story.dialogue_session_id) return { deletedIds: [], remainingIds: ids };
  const rows = await prisma.dialogue_messages.findMany({
    where: { id: { in: ids }, session_id: Number(story.dialogue_session_id), ...(messageType ? { message_type: messageType } : {}) },
    select: { id: true }
  });
  const deletedIds = rows.map((row) => row.id);
  if (deletedIds.length) await prisma.dialogue_messages.deleteMany({ where: { id: { in: deletedIds } } });
  return { deletedIds, remainingIds: ids.filter((id) => !deletedIds.includes(id)) };
}

/**
 * Updates an existing story turn in the database.
 * Verifies that the requesting user owns the story record.
 */
export async function updateStoryTurn(storyId, userId, updates = {}) {
  try {
    const existing = await prisma.stories.findUnique({
      where: { id: Number(storyId) }
    });

    if (!existing) {
      return { error: 'Story record not found.', statusCode: HTTP_STATUS.NOT_FOUND };
    }

    if (existing.user_id !== userId) {
      return { error: 'You do not have permission to update this story.', statusCode: HTTP_STATUS.FORBIDDEN };
    }

    const data = {};
    if (typeof updates.actionFromPlayer === 'string' || typeof updates.action_from_player === 'string') {
      data.action_from_player = updates.actionFromPlayer ?? updates.action_from_player;
    }
    if (typeof updates.story === 'string') {
      data.story = updates.story;
    }
    if (typeof updates.conversationSessionId === 'string' || typeof updates.conversation_session_id === 'string') {
      data.conversation_session_id = updates.conversationSessionId ?? updates.conversation_session_id;
    }

    const deletedDialogueMessageIds = [];
    if (data.action_from_player === '') {
      const { deletedIds } = await deleteLinkedDialogueMessages(existing, DIALOGUE_MESSAGE_TYPE.ACTION);
      deletedDialogueMessageIds.push(...deletedIds);
    }
    if (data.story === '') {
      const { deletedIds } = await deleteLinkedDialogueMessages(existing, DIALOGUE_MESSAGE_TYPE.NARRATION);
      deletedDialogueMessageIds.push(...deletedIds);
    }
    if (deletedDialogueMessageIds.length) {
      data.dialogue_message_ids = storyDialogueMessageIds(existing).filter((id) => !deletedDialogueMessageIds.includes(id));
    }

    const updated = await prisma.stories.update({
      where: { id: Number(storyId) },
      data
    });

    return { success: true, story: updated, deletedDialogueMessageIds };
  } catch (error) {
    throw databaseError('storyService', 'updateStoryTurn', error);
  }
}

/**
 * Deletes an existing story turn from the database.
 * Verifies that the requesting user owns the story record.
 */
export async function deleteStoryTurn(storyId, userId) {
  try {
    const existing = await prisma.stories.findUnique({
      where: { id: Number(storyId) }
    });

    if (!existing) {
      return { error: 'Story record not found.', statusCode: HTTP_STATUS.NOT_FOUND };
    }

    if (existing.user_id !== userId) {
      return { error: 'You do not have permission to delete this story.', statusCode: HTTP_STATUS.FORBIDDEN };
    }

    const { deletedIds } = await deleteLinkedDialogueMessages(existing);
    await prisma.stories.delete({
      where: { id: Number(storyId) }
    });

    return { success: true, id: Number(storyId), dialogueSessionId: existing.dialogue_session_id ?? null, deletedDialogueMessageIds: deletedIds };
  } catch (error) {
    throw databaseError('storyService', 'deleteStoryTurn', error);
  }
}

/**
 * Clears all story turns for a character belonging to the given user.
 */
export async function clearCharacterStoryHistory(characterId, userId) {
  try {
    const linkedStories = await prisma.stories.findMany({
      where: { character_id: Number(characterId), user_id: userId, dialogue_session_id: { not: null } },
      select: { dialogue_session_id: true, dialogue_message_ids: true }
    });
    const idsBySession = new Map();
    for (const story of linkedStories) {
      const ids = storyDialogueMessageIds(story);
      if (!ids.length) continue;
      const sessionId = Number(story.dialogue_session_id);
      idsBySession.set(sessionId, [...(idsBySession.get(sessionId) || []), ...ids]);
    }
    let deletedDialogueMessages = 0;
    for (const [sessionId, ids] of idsBySession) {
      const deleted = await prisma.dialogue_messages.deleteMany({ where: { session_id: sessionId, id: { in: ids } } });
      deletedDialogueMessages += deleted?.count || 0;
    }

    const result = await prisma.stories.deleteMany({
      where: {
        character_id: Number(characterId),
        user_id: userId
      }
    });

    return { success: true, count: result.count, deletedDialogueMessages };
  } catch (error) {
    throw databaseError('storyService', 'clearCharacterStoryHistory', error);
  }
}
