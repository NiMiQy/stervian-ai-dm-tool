import express from 'express';
import { getUserActiveParty } from '../../containers/partyContainer.js';
import { getCharacterSheet } from '../../containers/characterContainer.js';
import { ObserveError, normalizeObserveRequest, runObserveScene, saveObserveMemories, saveObserveStory } from '../../containers/observeContainer.js';
import { isMultiplayerParty } from '../../services/partyTurnService.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from '../middleware.js';
import { requireAiApiKey } from '../../services/ai/aiRequestContext.js';
import { HTTP_STATUS, NUMERIC_ID_PATTERN } from '../../configs/constants.js';

const router = express.Router();

router.post('/:id/observe', requireAiApiKey, async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    const observeRequest = normalizeObserveRequest(request.body || {});

    const partyInfo = await getUserActiveParty(session.user_id);
    const party = partyInfo?.party || null;
    if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
      return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Only the party leader can take actions while in a party.' });
    }
    if (isMultiplayerParty(party)) {
      return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Observe uses your own turn. It is not available in party turn mode.' });
    }

    const character = await getCharacterSheet(session.user_id);
    if (!character) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });

    const history = Array.isArray(request.body?.history) ? request.body.history : [];
    const scene = await runObserveScene({ userId: session.user_id, character, request: observeRequest, history });
    if (!scene.story) return response.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ error: 'The Dungeon Master could not write the observed scene.' });

    let storyId = null;
    try {
      const saved = await saveObserveStory({ userId: session.user_id, character, label: scene.label, story: scene.story });
      storyId = saved?.id || null;
    } catch (saveError) {
      console.warn('[observe] Failed to save the observed scene:', saveError.message);
    }

    saveObserveMemories({ model: scene.model, npcA: scene.npcA, npcB: scene.npcB, story: scene.story, nsfwAllowed: scene.nsfwAllowed })
      .catch((memoryError) => console.warn('[observe] Memory worker warning:', memoryError.message));

    return response.status(HTTP_STATUS.OK).json({
      success: true,
      action: scene.label,
      story: scene.story,
      character,
      storyId,
      observe: {
        npcA: { id: scene.npcA.id, name: scene.npcA.name },
        npcB: { id: scene.npcB.id, name: scene.npcB.name },
        repeatCount: observeRequest.repeat,
        beats: scene.beats
      }
    });
  } catch (error) {
    if (error instanceof ObserveError) return response.status(error.statusCode).json({ error: error.message });
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to run the observed scene.') });
  }
});

export default router;
