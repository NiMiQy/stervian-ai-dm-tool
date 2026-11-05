import { createStoryTurn } from '../services/storyService.js';

export async function persistActionStoryTurns({ result, action, party, userId, partyTurn = null, fateCheck = null, skillCheck = null, saveStoryTurn = createStoryTurn }) {
  const leaderCharacterId = result.character.id;
  const members = party && Array.isArray(party.members) && party.members.length > 1
    ? party.members.filter((member) => member.character_id && member.user_id && member.is_player)
    : [{ user_id: userId, character_id: leaderCharacterId }];

  if (!members.some((member) => member.character_id === leaderCharacterId)) {
    members.unshift({ user_id: userId, character_id: leaderCharacterId });
  }

  const savedTurns = await Promise.all(members
    .filter((member) => !(result.storyId && member.character_id === leaderCharacterId))
    .map((member) => saveStoryTurn({
      userId: member.user_id,
      characterId: member.character_id,
      actionFromPlayer: action.trim(),
      story: result.story,
      locationId: result.character.location_id ?? null,
      sublocationId: result.character.sublocation_id ?? null,
      partyTurn,
      fateCheck,
      skillCheck
    }).catch((error) => {
      console.warn(`Failed to persist story turn for character ${member.character_id}:`, error?.message || error);
      return null;
    })));

  const leaderTurn = savedTurns.find((turn) => turn?.character_id === leaderCharacterId);
  if (!result.storyId && leaderTurn?.id) result.storyId = leaderTurn.id;
  return savedTurns;
}
