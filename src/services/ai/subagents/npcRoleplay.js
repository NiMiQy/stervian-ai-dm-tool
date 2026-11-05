import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { RELATIONSHIP_STATUS } from './relationships.js';
import { extractJsonObject } from '../../../components/helpers/jsonParser.js';
import { invokeWithResponseLog } from '../../../logs/responseLogger.js';
import { AGENT_PIPELINE, NPC_ROLE } from '../../../configs/constants.js';
import { NSFW_ROLEPLAY_SECTION } from '../prompts/prompt_constant.js';

function formatSceneContext(sceneContext) {
  if (!sceneContext?.story) return '';
  const scene = sceneContext.story.split(AGENT_PIPELINE.NPC_SLOT_TOKEN).join('>>> YOUR TURN: you speak and act here <<<');
  return [
    '### The Scene So Far (written by the narrator)',
    scene,
    '### Your Beat (follow it exactly)',
    sceneContext.beat || 'React in character to what just happened.',
    '- Perform ONLY at YOUR TURN: your own spoken words and your own physical action. Follow the beat\'s outcome; choose your own words and gestures.',
    '- Do not narrate the room, other people, or what happens after your turn. Do not repeat actions already written in the scene.',
    '- "dialogue" holds ONLY your spoken words in double quotes, with no narration or gestures between them. Put every gesture, look and movement in "bodyLanguage".',
  ].join('\n');
}

function formatPartyLinesIdentity(partyLines) {
  return [
    '- You are facing a GROUP of travellers. You know each of them ONLY by the label below. A "Stranger" label means they never told you a name: address them as a stranger, never by that label or any name.',
    ...partyLines.map((line) => `- ${line.label}: relationship ${line.relationshipStatus || RELATIONSHIP_STATUS.STRANGER}${line.nameRevealed ? ' (you know their real name)' : ''}.`),
  ].join('\n');
}

function formatPartyLinesAction(partyLines) {
  return [
    '### What Each Member Of The Group Says Or Does Towards You:',
    ...partyLines.map((line) => `- ${line.label}: ${line.text ? `"${line.text}"` : 'stays quiet.'}`),
    'React to the WHOLE group in ONE reply. You may answer several of them in your dialogue, each by the name you know them by. Never use a name you were not told.',
  ].join('\n');
}

function formatRecentDialogue(recentDialogue) {
  if (!Array.isArray(recentDialogue) || !recentDialogue.length) return '';
  return [
    '\n### Recent Conversation (oldest → newest)',
    ...recentDialogue,
    '- Stay consistent with what you already said, offered or promised above. Do not repeat earlier lines word for word.'
  ].join('\n');
}

function buildNpcRoleplayPrompt({
  npcName,
  npcRole = NPC_ROLE.WORLD_NPC,
  race = 'Human',
  job = 'Citizen',
  alignment = 'Neutral',
  appearance = '',
  description = '',
  relationshipStatus = RELATIONSHIP_STATUS.STRANGER,
  playerNameRevealed = false,
  playerKnownName = null,
  memories = [],
  locationContext = '',
  playerAction = '',
  knownNpcs = [],
  knownPlaces = [],
  partyLines = null,
  recentDialogue = [],
  checkedFacts = '',
  sceneContext = null
}) {
  const roleGuidance = npcRole === NPC_ROLE.COMPANION
    ? 'You are an ACTIVE ADVENTURING PARTY COMPANION traveling alongside the player. Offer tactical advice, friendly banter, or caution, but NEVER dictate the player character\'s actions.'
    : npcRole === NPC_ROLE.HOSTILE_ENEMY
    ? 'You are a HOSTILE ADVERSARY or ENEMY. React with grim menace, sharp warnings, arrogant demands, or vicious snarls.'
    : 'You are a WORLD NPC residing or stationed in this location (e.g. guard, merchant, innkeeper, commoner). Fulfill your duty, defend your post, or barter fairly, influenced by your attitude towards the player.';

  const memoriesSection = memories.length
    ? `\nMemories of past encounters with player:\n${memories.map((m) => `* ${m}`).join('\n')}`
    : '';

  const knownNpcsSection = knownNpcs.length
    ? `\n### Known Acquaintances & Social Ties [DSL]:\n${knownNpcs.map((n) => typeof n === 'string' ? n : `RELATION: ${n.name} (${n.relationshipType})${n.contextNote ? `: ${n.contextNote}` : ''}`).join('\n')}`
    : '';

  const knownPlacesSection = knownPlaces.length
    ? `\n### Known Landmarks & Geography [DSL]:\n${knownPlaces.map((p) => typeof p === 'string' ? p : `LANDMARK: ${p.name} (${p.knowledgeType})${p.opinionNote ? `: ${p.opinionNote}` : ''}`).join('\n')}`
    : '';

  const strangerGuidance = relationshipStatus === RELATIONSHIP_STATUS.STRANGER
    ? '\n- Note on Stranger: The player character is an unfamiliar stranger to you. You do not recognize them and do not know their motives. Respond with appropriate initial reserve, formal distance, or stranger curiosity.'
    : '';

  return `### Roleplay Subagent - In-Character Persona Directives:
You are the dedicated actor for the character: "${npcName}".
- Race: ${race} | Profession: ${job} | Alignment: ${alignment}
- Role: ${npcRole} (${roleGuidance})
${appearance ? `- Appearance: ${appearance}` : ''}
${description ? `- Personality & Background: ${description}` : ''}
- Current Location: ${locationContext || 'Stervian Land'}
- Relationship Status: ${relationshipStatus}${strangerGuidance}
${partyLines ? formatPartyLinesIdentity(partyLines) : playerKnownName ? `- You know the player as "${playerKnownName}"${playerNameRevealed ? '' : ' (the name they told you; you believe it is true)'}. Address them by that name only. You know no other name for them.` : '- You have never been told the player\'s name. Address them only as a stranger, adventurer, wanderer, or guest. Do not infer or reveal a name from memories.'}
${knownNpcsSection}
${knownPlacesSection}
${memoriesSection}
${formatRecentDialogue(recentDialogue)}
${checkedFacts ? `\n${checkedFacts}` : ''}

${formatSceneContext(sceneContext)}
${partyLines ? formatPartyLinesAction(partyLines) : `### Player's Declared Action Towards You:\n"${playerAction}"`}

### Response Format Requirements:
Return a single-line minified JSON object matching this schema:
{"dialogue":"Spoken direct dialogue in quotation marks","bodyLanguage":"Physical motion and posture","emotion":"Dominant emotion","attitude":"Short attitude description"}

Do NOT wrap in markdown codeblocks if possible. Return raw minified JSON only.`;
}

/**
 * Invokes the NPC Roleplay Subagent to generate in-character dialogue and body language.
 */
export async function npcRoleplaySubagent({
  npcName,
  logName = null,
  npcRole = NPC_ROLE.WORLD_NPC,
  race = 'Human',
  job = 'Citizen',
  alignment = 'Neutral',
  appearance = '',
  description = '',
  relationshipStatus = RELATIONSHIP_STATUS.STRANGER,
  playerNameRevealed = false,
  playerKnownName = null,
  memories = [],
  locationContext = '',
  playerAction = '',
  knownNpcs = [],
  knownPlaces = [],
  partyLines = null,
  recentDialogue = [],
  checkedFacts = '',
  sceneContext = null,
  nsfwAllowed = false,
  modelInstance = null
}) {
  const prompt = buildNpcRoleplayPrompt({
    npcName,
    npcRole,
    race,
    job,
    alignment,
    appearance,
    description,
    relationshipStatus,
    playerNameRevealed,
    playerKnownName,
    memories,
    locationContext,
    playerAction,
    knownNpcs,
    knownPlaces,
    partyLines,
    recentDialogue,
    checkedFacts,
    sceneContext
  });

  if (modelInstance && typeof modelInstance.invoke === 'function') {
    try {
      const response = await invokeWithResponseLog(modelInstance, [
        new SystemMessage({ content: ['You are an authentic dark-fantasy roleplay subagent for an RPG NPC.', nsfwAllowed ? NSFW_ROLEPLAY_SECTION.trim() : ''].filter(Boolean).join('\n\n') }),
        new HumanMessage({ content: prompt })
      ], { agent: 'Subagent: NPC Roleplay', logName: logName || npcName, extra: { NPC: npcName } });

      const raw = String(response.content || response.additional_kwargs?.reasoning_content || '').trim();
      const parsed = extractJsonObject(raw);

      if (!parsed) {
        throw new Error(`Failed to extract valid JSON from LLM output (finish_reason: ${response.response_metadata?.finish_reason || 'unknown'})`);
      }

      return {
        success: true,
        npcName,
        dialogue: parsed.dialogue || `"${npcName} eyes you in silence."`,
        bodyLanguage: parsed.bodyLanguage || `${npcName} shifts their weight cautiously.`,
        emotion: parsed.emotion || 'guarded',
        attitude: parsed.attitude || relationshipStatus
      };
    } catch (err) {
      console.warn(`npcRoleplaySubagent LLM call failed for ${npcName}, using fallback:`, err.message);
    }
  }

  // Deterministic fallback for tests, offline mode, or network disruptions
  return generateDeterministicNpcRoleplay({
    npcName,
    npcRole,
    job,
    relationshipStatus,
    playerAction,
    knownPlaces,
    knownNpcs
  });
}

function formatObserveRelationship(otherNpcName, relationship) {
  if (!relationship) return `- You have no recorded relationship with ${otherNpcName}. Treat them as any acquaintance you would meet at this place.`;
  return `- ${otherNpcName} is linked to you as: ${relationship.type}.${relationship.note ? `\n- Your own private view of them: ${relationship.note}` : ''}`;
}

function buildNpcObservePrompt({
  npcName,
  race = 'Human',
  job = 'Citizen',
  alignment = 'Neutral',
  appearance = '',
  description = '',
  otherNpcName,
  relationship = null,
  memories = [],
  locationContext = '',
  sceneSoFar = '',
  previousLine = '',
  beatIntent = '',
  beatNumber = 1,
  totalBeats = 1
}) {
  const memoriesSection = memories.length
    ? `\n### Your Memories Of ${otherNpcName}\n${memories.map((memory) => `* ${memory}`).join('\n')}`
    : '';
  return `### Roleplay Subagent - In-Character Persona Directives (NPC to NPC):
You are the dedicated actor for the character: "${npcName}". In this scene you are talking with ${otherNpcName}, not with the player.
- Race: ${race} | Profession: ${job} | Alignment: ${alignment}
${appearance ? `- Appearance: ${appearance}` : ''}
${description ? `- Personality & Background: ${description}` : ''}
- Current Location: ${locationContext || 'Stervian Land'}

### Your Relationship With ${otherNpcName}
${formatObserveRelationship(otherNpcName, relationship)}
${memoriesSection}

### The Scene So Far
${sceneSoFar || '(The exchange is about to begin.)'}
>>> YOUR TURN: you speak and act here <<<

### What ${otherNpcName} Just Said Or Did
${previousLine || `Nothing yet: you open this exchange with ${otherNpcName}.`}

### Your Beat (${beatNumber} of ${totalBeats})
${beatIntent || `React in character to ${otherNpcName}.`}
- Speak and act ONLY as ${npcName}. React directly to what ${otherNpcName} just said or did. Do not write ${otherNpcName}'s words or actions, the room, or what happens after your turn.
- Express the beat in your own authentic voice and physical gestures rather than repeating phrasing from the beat directive or from ${otherNpcName}'s lines.
- "dialogue" holds ONLY your spoken words in double quotes, one to three sentences, with no narration or gestures between them. Put every gesture, look and movement in "bodyLanguage" in present tense, starting with "${npcName}".

### Response Format Requirements:
Return a single-line minified JSON object matching this schema:
{"dialogue":"Spoken direct dialogue in quotation marks","bodyLanguage":"Physical motion and posture","emotion":"Dominant emotion","attitude":"Short attitude toward ${otherNpcName}"}

Do NOT wrap in markdown codeblocks if possible. Return raw minified JSON only.`;
}

export async function npcObserveRoleplaySubagent({ modelInstance = null, logName = null, nsfwAllowed = false, ...params }) {
  if (!modelInstance || typeof modelInstance.invoke !== 'function') {
    return { success: false, npcName: params.npcName, error: 'No model available for observe roleplay.' };
  }
  try {
    const prompt = buildNpcObservePrompt(params);
    const response = await invokeWithResponseLog(modelInstance, [
      new SystemMessage({ content: ['You are an authentic dark-fantasy roleplay subagent for an RPG NPC talking to another NPC. Output only valid JSON.', nsfwAllowed ? NSFW_ROLEPLAY_SECTION.trim() : ''].filter(Boolean).join('\n\n') }),
      new HumanMessage({ content: prompt })
    ], { agent: 'Subagent: NPC Roleplay (Observe)', logName: logName || params.npcName, extra: { NPC: params.npcName, 'Talking to': params.otherNpcName, Beat: `${params.beatNumber}/${params.totalBeats}` } });
    const raw = String(response.content || response.additional_kwargs?.reasoning_content || '').trim();
    const parsed = extractJsonObject(raw);
    if (!parsed || (!parsed.dialogue && !parsed.bodyLanguage)) {
      throw new Error(`Failed to extract valid JSON from LLM output (finish_reason: ${response.response_metadata?.finish_reason || 'unknown'})`);
    }
    return {
      success: true,
      npcName: params.npcName,
      dialogue: parsed.dialogue || '',
      bodyLanguage: parsed.bodyLanguage || '',
      emotion: parsed.emotion || '',
      attitude: parsed.attitude || ''
    };
  } catch (error) {
    return { success: false, npcName: params.npcName, error: error.message };
  }
}

function generateDeterministicNpcRoleplay({
  npcName,
  npcRole,
  job,
  relationshipStatus,
  playerAction,
  knownPlaces = [],
  knownNpcs = []
}) {
  const lowerAction = String(playerAction || '').toLowerCase();

  // If asking about places or directions
  if (lowerAction.includes('where') || lowerAction.includes('đâu') || lowerAction.includes('đường') || lowerAction.includes('quán') || lowerAction.includes('inn') || lowerAction.includes('dojo') || lowerAction.includes('tìm') || lowerAction.includes('directions')) {
    if (knownPlaces.length > 0) {
      const placesList = knownPlaces.map((p) => {
        const raw = typeof p === 'string' ? p : p.name;
        return raw.replace(/^LANDMARK:\s*/i, '').split(' (')[0];
      }).join(', ');
      return {
        success: true,
        npcName,
        dialogue: `"If you're seeking landmarks around here, I know of ${placesList}. Keep your eyes open."`,
        bodyLanguage: `${npcName} points a weathered finger towards the thoroughfare, gesturing along the road.`,
        emotion: 'informative',
        attitude: relationshipStatus === RELATIONSHIP_STATUS.FRIENDLY ? 'helpful guidance' : 'neutral direction'
      };
    }
  }

  // If asking about another person / NPC
  if (lowerAction.includes('who') || lowerAction.includes('ai') || lowerAction.includes('know') || lowerAction.includes('biết') || lowerAction.includes('gặp')) {
    if (knownNpcs.length > 0) {
      const npcsList = knownNpcs.map((n) => {
        const raw = typeof n === 'string' ? n : n.name;
        return raw.replace(/^RELATION:\s*/i, '').split(' (')[0];
      }).join(', ');
      return {
        success: true,
        npcName,
        dialogue: `"Around these parts, I am acquainted with ${npcsList}. Speak carefully if you cross their paths."`,
        bodyLanguage: `${npcName} glances around cautiously before speaking in a measured tone.`,
        emotion: 'cautious',
        attitude: 'guarded counsel'
      };
    }
  }

  if (npcRole === NPC_ROLE.HOSTILE_ENEMY) {
    return {
      success: true,
      npcName,
      dialogue: `"Step any closer, dog, and I will spill your guts across the stones!"`,
      bodyLanguage: `${npcName} draws a notched blade with a rasp of steel, muscles coiling in anticipation of slaughter.`,
      emotion: 'murderous',
      attitude: 'violently hostile'
    };
  }

  if (npcRole === NPC_ROLE.COMPANION) {
    if (lowerAction.includes('plan') || lowerAction.includes('where') || lowerAction.includes('what')) {
      return {
        success: true,
        npcName,
        dialogue: `"Keep your senses sharp. This road has taken more lives than the old wars."`,
        bodyLanguage: `${npcName} checks their gear buckle and glances towards the tree line, standing shoulder-to-shoulder with you.`,
        emotion: 'vigilant',
        attitude: 'comradely'
      };
    }
    return {
      success: true,
      npcName,
      dialogue: `"Right behind you. Whatever crawls out of the gloom, we meet it together."`,
      bodyLanguage: `${npcName} gives a firm nod, steadying their stance as they stay in lockstep with you.`,
      emotion: 'supportive',
      attitude: 'loyal'
    };
  }

  // Default: World NPC (e.g. Guard, merchant)
  if (job.toLowerCase().includes('guard') || npcName.toLowerCase().includes('guard')) {
    return {
      success: true,
      npcName,
      dialogue: relationshipStatus === RELATIONSHIP_STATUS.STRANGER
        ? `"Halt, stranger. You are unfamiliar in these parts—state your name and business."`
        : `"Halt there, traveler. State your business before you pass beyond the wardens' gate."`,
      bodyLanguage: `${npcName} lowers their spear slightly, resting an armored gauntlet on the shaft while surveying you intently.`,
      emotion: relationshipStatus === RELATIONSHIP_STATUS.FRIENDLY ? 'welcoming' : 'cautious vigilance',
      attitude: relationshipStatus === RELATIONSHIP_STATUS.FRIENDLY ? 'friendly guard' : (relationshipStatus === RELATIONSHIP_STATUS.STRANGER ? 'stranger vigilance' : 'stern duty')
    };
  }

  return {
    success: true,
    npcName,
    dialogue: relationshipStatus === RELATIONSHIP_STATUS.STRANGER
      ? `"Greetings, stranger. What brings a new face to these parts?"`
      : `"Greetings, traveler. Safe travels on these broken roads."`,
    bodyLanguage: `${npcName} pauses what they are doing and looks up, measuring your intentions.`,
    emotion: 'calm',
    attitude: relationshipStatus === RELATIONSHIP_STATUS.STRANGER ? 'stranger curiosity' : 'neutral courtesy'
  };
}

// ============================================================================
