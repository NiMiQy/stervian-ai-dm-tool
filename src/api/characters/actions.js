import express from 'express';
import { getUserActiveParty } from '../../containers/partyContainer.js';
import openAiDeepseekService from '../../services/openaiDeepseekService.js';
import { persistActionStoryTurns } from '../../containers/actionStoryContainer.js';
import { applyFateCheckChaos, consumePendingFateCheck, toStoredFateCheck } from '../../services/fateCheckService.js';
import { attachSecretReveal, canRevealSecret, consumePendingSkillCheck, toStoredSkillCheck } from '../../services/skillCheckService.js';
import { normalizeCheckOrder } from '../../containers/core/skillCheckRules.js';
import { previewContextCheck } from '../../services/contextCheckService.js';
import { PlayerToolError, normalizePlayerTools } from '../../services/playerToolService.js';
import { broadcastToUsers } from '../../services/webSocketService.js';
import prisma from '../../services/prismaClient.js';
import { getNearbyNpcs } from '../../containers/npcContainer.js';
import { revealRealName } from '../../services/npcIdentityService.js';
import { PartyTurnError, applyPartyReveals, buildPartyTurn, buildPartyTurnDisplay, fillRevealTexts, formatPartyTurnAction, isMultiplayerParty, normalizePartyActions, resolvePartyLabels } from '../../services/partyTurnService.js';
import { databaseFailureMessage, requireOutOfCombat, requireSession } from '../middleware.js';
import { requireAiApiKey } from '../../services/ai/aiRequestContext.js';
import { ACTION_MODES, HTTP_STATUS, NUMERIC_ID_PATTERN, PARTY_TURN, PLAYER_TOOLS_NEEDING_TARGET, VALID_ACTION_MODES, WEBSOCKET_EVENTS } from '../../configs/constants.js';

const router = express.Router();

router.post('/:id/context-check', async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only view your own context.' });
  const actionMode = request.body?.actionMode || ACTION_MODES.STORY;
  if (!VALID_ACTION_MODES.includes(actionMode)) {
    return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Action mode must be story.' });
  }
  try {
    const targetNpcId = request.body?.targetNpcId ? Number(request.body.targetNpcId) : null;
    const report = await previewContextCheck({
      userId: session.user_id,
      characterId: session.id,
      actionText: request.body?.action,
      actionMode,
      targetNpcId,
      history: Array.isArray(request.body?.history) ? request.body.history : []
    });
    return response.status(report.error ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.OK).json(report);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to check AI context.') });
  }
});

router.post('/:id/action', requireAiApiKey, async (request, response) => {
  if (!NUMERIC_ID_PATTERN.test(request.params.id)) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
  const session = requireSession(request, response);
  if (!session) return;
  if (session.id !== Number(request.params.id)) return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You can only manage your own character.' });
  if (!await requireOutOfCombat(session, response)) return;
  try {
    let action = request.body?.action;
    const partyPayload = request.body?.partyTurn || null;
    const actionMode = request.body?.actionMode || ACTION_MODES.STORY;
    const targetNpcId = request.body?.targetNpcId ? Number(request.body.targetNpcId) : null;
    const history = Array.isArray(request.body?.history) ? request.body.history : [];
    if (!partyPayload && (!action || typeof action !== 'string' || !action.trim())) {
      return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Action text cannot be empty.' });
    }
    if (!VALID_ACTION_MODES.includes(actionMode)) {
      return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Action mode must be story.' });
    }

    const partyInfo = await getUserActiveParty(session.user_id);
    const party = partyInfo?.party || null;
    if (party && Array.isArray(party.members) && party.members.length > 1 && !party.is_leader) {
      return response.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Only the party leader can take actions while in a party.' });
    }

    let fateCheck = null;
    if (request.body?.fateCheckId) {
      if (partyPayload) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Fate checks cannot be combined with a party turn.' });
      fateCheck = consumePendingFateCheck(session.id, String(request.body.fateCheckId));
      if (!fateCheck) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'That fate check has expired. Request a new fate check.' });
    }

    let skillCheck = null;
    if (request.body?.skillCheckId) {
      if (partyPayload) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Skill checks cannot be combined with a party turn.' });
      skillCheck = consumePendingSkillCheck(session.id, String(request.body.skillCheckId));
      if (!skillCheck) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'That skill check has expired. Roll a new skill check.' });
      skillCheck.order = fateCheck ? normalizeCheckOrder(request.body?.checkOrder) : null;
      if (targetNpcId && canRevealSecret(skillCheck)) {
        const nearby = await getNearbyNpcs(session.user_id);
        const npc = nearby.find((entry) => entry.id === targetNpcId);
        if (npc) skillCheck = await attachSecretReveal({ skillCheck, npc: { id: npc.id, name: npc.name }, playerCharacterId: session.id });
      }
    }

    let playerTools = [];
    if (request.body?.playerTools !== undefined && request.body?.playerTools !== null) {
      if (partyPayload) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Tool calls cannot be combined with a party turn.' });
      try {
        playerTools = normalizePlayerTools(request.body.playerTools, { targetNpcId });
      } catch (error) {
        if (error instanceof PlayerToolError) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: error.message });
        throw error;
      }
      if (targetNpcId && playerTools.some((entry) => PLAYER_TOOLS_NEEDING_TARGET.includes(entry.tool))) {
        const nearby = await getNearbyNpcs(session.user_id);
        if (!nearby.some((entry) => entry.id === targetNpcId)) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'That NPC is not here.' });
      }
    }

    let partyTurn = null;
    if (partyPayload && isMultiplayerParty(party)) {
      const leader = await prisma.characters.findUnique({ where: { user_id: session.user_id }, select: { id: true, name: true, location_id: true, sublocation_id: true } });
      if (!leader) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
      try {
        partyTurn = buildPartyTurn({ leaderCharacter: leader, party, partyId: partyPayload.partyId, actions: normalizePartyActions(partyPayload.actions) });
      } catch (error) {
        if (error instanceof PartyTurnError) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: error.message });
        throw error;
      }
      let targetNpc = null;
      if (targetNpcId) {
        const nearby = await getNearbyNpcs(session.user_id);
        targetNpc = nearby.find((entry) => entry.id === targetNpcId) || null;
        if (!targetNpc) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'That NPC is not here.' });
      }
      if (partyTurn.speakers.some((speaker) => speaker.revealName) && !targetNpc) {
        return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: PARTY_TURN.REVEAL_TARGET_ERROR });
      }
      fillRevealTexts(partyTurn, targetNpc?.name);
      await resolvePartyLabels(prisma, partyTurn, targetNpc?.id || null);
      partyTurn.display = buildPartyTurnDisplay(partyTurn);
      partyTurn.revealResults = targetNpc ? await applyPartyReveals(prisma, { partyTurn, party, npc: { id: targetNpc.id, name: targetNpc.name } }) : [];
      action = formatPartyTurnAction(partyTurn);
    } else if (partyPayload) {
      return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: PARTY_TURN.NOT_LEADER_ERROR });
    }

    let revealResult = null;
    const revealNpcId = request.body?.revealNpcId ? Number(request.body.revealNpcId) : null;
    if (revealNpcId && !partyTurn) {
      if (!Number.isInteger(revealNpcId) || revealNpcId <= 0 || revealNpcId !== targetNpcId) {
        return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Select the NPC you want to reveal your real name to.' });
      }
      const nearby = await getNearbyNpcs(session.user_id);
      const npc = nearby.find((entry) => entry.id === revealNpcId);
      if (!npc) return response.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'That NPC is not here.' });
      const player = await prisma.characters.findUnique({ where: { user_id: session.user_id }, select: { id: true, name: true, location_id: true, sublocation_id: true } });
      if (!player) return response.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Character not found.' });
      revealResult = await revealRealName(prisma, { player, party, npc: { id: npc.id, name: npc.name } });
    }

    const result = await openAiDeepseekService.processPlayerAction(session.user_id, session.id, action, history, request.body?.includeContextCheck === true, actionMode, targetNpcId, revealResult, partyTurn, fateCheck, skillCheck, playerTools);
    if (result.error) return response.status(HTTP_STATUS.BAD_REQUEST).json(result);

    if (result.story && result.character?.id) {
      await persistActionStoryTurns({ result, action, party, userId: session.user_id, partyTurn: partyTurn?.display || null, fateCheck: toStoredFateCheck(fateCheck), skillCheck: toStoredSkillCheck(skillCheck) });
      if (party && Array.isArray(party.members) && party.members.length > 1) {
        const otherMemberUserIds = party.members
          .filter((member) => member.user_id && member.user_id !== session.user_id && member.is_player)
          .map((member) => member.user_id);
        if (otherMemberUserIds.length > 0) {
          broadcastToUsers(otherMemberUserIds, WEBSOCKET_EVENTS.PARTY_STORY_TURN, {
            action: action.trim(),
            story: result.story,
            leaderName: result.character.name || party.members.find((member) => member.is_leader)?.name || 'Party Leader',
            leaderCharacterId: result.character.id,
            storyId: result.storyId || null,
            partyTurn: partyTurn?.display || null,
            choices: result.choices || [],
            timestamp: Date.now()
          });
        }
      }
    }

    if (fateCheck && result.story) {
      const chaosScene = await applyFateCheckChaos(session.id, fateCheck);
      result.fateCheck = { ...toStoredFateCheck(fateCheck), chaosFactorAfter: chaosScene?.chaos_factor ?? fateCheck.chaosFactor };
    }
    if (skillCheck && result.story) result.skillCheck = toStoredSkillCheck(skillCheck);
    return response.status(HTTP_STATUS.OK).json(partyTurn ? { ...result, partyTurn: partyTurn.display } : result);
  } catch (error) {
    return response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: databaseFailureMessage(error, 'Unable to process your action with the Dungeon Master.') });
  }
});

export default router;
