import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createHarnessChatModel } from '../agentHarness/model.js';
import { extractJsonObject } from '../../../components/helpers/jsonParser.js';
import { invokeWithResponseLog } from '../../../logs/responseLogger.js';
import { MEMORY_TYPE } from '../../../configs/constants.js';

const MEMORY_TYPE_GUIDANCE = {
  [MEMORY_TYPE.SEMANTIC]: 'a SEMANTIC memory: the lasting facts and knowledge the NPC took away (who the person is to them, what is true, what they know now), not a play-by-play.',
  [MEMORY_TYPE.EPISODIC]: 'an EPISODIC memory: what happened, in order, as the NPC lived it, with their impression of the person.',
  [MEMORY_TYPE.SECRET]: 'a SECRET memory: something the NPC keeps to themselves and would not share openly; write it as private knowledge or a hidden feeling.'
};

function nameRule(npcName, playerName, nameRevealed) {
  return nameRevealed
    ? `${npcName} knows the player character as "${playerName}".`
    : `${npcName} does NOT know the player character's real name and only knows them as "${playerName}". Refer to them only as "${playerName}" (or "they"). Never write, guess or invent any other name for them.`;
}

function fallbackMemory(npcName, playerName, payload) {
  const goals = payload.scenes_list.map((scene) => String(scene.content || '').split('\n')[0].replace(/^Goal:\s*/i, '').trim()).filter(Boolean);
  return `${npcName} remembers ${goals.length > 1 ? 'these matters' : 'this matter'} involving ${playerName}: ${goals.join('; ')}.`;
}

export async function sceneMemorySummarySubagent({ npcName, playerName, nameRevealed = false, payload, modelInstance = null, logName = null }) {
  const guidance = MEMORY_TYPE_GUIDANCE[payload.memory_type] || MEMORY_TYPE_GUIDANCE[MEMORY_TYPE.EPISODIC];
  const prompt = `### Scene Memory Summary Subagent
Turn these story scenes into ONE memory for the NPC "${npcName}" about the player character "${playerName}".

Input (JSON):
${JSON.stringify(payload)}

Rules:
- Write from ${npcName}'s first-person perspective, as ${guidance}
- Merge all scenes in scenes_list into a single memory of one to four sentences. Keep concrete facts: goals, outcomes, promises, deals, revealed facts, and ${npcName}'s impression of ${playerName}.
- A scene with "Stage: abandoned" was left unfinished; a scene with "Stage: solved" was completed.
- Only use what the scenes say. Do not invent events, names, items or rewards.
- ${nameRule(npcName, playerName, nameRevealed)}
${payload.is_nsfw ? '- The scenes are adult content; keep the memory factual and you may keep adult details that matter.' : '- Keep the memory free of sexual content.'}

Return a single-line minified JSON object:
{"memory":"The memory text"}`;

  try {
    const model = modelInstance || createHarnessChatModel();
    const response = await invokeWithResponseLog(model, [
      new SystemMessage({ content: 'You are an RPG memory subagent. Output only valid JSON.' }),
      new HumanMessage({ content: prompt })
    ], { agent: 'Subagent: Scene Memory Summary', logName: logName || npcName, extra: { NPC: npcName, 'Memory type': payload.memory_type, Scenes: payload.scenes_list.map((scene) => scene.id).join(', ') } });
    const parsed = extractJsonObject(String(response.content || response.additional_kwargs?.reasoning_content || '').trim());
    const memory = String(parsed?.memory || '').trim();
    if (memory) return { memory, isFallback: false };
    throw new Error('Scene summary returned no memory text.');
  } catch (error) {
    console.warn(`[sceneMemorySummarySubagent] Falling back for ${npcName}:`, error.message);
    return { memory: fallbackMemory(npcName, playerName, payload), isFallback: true };
  }
}
