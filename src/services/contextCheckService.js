import { getEncoding } from 'js-tiktoken';
import aiConfig from '../configs/aiConfig.js';
import { immersionDefenseGuard, prepareContextWindow } from './ai/lifecycle/index.js';
import { TOKENIZER_ENCODING } from '../configs/constants.js';

const tokenizer = getEncoding(TOKENIZER_ENCODING);
const categoryLabels = {
  system: 'System prompt',
  actionMode: 'Action mode',
  targetDirectives: 'Target directives',
  characterMemory: 'Character memories',
  npcMemory: 'NPC memory',
  scenes: 'Active scenes',
  aiDm: 'AI DM prompt',
  roleplay: 'Roleplay prompt'
};

function messageRole(message) {
  const type = message?._getType?.();
  if (type === 'human') return 'user';
  if (type === 'ai') return 'assistant';
  if (message?.role === 'user' || message?.role === 'assistant') return message.role;
  return type || message?.role || 'system';
}

function messageContent(message) {
  const raw = message?.content ?? message?.text;
  const content = typeof raw === 'string'
    ? raw
    : JSON.stringify(raw ?? '');
  const toolCalls = message?.tool_calls?.length
    ? `\n[Tool calls] ${JSON.stringify(message.tool_calls)}`
    : '';
  return content + toolCalls;
}

function storyMessageContent(message) {
  const raw = message?.content ?? message?.text;
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .filter((part) => part && (part.type === 'text' || typeof part === 'string'))
      .map((part) => (typeof part === 'string' ? part : part.text || ''))
      .join('\n\n')
      .trim();
  }
  return '';
}

function measureMessages(messages, contextWindowTokens) {
  if (!Array.isArray(messages)) return null;
  const formatted = messages.map((message) => ({ role: messageRole(message), content: messageContent(message) }));
  const fullText = formatted.map(({ role, content }) => `[${role}]\n${content}`).join('\n\n');
  const characters = [...fullText].length;
  const estimatedTokens = formatted.reduce((sum, { role, content }) =>
    sum + tokenizer.encode(role).length + tokenizer.encode(content).length + 4, 2);

  const narrativeParts = [];
  for (const message of messages) {
    const role = messageRole(message);
    if (role !== 'user' && role !== 'assistant') continue;
    const content = storyMessageContent(message);
    if (!content) continue;
    narrativeParts.push(`[${role}]\n${content}`);
  }
  const text = narrativeParts.join('\n\n');

  return {
    text,
    characters,
    estimatedTokens,
    percent: contextWindowTokens ? estimatedTokens / contextWindowTokens * 100 : null
  };
}

export function buildContextCheckReport({ segments, beforeMessages, afterMessages = null, model = aiConfig.model, isFallback = false }) {
  const contextWindowTokens = aiConfig.contextWindowTokens;
  const categories = Object.entries(categoryLabels).map(([key, label]) => {
    const text = segments.filter((segment) => segment.category === key).map((segment) => segment.text).join('');
    const estimatedTokens = tokenizer.encode(text).length;
    return {
      key,
      label,
      characters: [...text].length,
      estimatedTokens,
      percent: contextWindowTokens ? estimatedTokens / contextWindowTokens * 100 : null
    };
  });
  return {
    model,
    isFallback,
    contextWindowTokens,
    categories,
    before: measureMessages(beforeMessages, contextWindowTokens),
    after: afterMessages ? measureMessages(afterMessages, contextWindowTokens) : null,
    note: 'Token counts use cl100k as an estimate. Totals also include recent history and the current action. Provider tokenization and tool definitions may differ.'
  };
}

export async function previewContextCheck({ userId, characterId, actionText, actionMode = 'story', history = [], targetNpcId = null }) {
  const context = {
    userId,
    characterId,
    actionText,
    cleanAction: String(actionText || '').trim() || 'Look around.',
    actionMode,
    targetNpcId,
    history
  };
  await immersionDefenseGuard(context);
  await prepareContextWindow(context);
  if (context.error) return { error: context.error };
  return buildContextCheckReport({
    segments: context.promptSegments,
    beforeMessages: context.initialMessages
  });
}
