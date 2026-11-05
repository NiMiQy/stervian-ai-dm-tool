import aiConfig from '../configs/aiConfig.js';
import { AI_DEFAULTS, ANTHROPIC_API_VERSION, CHARACTER_TYPE, DEFAULT_AI_MODEL, DEFAULT_DEEPSEEK_BASE_URL, HTTP_STATUS, PLACEHOLDER_DEEPSEEK_API_KEY } from '../configs/constants.js';
import prisma from './prismaClient.js';
import { databaseError } from '../database/databaseError.js';
import { getStoryBroadcaster } from './webSocketService.js';
import { getCharacterSheet } from '../containers/characterContainer.js';
import { getUserActiveParty } from '../containers/partyContainer.js';
import { buildDungeonMasterPrompt } from './ai/prompts/index.js';
import { executeHarnessAction } from './ai/agentHarness/index.js';
import { getRequestAiApiKey } from './ai/aiRequestContext.js';

export class OpenAiDeepseekService {
  constructor(options = {}) {
    this.options = options;
    this.timeoutMs = options.timeoutMs || aiConfig.timeoutMs || AI_DEFAULTS.TIMEOUT_MS;
  }

  /**
   * Dynamically resolves the active API key sent by the player for this request.
   */
  getApiKey() {
    return (
      this.options.apiKey ||
      getRequestAiApiKey() ||
      PLACEHOLDER_DEEPSEEK_API_KEY
    ).trim();
  }

  /**
   * Dynamically resolves the base URL.
   */
  getBaseURL() {
    return (
      this.options.baseURL ||
      DEFAULT_DEEPSEEK_BASE_URL
    ).trim();
  }

  /**
   * Dynamically resolves the target model from aiConfig.
   */
  getModel() {
    return (
      this.options.model ||
      aiConfig.model ||
      DEFAULT_AI_MODEL
    ).trim();
  }

  /**
   * Builds the comprehensive Dungeon Master system prompt tailored for Stervian.
   * Loads nearby NPCs to feed the dedicated NPC Roleplay section.
   */
  async buildSystemPrompt(character) {
    let nearbyNpcs = [];
    let party = null;
    try {
      if (character?.user_id) {
        const partyData = await getUserActiveParty(character.user_id);
        party = partyData?.party || null;
      }
    } catch (err) {
      console.warn('Unable to load party for prompt:', err.message);
    }
    try {
      if (character?.location_id || character?.sublocation_id) {
        const appearanceScope = character.sublocation_id
          ? { sublocation_id: character.sublocation_id }
          : { location_id: character.location_id, sublocation_id: null };
        const appearances = await prisma.npcs_in_locations_or_sublocations.findMany({
          where: {
            deleted: false,
            ...appearanceScope,
            npc: {
              is: {
                deleted: false,
                npc_monsters: { is: null },
                character: { is: { deleted: false, character_type: CHARACTER_TYPE.NPC } }
              }
            }
          },
          include: {
            npc: {
              include: {
                character: true
              }
            }
          }
        });
        nearbyNpcs = appearances.map((a) => a.npc).filter(Boolean);
      }
    } catch (err) {
      console.warn('Unable to load nearby NPCs for prompt:', err.message);
    }

    return buildDungeonMasterPrompt({ character, nearbyNpcs, party });
  }

  /**
   * Calls an Anthropic Messages protocol endpoint (e.g. https://api.deepseek.com/anthropic/v1/messages).
   */
  async callAnthropicEndpoint(baseURL, apiKey, model, systemPrompt, userMessages, maxTokens = AI_DEFAULTS.COMPLETION_MAX_TOKENS) {
    let url = baseURL;
    if (!url.endsWith('/messages') && !url.endsWith('/v1/messages')) {
      url = `${url.replace(/\/+$/, '')}/v1/messages`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION
        },
        body: JSON.stringify({
          model,
          max_tokens: this.options.max_tokens ?? aiConfig.max_tokens ?? maxTokens,
          temperature: this.options.temperature ?? aiConfig.temperature ?? AI_DEFAULTS.ANTHROPIC_TEMPERATURE,
          top_p: this.options.top_p ?? aiConfig.top_p ?? AI_DEFAULTS.TOP_P,
          top_k: this.options.top_k ?? aiConfig.top_k ?? AI_DEFAULTS.TOP_K,
          system: systemPrompt,
          messages: userMessages.map((msg) => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      let parsed;
      try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }

      if (!response.ok) {
        const err = new Error(parsed?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        err.data = parsed;
        throw err;
      }

      let text = '';
      if (Array.isArray(parsed?.content)) {
        text = parsed.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('\n\n')
          .trim();
      } else if (typeof parsed?.content === 'string') {
        text = parsed.content.trim();
      }

      return { text, raw: parsed, protocol: 'anthropic' };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Calls an OpenAI Chat Completions protocol endpoint (e.g. https://api.deepseek.com/chat/completions).
   */
  async callOpenAiEndpoint(baseURL, apiKey, model, systemPrompt, userMessages, maxTokens = AI_DEFAULTS.COMPLETION_MAX_TOKENS) {
    let url = baseURL;
    if (!url.endsWith('/chat/completions')) {
      url = `${url.replace(/\/+$/, '')}/chat/completions`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          max_tokens: this.options.max_tokens ?? aiConfig.max_tokens ?? maxTokens,
          temperature: this.options.temperature ?? aiConfig.temperature ?? AI_DEFAULTS.TEMPERATURE,
          top_p: this.options.top_p ?? aiConfig.top_p ?? AI_DEFAULTS.TOP_P,
          messages: [
            { role: 'system', content: systemPrompt },
            ...userMessages.map((msg) => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content
            }))
          ]
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      let parsed;
      try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }

      if (!response.ok) {
        const err = new Error(parsed?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        err.data = parsed;
        throw err;
      }

      const text = parsed?.choices?.[0]?.message?.content?.trim() || '';
      return { text, raw: parsed, protocol: 'openai' };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Dynamically dispatches request using the appropriate protocol with automatic fallback.
   */
  async createChatCompletion({ systemPrompt, messages, maxTokens = AI_DEFAULTS.COMPLETION_MAX_TOKENS }) {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    const model = this.getModel();

    const isAnthropicPreferred = baseURL.includes('/anthropic') || baseURL.includes('/messages');

    if (isAnthropicPreferred) {
      try {
        return await this.callAnthropicEndpoint(baseURL, apiKey, model, systemPrompt, messages, maxTokens);
      } catch (anthropicErr) {
        if (anthropicErr.status === HTTP_STATUS.NOT_FOUND) {
          return await this.callOpenAiEndpoint(baseURL, apiKey, model, systemPrompt, messages, maxTokens);
        }
        throw anthropicErr;
      }
    } else {
      try {
        return await this.callOpenAiEndpoint(baseURL, apiKey, model, systemPrompt, messages, maxTokens);
      } catch (openAiErr) {
        if (openAiErr.status === HTTP_STATUS.NOT_FOUND) {
          return await this.callAnthropicEndpoint(baseURL, apiKey, model, systemPrompt, messages, maxTokens);
        }
        throw openAiErr;
      }
    }
  }

  /**
   * Generates a dynamic fallback response if the API is offline or key is missing.
   */
  generateFallbackNarration(character, action, reason = '') {
    const locationName = character.location?.name || "Warden's Crossing";
    const charName = character.name || 'Adventurer';

    return `[DeepSeek V4 AI DM]: ${charName} proceeds: "${action}".

The quiet atmosphere of ${locationName} shifts as the cool wind stirs the grass. Your senses sharpen, taking in every subtle motion along the road ahead. You hold your ground, ready for whatever lies just beyond the shadowed bends.

*(Notice: Action received. Service notice: ${reason}. Enter your AI API key in the game if live responses are expected.)*

[CHOICES: Inspect the nearby area | Ready your weapon and stay vigilant | Search for fresh tracks]`;
  }

  /**
   * Prepares and normalizes conversation history and the current player action
   * to conform strictly with Anthropic Messages and OpenAI Chat Completions protocols.
   */
  prepareMessages(history = [], currentAction = '') {
    const rawList = [];
    if (Array.isArray(history)) {
      for (const item of history) {
        const text = String(item.text || item.content || '').trim();
        if (!text) continue;
        const role = item.role === 'assistant' ? 'assistant' : 'user';
        rawList.push({ role, content: text });
      }
    }

    const cleanAction = String(currentAction || '').trim();
    if (cleanAction) {
      const last = rawList[rawList.length - 1];
      if (!last || last.role !== 'user' || last.content !== cleanAction) {
        rawList.push({ role: 'user', content: cleanAction });
      }
    }

    if (rawList.length === 0) {
      return [{ role: 'user', content: cleanAction || 'Look around.' }];
    }

    // Anthropic requires the first message to have role: 'user'
    if (rawList[0].role === 'assistant') {
      rawList.unshift({ role: 'user', content: 'Begin the adventure.' });
    }

    // Merge consecutive messages of the same role
    const normalized = [];
    for (const msg of rawList) {
      const prev = normalized[normalized.length - 1];
      if (prev && prev.role === msg.role) {
        prev.content += `\n\n${msg.content}`;
      } else {
        normalized.push({ role: msg.role, content: msg.content });
      }
    }

    // Ensure the last message has role: 'user'
    if (normalized.length > 0 && normalized[normalized.length - 1].role !== 'user') {
      normalized.push({ role: 'user', content: cleanAction || 'Continue.' });
    }

    return normalized;
  }

  /**
   * Main entrypoint for processing player actions submitted from game.html.
   * Uses client conversation history and pauses database writes.
   */
  async processPlayerAction(userId, characterId, actionText, history = [], includeContextCheck = false, actionMode = 'story', targetNpcId = null, revealResult = null, partyTurn = null, fateCheck = null, skillCheck = null, playerTools = []) {
    if (!actionText || typeof actionText !== 'string' || !actionText.trim()) {
      return { error: 'Action cannot be empty.' };
    }
    const cleanAction = actionText.trim();

    try {
      const harnessResult = await executeHarnessAction({
        userId,
        characterId,
        actionText: cleanAction,
        history,
        includeContextCheck,
        actionMode,
        targetNpcId,
        revealResult,
        partyTurn,
        fateCheck,
        skillCheck,
        playerTools
      });

      if (harnessResult?.error) {
        return harnessResult;
      }

      return {
        success: true,
        action: cleanAction,
        story: harnessResult.story,
        character: harnessResult.character,
        isMockFallback: harnessResult.isMockFallback,
        model: harnessResult.model || this.getModel(),
        iterationCount: harnessResult.iterationCount,
        encounter: harnessResult.encounter || null,
        ...(harnessResult.contextCheck ? { contextCheck: harnessResult.contextCheck } : {}),
        ...(harnessResult.storyId ? { storyId: harnessResult.storyId } : {}),
        ...(harnessResult.dialogueSessionId ? { dialogueSessionId: harnessResult.dialogueSessionId, dialogueMessageIds: harnessResult.dialogueMessageIds || [] } : {}),
        ...(harnessResult.dialogueClosed ? { dialogueClosed: harnessResult.dialogueClosed } : {}),
        ...(harnessResult.sceneChanges ? { sceneChanges: harnessResult.sceneChanges } : {})
      };
    } catch (harnessErr) {
      console.warn('LangGraph harness action failed, executing direct fallback:', harnessErr.message);

      const character = await getCharacterSheet(userId);
      if (!character) {
        return { error: 'Character not found.' };
      }

      const reason = harnessErr.message || 'Harness unreachable';
      const fallbackStory = this.generateFallbackNarration(character, cleanAction, reason);

      return {
        success: true,
        action: cleanAction,
        story: fallbackStory,
        character,
        isMockFallback: true,
        model: this.getModel(),
        iterationCount: 1,
        encounter: null
      };
    }
  }
}

export const openAiDeepseekService = new OpenAiDeepseekService();
export default openAiDeepseekService;
