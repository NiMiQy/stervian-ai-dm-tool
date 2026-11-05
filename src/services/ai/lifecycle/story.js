import prisma from '../../prismaClient.js';
import { createStoryTurn, linkStoryDialogueMessages } from '../../storyService.js';
import { toStoredFateCheck } from '../../../containers/core/fateRules.js';
import { toStoredSkillCheck } from '../../../containers/core/skillCheckRules.js';
import { closeDialogueSessionById, isFarewellMessage, recordDialogueTurn } from '../../../containers/dialogueContainer.js';
import { DIALOGUE_MESSAGE_TYPE, DIALOGUE_SESSION_TYPE } from '../../../configs/constants.js';

export async function interceptCombatEncounter(context) {
  if (context?.finalState?.encounter) {
    context.encounter = context.finalState.encounter;
    return context;
  }

  if (Array.isArray(context?.toolExecutions)) {
    for (const exec of context.toolExecutions) {
      if (exec.output) {
        try {
          const parsed = typeof exec.output === 'string' ? JSON.parse(exec.output) : exec.output;
          if (parsed?.triggered && parsed?.encounter) {
            context.encounter = parsed.encounter;
            break;
          }
        } catch {}
      }
    }
  }

  return context;
}

/**
 * Hook 3.2: persistStoryTurnToDb
 * Persists the generated story turn to the database for the active character.
 */
export async function persistStoryTurnToDb(context) {
  const storyText = context.finalStory || context.story || '';
  const charId = context.character?.id || context.characterId;
  const uId = context.userId || context.character?.user_id;

  if (storyText && charId && uId) {
    try {
      const db = context.customPrisma || context.db || prisma;
      if (db?.stories?.create) {
        const savedTurn = await db.stories.create({
          data: {
            user_id: uId,
            character_id: Number(charId),
            action_from_player: String(context.cleanAction || context.actionText || '').trim(),
            story: storyText,
            location_id: context.character?.location_id ?? null,
            sublocation_id: context.character?.sublocation_id ?? null,
            ...(context.partyTurnDisplay?.length ? { party_turn: context.partyTurnDisplay } : {}),
            ...(context.fateCheck ? { fate_check: toStoredFateCheck(context.fateCheck) } : {}),
            ...(context.skillCheck ? { skill_check: toStoredSkillCheck(context.skillCheck) } : {})
          }
        });
        if (savedTurn?.id) {
          context.storyId = savedTurn.id;
        }
      } else if (!context.customPrisma && !context.db) {
        // Only call real database createStoryTurn if no custom/mock Prisma client was provided
        const savedTurn = await createStoryTurn({
          userId: uId,
          characterId: Number(charId),
          actionFromPlayer: String(context.cleanAction || context.actionText || '').trim(),
          story: storyText,
          locationId: context.character?.location_id ?? null,
          sublocationId: context.character?.sublocation_id ?? null,
          partyTurn: context.partyTurnDisplay || null,
          fateCheck: context.fateCheck ? toStoredFateCheck(context.fateCheck) : null,
          skillCheck: context.skillCheck ? toStoredSkillCheck(context.skillCheck) : null
        });

        if (savedTurn?.id) {
          context.storyId = savedTurn.id;
        }
      }

      if (context.dialogueSession?.id) {
        try {
          const playerName = context.character?.name || 'Player';
          const targetName = context.targetNpc?.character?.name || context.targetNpc?.name || 'DM';
          const targetId = context.targetNpc ? (context.targetNpc.character_id || context.targetNpc.character?.id || context.targetNpc.id) : null;
          const recordedMessages = await recordDialogueTurn({
            sessionId: context.dialogueSession.id,
            messages: [
              {
                speaker_name: playerName,
                speaker_id: Number(charId),
                message_type: DIALOGUE_MESSAGE_TYPE.ACTION,
                content: String(context.cleanAction || context.actionText || '').trim()
              },
              {
                speaker_name: targetName,
                speaker_id: targetId ? Number(targetId) : null,
                message_type: DIALOGUE_MESSAGE_TYPE.NARRATION,
                content: storyText
              }
            ],
            customPrisma: db
          });
          if (context.storyId && recordedMessages.length) {
            const link = await linkStoryDialogueMessages(context.storyId, context.dialogueSession.id, recordedMessages.map((message) => message.id), db);
            context.dialogueSessionId = link.dialogue_session_id;
            context.dialogueMessageIds = link.dialogue_message_ids;
          }
          if (targetId && context.dialogueSession.session_type === DIALOGUE_SESSION_TYPE.DIRECT && isFarewellMessage(context.cleanAction || context.actionText)) {
            const [closedSession] = await closeDialogueSessionById(context.dialogueSession.id, db);
            if (closedSession) context.dialogueClosed = { npcId: closedSession.npcId, npcName: closedSession.npcName || targetName };
          }
        } catch (dialogueRecordErr) {
          console.warn('[LifecycleHook:persistStoryTurnToDb] Warning: failed to record dialogue turn:', dialogueRecordErr.message);
        }
      }
    } catch (err) {
      console.warn('[LifecycleHook:persistStoryTurnToDb] Warning: failed to persist story turn:', err.message);
    }
  }

  return context;
}

// ============================================================================
