import { databaseError } from '../database/databaseError.js';
import prisma from '../services/prismaClient.js';
import { scheduleDialogueSessionSummaries } from '../services/dialogueSummaryService.js';
import {
  DIALOGUE_FAREWELL_NEGATION_PATTERN,
  DIALOGUE_FAREWELL_PATTERN,
  DIALOGUE_HISTORY_LIMIT,
  DIALOGUE_LEAVE_CHOICE,
  DIALOGUE_MESSAGE_TYPE,
  DIALOGUE_PARTICIPANT_ROLE,
  DIALOGUE_SESSION_STATUS,
  DIALOGUE_PAUSE_TIMEOUT_MS,
  DIALOGUE_SESSION_TYPE,
  DIALOGUE_SUMMARY_MAX_PAUSE_AGE_MS,
  ROLEPLAY_HISTORY_MESSAGES,
} from '../configs/constants.js';

const OPEN_STATUSES = [DIALOGUE_SESSION_STATUS.ACTIVE, DIALOGUE_SESSION_STATUS.PAUSED];
const SESSION_NPC_SELECT = { id: true, session_type: true, target_npc_id: true, target_npc: { select: { id: true, name: true } }, _count: { select: { messages: true } } };

function sessionSummary(session) {
  return { id: session.id, npcId: session.target_npc_id, npcName: session.target_npc?.name || 'NPC', messageCount: session._count?.messages ?? 0 };
}

function leftSessionCondition(newSublocationId, leaveLocation) {
  if (leaveLocation) return {};
  return newSublocationId
    ? { OR: [{ sublocation_id: null }, { sublocation_id: { not: Number(newSublocationId) } }] }
    : { sublocation_id: { not: null } };
}

export function isFarewellMessage(text) {
  const clean = String(text || '').trim();
  if (!clean || !DIALOGUE_FAREWELL_PATTERN.test(clean)) return false;
  return !DIALOGUE_FAREWELL_NEGATION_PATTERN.test(clean);
}

export function normalizeDialogueLeaveChoice(choice) {
  return String(choice || '').toUpperCase() === DIALOGUE_LEAVE_CHOICE.CLOSE ? DIALOGUE_LEAVE_CHOICE.CLOSE : DIALOGUE_LEAVE_CHOICE.PAUSE;
}

async function closeSessions(db, sessions) {
  if (!sessions.length) return [];
  await db.dialogue_sessions.updateMany({
    where: { id: { in: sessions.map((session) => session.id) }, status: { in: OPEN_STATUSES } },
    data: { status: DIALOGUE_SESSION_STATUS.CLOSED }
  });
  scheduleDialogueSessionSummaries(sessions.filter((session) => session.session_type === DIALOGUE_SESSION_TYPE.DIRECT).map((session) => session.id));
  return sessions.map(sessionSummary);
}

export async function expireStaleDialogueSessions({ playerId = null, customPrisma = null } = {}) {
  const db = customPrisma || prisma;
  try {
    const now = Date.now();
    const cutoff = new Date(now - DIALOGUE_PAUSE_TIMEOUT_MS);
    const summaryCutoff = new Date(now - DIALOGUE_SUMMARY_MAX_PAUSE_AGE_MS);
    const stale = await db.dialogue_sessions.findMany({
      where: { status: DIALOGUE_SESSION_STATUS.PAUSED, last_active_at: { lt: cutoff }, ...(playerId ? { player_id: Number(playerId) } : {}) },
      select: { ...SESSION_NPC_SELECT, last_active_at: true }
    });
    if (!stale.length) return [];
    await db.dialogue_sessions.updateMany({
      where: { id: { in: stale.map((session) => session.id) }, status: DIALOGUE_SESSION_STATUS.PAUSED },
      data: { status: DIALOGUE_SESSION_STATUS.CLOSED }
    });
    scheduleDialogueSessionSummaries(stale.filter((session) => session.session_type === DIALOGUE_SESSION_TYPE.DIRECT && session.last_active_at >= summaryCutoff).map((session) => session.id));
    return stale.map(sessionSummary);
  } catch (error) {
    throw databaseError('expireStaleDialogueSessions', 'close expired dialogue sessions', error);
  }
}

export async function getLeavingDialogueSessions(playerId, { newSublocationId = null, leaveLocation = false } = {}, customPrisma = null) {
  const db = customPrisma || prisma;
  try {
    const sessions = await db.dialogue_sessions.findMany({
      where: {
        player_id: Number(playerId),
        status: DIALOGUE_SESSION_STATUS.ACTIVE,
        session_type: DIALOGUE_SESSION_TYPE.DIRECT,
        messages: { some: {} },
        ...leftSessionCondition(newSublocationId, leaveLocation)
      },
      select: SESSION_NPC_SELECT,
      orderBy: { last_active_at: 'desc' }
    });
    return sessions.map(sessionSummary);
  } catch (error) {
    throw databaseError('getLeavingDialogueSessions', 'read dialogue sessions before leaving', error);
  }
}

export async function getResumableDialogueSessions(playerId, customPrisma = null) {
  const db = customPrisma || prisma;
  try {
    await expireStaleDialogueSessions({ playerId, customPrisma: db });
    const character = await db.characters.findUnique({ where: { id: Number(playerId) }, select: { location_id: true, sublocation_id: true } });
    if (!character) return [];
    const sessions = await db.dialogue_sessions.findMany({
      where: {
        player_id: Number(playerId),
        status: DIALOGUE_SESSION_STATUS.PAUSED,
        session_type: DIALOGUE_SESSION_TYPE.DIRECT,
        location_id: character.location_id,
        sublocation_id: character.sublocation_id ?? null
      },
      select: SESSION_NPC_SELECT,
      orderBy: { last_active_at: 'desc' }
    });
    return sessions.map(sessionSummary);
  } catch (error) {
    throw databaseError('getResumableDialogueSessions', 'read resumable dialogue sessions', error);
  }
}

export async function resumeDialogueSessions(playerId, customPrisma = null) {
  const db = customPrisma || prisma;
  try {
    const sessions = await getResumableDialogueSessions(playerId, db);
    if (!sessions.length) return [];
    await db.dialogue_sessions.updateMany({
      where: { id: { in: sessions.map((session) => session.id) }, status: DIALOGUE_SESSION_STATUS.PAUSED },
      data: { status: DIALOGUE_SESSION_STATUS.ACTIVE, last_active_at: new Date() }
    });
    return sessions;
  } catch (error) {
    throw databaseError('resumeDialogueSessions', 'resume dialogue sessions', error);
  }
}

export async function endDialogueSession(playerId, targetNpcId, customPrisma = null) {
  const db = customPrisma || prisma;
  try {
    const sessions = await db.dialogue_sessions.findMany({
      where: { player_id: Number(playerId), target_npc_id: Number(targetNpcId), session_type: DIALOGUE_SESSION_TYPE.DIRECT, status: { in: OPEN_STATUSES } },
      select: SESSION_NPC_SELECT
    });
    return await closeSessions(db, sessions);
  } catch (error) {
    throw databaseError('endDialogueSession', 'end dialogue session', error);
  }
}

export async function closeDialogueSessionById(sessionId, customPrisma = null) {
  const db = customPrisma || prisma;
  try {
    const sessions = await db.dialogue_sessions.findMany({ where: { id: Number(sessionId), status: { in: OPEN_STATUSES } }, select: SESSION_NPC_SELECT });
    return await closeSessions(db, sessions);
  } catch (error) {
    throw databaseError('closeDialogueSessionById', 'close dialogue session', error);
  }
}

export async function getOrCreateDialogueSession({
  playerId,
  locationId = null,
  sublocationId = null,
  targetNpcId = null,
  sessionType = DIALOGUE_SESSION_TYPE.DIRECT,
  customPrisma = null
}) {
  const db = customPrisma || prisma;
  try {
    const numericPlayerId = Number(playerId);
    const numericTargetNpcId = targetNpcId ? Number(targetNpcId) : null;
    const resolvedType = numericTargetNpcId ? DIALOGUE_SESSION_TYPE.DIRECT : (sessionType || DIALOGUE_SESSION_TYPE.AMBIENT);
    await expireStaleDialogueSessions({ playerId: numericPlayerId, customPrisma: db });

    if (numericTargetNpcId) {
      await db.dialogue_sessions.updateMany({
        where: {
          player_id: numericPlayerId,
          status: DIALOGUE_SESSION_STATUS.ACTIVE,
          session_type: DIALOGUE_SESSION_TYPE.DIRECT,
          target_npc_id: { not: numericTargetNpcId }
        },
        data: {
          status: DIALOGUE_SESSION_STATUS.PAUSED,
          last_active_at: new Date()
        }
      });

      const existingSession = await db.dialogue_sessions.findFirst({
        where: {
          player_id: numericPlayerId,
          target_npc_id: numericTargetNpcId,
          status: { in: [DIALOGUE_SESSION_STATUS.ACTIVE, DIALOGUE_SESSION_STATUS.PAUSED] }
        },
        include: {
          participants: true,
          messages: {
            orderBy: { created_at: 'desc' },
            take: DIALOGUE_HISTORY_LIMIT
          }
        },
        orderBy: { updated_at: 'desc' }
      });

      if (existingSession) {
        if (existingSession.status !== DIALOGUE_SESSION_STATUS.ACTIVE) {
          return await db.dialogue_sessions.update({
            where: { id: existingSession.id },
            data: { status: DIALOGUE_SESSION_STATUS.ACTIVE, last_active_at: new Date() },
            include: {
              participants: true,
              messages: {
                orderBy: { created_at: 'desc' },
                take: DIALOGUE_HISTORY_LIMIT
              }
            }
          });
        }
        return existingSession;
      }

      const playerChar = await db.characters.findUnique({
        where: { id: numericPlayerId },
        select: { id: true, name: true }
      });
      const targetChar = await db.characters.findUnique({
        where: { id: numericTargetNpcId },
        select: { id: true, name: true }
      });

      return await db.dialogue_sessions.create({
        data: {
          player_id: numericPlayerId,
          session_type: DIALOGUE_SESSION_TYPE.DIRECT,
          status: DIALOGUE_SESSION_STATUS.ACTIVE,
          location_id: locationId,
          sublocation_id: sublocationId,
          target_npc_id: numericTargetNpcId,
          last_active_at: new Date(),
          participants: {
            create: [
              {
                character_id: numericPlayerId,
                name: playerChar?.name || 'Player',
                role: DIALOGUE_PARTICIPANT_ROLE.PLAYER
              },
              {
                character_id: numericTargetNpcId,
                name: targetChar?.name || 'NPC',
                role: DIALOGUE_PARTICIPANT_ROLE.NPC
              }
            ]
          }
        },
        include: {
          participants: true,
          messages: true
        }
      });
    }

    const existingAmbient = await db.dialogue_sessions.findFirst({
      where: {
        player_id: numericPlayerId,
        session_type: resolvedType,
        status: DIALOGUE_SESSION_STATUS.ACTIVE,
        sublocation_id: sublocationId ?? null
      },
      include: {
        participants: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: DIALOGUE_HISTORY_LIMIT
        }
      },
      orderBy: { updated_at: 'desc' }
    });

    if (existingAmbient) {
      return existingAmbient;
    }

    const playerChar = await db.characters.findUnique({
      where: { id: numericPlayerId },
      select: { id: true, name: true }
    });

    return await db.dialogue_sessions.create({
      data: {
        player_id: numericPlayerId,
        session_type: resolvedType,
        status: DIALOGUE_SESSION_STATUS.ACTIVE,
        location_id: locationId,
        sublocation_id: sublocationId,
        last_active_at: new Date(),
        participants: {
          create: [
            {
              character_id: numericPlayerId,
              name: playerChar?.name || 'Player',
              role: DIALOGUE_PARTICIPANT_ROLE.PLAYER
            }
          ]
        }
      },
      include: {
        participants: true,
        messages: true
      }
    });
  } catch (error) {
    throw databaseError('getOrCreateDialogueSession', 'open dialogue session', error);
  }
}

export async function recordDialogueTurn({
  sessionId,
  messages = [],
  customPrisma = null
}) {
  const db = customPrisma || prisma;
  try {
    const numericSessionId = Number(sessionId);
    if (!numericSessionId || !Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    const createdMessages = [];
    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== 'string') continue;
      const created = await db.dialogue_messages.create({
        data: {
          session_id: numericSessionId,
          speaker_name: msg.speaker_name || 'Narrator',
          speaker_id: msg.speaker_id ? Number(msg.speaker_id) : null,
          message_type: msg.message_type || DIALOGUE_MESSAGE_TYPE.SPEECH,
          content: msg.content
        }
      });
      createdMessages.push(created);
    }

    await db.dialogue_sessions.update({
      where: { id: numericSessionId },
      data: { last_active_at: new Date() }
    });

    return createdMessages;
  } catch (error) {
    throw databaseError('recordDialogueTurn', 'record dialogue turn', error);
  }
}

export async function getRecentDialogueMessages(sessionId, limit = ROLEPLAY_HISTORY_MESSAGES, customPrisma = null) {
  const db = customPrisma || prisma;
  const numericSessionId = Number(sessionId);
  if (!numericSessionId || !db?.dialogue_messages?.findMany) return [];
  try {
    const messages = await db.dialogue_messages.findMany({
      where: { session_id: numericSessionId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: Number(limit) || ROLEPLAY_HISTORY_MESSAGES,
      select: { speaker_name: true, speaker_id: true, message_type: true, content: true }
    });
    return messages.reverse();
  } catch (error) {
    throw databaseError('getRecentDialogueMessages', 'read recent dialogue messages', error);
  }
}

export async function closeLocationDialogueSessions(playerId, newSublocationId = null, customPrisma = null, { choice = DIALOGUE_LEAVE_CHOICE.PAUSE, leaveLocation = false } = {}) {
  const db = customPrisma || prisma;
  try {
    const sessions = await db.dialogue_sessions.findMany({
      where: { player_id: Number(playerId), status: DIALOGUE_SESSION_STATUS.ACTIVE, ...leftSessionCondition(newSublocationId, leaveLocation) },
      select: SESSION_NPC_SELECT
    });
    const ambient = sessions.filter((session) => session.session_type !== DIALOGUE_SESSION_TYPE.DIRECT);
    const direct = sessions.filter((session) => session.session_type === DIALOGUE_SESSION_TYPE.DIRECT);
    const closeDirect = normalizeDialogueLeaveChoice(choice) === DIALOGUE_LEAVE_CHOICE.CLOSE;
    const closed = await closeSessions(db, closeDirect ? sessions : ambient);
    let paused = [];
    if (!closeDirect && direct.length) {
      await db.dialogue_sessions.updateMany({
        where: { id: { in: direct.map((session) => session.id) }, status: DIALOGUE_SESSION_STATUS.ACTIVE },
        data: { status: DIALOGUE_SESSION_STATUS.PAUSED, last_active_at: new Date() }
      });
      paused = direct.map(sessionSummary);
    }
    const visible = (list) => list.filter((session) => session.npcId && session.messageCount > 0);
    return { paused: visible(paused), closed: visible(closed) };
  } catch (error) {
    throw databaseError('closeLocationDialogueSessions', 'pause dialogue sessions on leave', error);
  }
}
