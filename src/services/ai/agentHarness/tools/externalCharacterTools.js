import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import configs from '../../../../configs/configs.js';
import aiConfig from '../../../../configs/aiConfig.js';
import { AI_DEFAULTS, ANTHROPIC_API_VERSION, DEFAULT_AI_MODEL, DEFAULT_DEEPSEEK_BASE_URL } from '../../../../configs/constants.js';

const characterSearchCache = new Map();

function getMessagesEndpoint(baseURL) {
  const normalizedBaseURL = baseURL.replace(/\/+$/, '');

  if (normalizedBaseURL.endsWith('/messages')) {
    return normalizedBaseURL;
  }

  if (normalizedBaseURL.endsWith('/anthropic/v1')) {
    return `${normalizedBaseURL}/messages`;
  }

  if (normalizedBaseURL.endsWith('/anthropic')) {
    return `${normalizedBaseURL}/v1/messages`;
  }

  if (normalizedBaseURL.endsWith('/v1')) {
    return `${normalizedBaseURL}/messages`;
  }

  return `${normalizedBaseURL}/anthropic/v1/messages`;
}

function parseSearchResponse(responseData) {
  const content = Array.isArray(responseData?.content) ? responseData.content : [];
  const resultBlocks = content.filter((block) => block?.type === 'web_search_tool_result');

  if (resultBlocks.length === 0) {
    throw new Error('DeepSeek did not return native web search results.');
  }
  const citationSnippets = new Map();
  const summary = content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => {
      for (const citation of Array.isArray(block.citations) ? block.citations : []) {
        if (citation?.url && citation?.cited_text && !citationSnippets.has(citation.url)) {
          citationSnippets.set(citation.url, citation.cited_text);
        }
      }
      return block.text.trim();
    })
    .filter(Boolean)
    .join('\n\n');

  const seenUrls = new Set();
  const sources = [];
  for (const block of resultBlocks) {
    for (const result of Array.isArray(block.content) ? block.content : []) {
      if (result?.type !== 'web_search_result' || typeof result.url !== 'string' || !result.url || seenUrls.has(result.url)) {
        continue;
      }

      seenUrls.add(result.url);
      sources.push({
        url: result.url,
        title: typeof result.title === 'string' ? result.title : '',
        snippet: citationSnippets.get(result.url) || ''
      });
    }
  }

  const snippets = [
    ...sources.map((source) => {
      const label = source.title || source.url;
      return source.snippet ? `${label}: ${source.snippet}` : `${label}: ${source.url}`;
    })
  ];

  if (summary) {
    snippets.unshift(summary);
  }

  return { summary , sources};
}

async function searchExternalCharacter(characterName, franchiseHint = '') {
  const apiKey = (process.env.DEEPSEEK_API_KEY || configs.DEEPSEEK_API_KEY || '').trim();
  const baseURL = (process.env.DEEPSEEK_BASE_URL || configs.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL).trim();
  const model = (process.env.DEEPSEEK_MODEL || aiConfig.model || DEFAULT_AI_MODEL).trim();
  const query = [characterName, franchiseHint, 'character : [appearance, clothing, hair, personality, abilities, lore]. And not a person in real world, only 2d, 3d, anime, games, character only.']
    .filter(Boolean)
    .join(' ');
  const response = await fetch(getMessagesEndpoint(baseURL), {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      authorization: `Bearer ${apiKey}`,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: AI_DEFAULTS.EXTERNAL_LOOKUP_MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: `Perform a web search for the query: ${query}` }]
      }],
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: AI_DEFAULTS.WEB_SEARCH_MAX_USES
      }]
    }),
    signal: AbortSignal.timeout(aiConfig.timeoutMs || AI_DEFAULTS.TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`DeepSeek web search request failed with status ${response.status}.`);
  }

  return parseSearchResponse(await response.json());
}

export const searchExternalCharacterOnWeb = tool(
  async ({ character_name, franchise_hint }) => {
    try {
      if (!character_name || typeof character_name !== 'string' || !character_name.trim()) {
        return JSON.stringify({
          found: false,
          error: 'INVALID_INPUT',
          message: 'Character name cannot be empty.'
        });
      }

      const cleanName = character_name.trim();
      const cleanFranchise = franchise_hint && typeof franchise_hint === 'string' ? franchise_hint.trim() : '';
      const cacheKey = `${cleanName.toLowerCase()}|${cleanFranchise.toLowerCase()}`;
      if (characterSearchCache.has(cacheKey)) {
        return JSON.stringify(characterSearchCache.get(cacheKey));
      }

      const searchResult = await searchExternalCharacter(cleanName, cleanFranchise);
      if (searchResult.sources.length === 0) {
        return JSON.stringify({
          found: false,
          character_name: cleanName,
          from: cleanFranchise || 'Unknown',
          message: `No external character profile found for '${cleanName}'.`
        });
      }

      const payload = {
        found: true,
        character_name: cleanName,
        franchise: cleanFranchise || 'External Fiction',
        summary: searchResult.summary || searchResult.snippets.join('\n'),
        source: 'deepseek_web_search',
        // search_snippets: searchResult.snippets,
        // search_sources: searchResult.sources,
        adaptation_guide: 'Adapt this non-canon character into the dark fantasy setting of Stervian. MANDATORY VISUAL ACCURACY: Strictly portray this character with the exact visual appearance, hair, and clothing specified in the appearance field or search snippets. Do not invent different clothes or alter their hair and features. Frame them as an otherworldly traveler. Do not mention search engines or real-world media.'
      };

      characterSearchCache.set(cacheKey, payload);
      return JSON.stringify(payload);
    } catch {
      return JSON.stringify({
        found: false,
        character_name,
        error: 'SEARCH_FAILED',
        message: 'External character web search failed.'
      });
    }
  },
  {
    name: 'search_external_character_on_web',
    description: 'Searches the web using DeepSeek native web search for lore, appearance, personality, and abilities of a non-canon, guest, or crossover character outside the Stervian world (e.g. Geralt of Rivia, Spider-Man, Saber, 2B). NEVER use for generic monsters, items, or canonical Stervian NPCs.',
    schema: z.object({
      character_name: z.string().describe('The name of the external or non-canon character to search for.'),
      franchise_hint: z.string().optional().describe('Optional universe or franchise name (e.g. "The Witcher", "Marvel", "Dragon Ball").')
    })
  }
);

export { characterSearchCache, getMessagesEndpoint, parseSearchResponse };
