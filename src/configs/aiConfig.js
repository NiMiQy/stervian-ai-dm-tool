import { AI_DEFAULTS, DEEPSEEK_CONTEXT_WINDOW_TOKENS, DEFAULT_AI_MODEL } from './constants.js';

const configuredModel = DEFAULT_AI_MODEL;

/**
 * ============================================================================
 * AI GENERATION CONFIGURATION
 * ============================================================================
 * Manually customize model parameters for the Dungeon Master AI service.
 */
export const aiConfig = {
  // Target model name (e.g. 'deepseek-flash', 'deepseek-chat', 'deepseek-v4')
  model: configuredModel,

  // DeepSeek V4 models have a 1M-token window. Set this for other providers/models.
  contextWindowTokens: Number(process.env.AI_CONTEXT_WINDOW_TOKENS) > 0
    ? Number(process.env.AI_CONTEXT_WINDOW_TOKENS)
    : /deepseek/i.test(configuredModel)
      ? DEEPSEEK_CONTEXT_WINDOW_TOKENS
      : null,

  // Sampling temperature (0.0 to 2.0). Lower = more deterministic, higher = more creative/unpredictable.
  temperature: AI_DEFAULTS.TEMPERATURE,

  // Nucleus sampling probability (0.0 to 1.0). Considers tokens with top_p probability mass.
  top_p: AI_DEFAULTS.TOP_P,

  // Top-k sampling: Keeps the k most likely tokens (used in Anthropic / compatible models).
  top_k: AI_DEFAULTS.TOP_K,

  // Maximum number of output tokens to generate per response.
  max_tokens: Number(process.env.AI_MAX_TOKENS) > 0 ? Number(process.env.AI_MAX_TOKENS) : AI_DEFAULTS.MAX_TOKENS,

  // Request timeout in milliseconds (default: 45s).
  timeoutMs: AI_DEFAULTS.TIMEOUT_MS
};

export default aiConfig;
