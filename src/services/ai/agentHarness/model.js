import { ChatOpenAI } from '@langchain/openai';
import aiConfig from '../../../configs/aiConfig.js';
import { AI_DEFAULTS, DEFAULT_AI_MODEL, DEFAULT_DEEPSEEK_BASE_URL, PLACEHOLDER_DEEPSEEK_API_KEY } from '../../../configs/constants.js';
import { getRequestAiApiKey } from '../aiRequestContext.js';

export function createHarnessChatModel(options = {}) {
  const apiKey = (
    options.apiKey ||
    getRequestAiApiKey() ||
    PLACEHOLDER_DEEPSEEK_API_KEY
  ).trim();

  let baseURL = (
    options.baseURL ||
    DEFAULT_DEEPSEEK_BASE_URL
  ).trim();

  baseURL = baseURL.replace(/\/anthropic\/?$/, '').replace(/\/v1\/messages\/?$/, '').replace(/\/messages\/?$/, '');

  const modelName = (
    options.model ||
    aiConfig.model ||
    DEFAULT_AI_MODEL
  ).trim();

  return new ChatOpenAI({
    apiKey,
    configuration: { baseURL },
    model: modelName,
    temperature: options.temperature ?? aiConfig.temperature ?? AI_DEFAULTS.TEMPERATURE,
    maxTokens: options.maxTokens ?? aiConfig.max_tokens ?? AI_DEFAULTS.HARNESS_MAX_TOKENS,
    timeout: options.timeoutMs ?? aiConfig.timeoutMs ?? AI_DEFAULTS.TIMEOUT_MS
  });
}

// ============================================================================
// FALLBACK NARRATION GENERATOR
// ============================================================================

export function generateHarnessFallbackNarration(character, action, reason = '') {
  const locationName = character?.location?.name || "Warden's Crossing";
  const charName = character?.name || 'Adventurer';

  return `[Stervian DM Harness]: ${charName} acts: "${action}".

The quiet atmosphere of ${locationName} shifts as the cool wind stirs the grass. Your senses sharpen, taking in every subtle motion along the road ahead. You hold your ground, ready for whatever lies just beyond the shadowed bends.

*(Notice: Action resolved by Stervian Agent Harness. Service notice: ${reason || 'Operating in offline/fallback mode'}.)*

[CHOICES: Inspect the nearby area | Ready your weapon and stay vigilant | Search for fresh tracks]`;
}

// ============================================================================
