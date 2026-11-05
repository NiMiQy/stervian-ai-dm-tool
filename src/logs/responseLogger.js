import fs from 'node:fs';
import path from 'node:path';

const RESPONSE_LOG_DIR = path.resolve(process.cwd(), 'logs', 'response');
const SYSTEM_PROMPT_LOG_DIR = path.resolve(process.cwd(), 'logs', 'systempromptlogs');

// Agents of the ACT and Observe turns whose full input messages are saved to logs/systempromptlogs.
const SYSTEM_PROMPT_LOG_AGENTS = Object.freeze({
  'AI DM (agentNode)': 'Master',
  'Narration Agent': 'Narration',
  'Subagent: NPC Roleplay': 'Roleplay',
  'Observe Master': 'ObserveMaster',
  'Observe Narration': 'ObserveNarration',
  'Subagent: NPC Roleplay (Observe)': 'ObserveRoleplay'
});

function sanitizeFileName(name) {
  const cleaned = String(name || 'unknown').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'unknown';
}

function messageRole(message) {
  if (typeof message?._getType === 'function') return message._getType();
  return message?.role || message?.type || 'unknown';
}

function messageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('\n');
  }
  if (content == null) return '';
  return JSON.stringify(content);
}

export function extractTokenUsage(response) {
  const usage = response?.usage_metadata;
  if (usage) {
    return {
      inputTokens: usage.input_tokens ?? null,
      outputTokens: usage.output_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      cachedInputTokens: usage.input_token_details?.cache_read ?? null,
      reasoningTokens: usage.output_token_details?.reasoning ?? null
    };
  }
  const legacy = response?.response_metadata?.tokenUsage || response?.response_metadata?.usage;
  if (legacy) {
    return {
      inputTokens: legacy.promptTokens ?? legacy.prompt_tokens ?? legacy.input_tokens ?? null,
      outputTokens: legacy.completionTokens ?? legacy.completion_tokens ?? legacy.output_tokens ?? null,
      totalTokens: legacy.totalTokens ?? legacy.total_tokens ?? null,
      cachedInputTokens: null,
      reasoningTokens: null
    };
  }
  return { inputTokens: null, outputTokens: null, totalTokens: null, cachedInputTokens: null, reasoningTokens: null };
}

function summarizeInput(messages = []) {
  const counts = {};
  let chars = 0;
  for (const message of messages) {
    const role = messageRole(message);
    counts[role] = (counts[role] || 0) + 1;
    chars += messageText(message?.content).length;
  }
  return { messageCount: messages.length, counts, chars, estimatedTokens: Math.ceil(chars / 4) };
}

function fmt(value) {
  return value == null ? 'n/a' : Number(value).toLocaleString('en-US');
}

function fence(text) {
  const body = String(text || '').trim() || '(empty)';
  return ['```text', body.replace(/```/g, '`​``'), '```'].join('\n');
}

export function formatResponseEntry({ agent, logName, model, durationMs, inputMessages, response, error, extra }) {
  const usage = extractTokenUsage(response);
  const input = summarizeInput(inputMessages);
  const text = messageText(response?.content);
  const reasoning = response?.additional_kwargs?.reasoning_content || '';
  const toolCalls = Array.isArray(response?.tool_calls) ? response.tool_calls : [];
  const finishReason = response?.response_metadata?.finish_reason || response?.response_metadata?.finishReason || 'n/a';
  const roleSummary = Object.entries(input.counts).map(([role, count]) => `${role}: ${count}`).join(', ') || 'none';

  const lines = [];
  lines.push(`## ${new Date().toISOString()} · ${agent}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Agent | ${agent} |`);
  lines.push(`| Log name | ${logName} |`);
  lines.push(`| Model | ${model || 'n/a'} |`);
  lines.push(`| Status | ${error ? 'FAILED' : 'SUCCESS'} |`);
  lines.push(`| Duration | ${fmt(durationMs)} ms |`);
  lines.push(`| Finish reason | ${finishReason} |`);
  lines.push(`| Input tokens (context) | ${fmt(usage.inputTokens)} |`);
  lines.push(`| Cached input tokens | ${fmt(usage.cachedInputTokens)} |`);
  lines.push(`| Output tokens | ${fmt(usage.outputTokens)} |`);
  lines.push(`| Reasoning tokens | ${fmt(usage.reasoningTokens)} |`);
  lines.push(`| Total tokens | ${fmt(usage.totalTokens)} |`);
  lines.push(`| Input messages | ${input.messageCount} (${roleSummary}) |`);
  lines.push(`| Input size | ${fmt(input.chars)} chars (~${fmt(input.estimatedTokens)} tokens est.) |`);
  lines.push(`| Response size | ${fmt(text.length)} chars |`);
  if (extra && typeof extra === 'object') {
    for (const [key, value] of Object.entries(extra)) {
      lines.push(`| ${key} | ${String(value ?? 'n/a').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
    }
  }
  lines.push('');
  if (error) {
    lines.push('**Error**');
    lines.push('');
    lines.push(fence(error?.message || error));
    lines.push('');
  }
  if (toolCalls.length > 0) {
    lines.push('**Tool calls**');
    lines.push('');
    for (const call of toolCalls) {
      lines.push(`- \`${call.name}\` ${JSON.stringify(call.args || {})}`);
    }
    lines.push('');
  }
  if (reasoning) {
    lines.push('**Reasoning**');
    lines.push('');
    lines.push(fence(reasoning));
    lines.push('');
  }
  lines.push('**Response**');
  lines.push('');
  lines.push(fence(text));
  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

export function formatSystemPromptEntry({ agent, logName, model, inputMessages = [], extra = null, timestamp }) {
  const lines = [];
  lines.push(`# ${agent} · ${logName} · ${timestamp}`);
  lines.push('');
  lines.push(`- Model: ${model || 'n/a'}`);
  if (extra && typeof extra === 'object') {
    for (const [key, value] of Object.entries(extra)) lines.push(`- ${key}: ${String(value ?? 'n/a').replace(/\n/g, ' ')}`);
  }
  lines.push(`- Messages: ${inputMessages.length}`);
  lines.push('');
  inputMessages.forEach((message, index) => {
    lines.push(`## [${index + 1}] ${messageRole(message)}`);
    lines.push('');
    lines.push(fence(messageText(message?.content)));
    lines.push('');
  });
  return lines.join('\n');
}

export async function logSystemPrompt({ agent, logName, model, inputMessages = [], extra = null }) {
  const label = SYSTEM_PROMPT_LOG_AGENTS[agent];
  if (!label) return null;
  try {
    const timestamp = new Date().toISOString();
    await fs.promises.mkdir(SYSTEM_PROMPT_LOG_DIR, { recursive: true });
    const fileName = `${timestamp.replace(/[:.]/g, '-')}_${sanitizeFileName(logName)}_${label}.md`;
    const filePath = path.join(SYSTEM_PROMPT_LOG_DIR, fileName);
    await fs.promises.writeFile(filePath, formatSystemPromptEntry({ agent, logName: logName || 'unknown', model, inputMessages, extra, timestamp }), 'utf8');
    return filePath;
  } catch (logErr) {
    console.warn('Unable to write system prompt log:', logErr.message);
    return null;
  }
}

export async function logAiResponse({ agent, logName, model, durationMs, inputMessages = [], response = null, error = null, extra = null }) {
  try {
    const safeName = sanitizeFileName(logName);
    await fs.promises.mkdir(RESPONSE_LOG_DIR, { recursive: true });
    const filePath = path.join(RESPONSE_LOG_DIR, `${safeName}.md`);
    let header = '';
    try {
      await fs.promises.access(filePath);
    } catch {
      header = `# AI Response Log · ${logName || safeName}\n\n`;
    }
    const entry = formatResponseEntry({ agent, logName: logName || safeName, model, durationMs, inputMessages, response, error, extra });
    await fs.promises.appendFile(filePath, header + entry, 'utf8');
    await logSystemPrompt({ agent, logName: logName || safeName, model, inputMessages, extra });
    return filePath;
  } catch (logErr) {
    console.warn('Unable to write AI response log:', logErr.message);
    return null;
  }
}

export async function invokeWithResponseLog(modelInstance, messages, { agent, logName, extra } = {}) {
  const start = Date.now();
  const model = modelInstance?.modelName || modelInstance?.model || modelInstance?.bound?.modelName || modelInstance?.bound?.model || 'unknown';
  try {
    const response = await modelInstance.invoke(messages);
    await logAiResponse({ agent, logName, model, durationMs: Date.now() - start, inputMessages: messages, response, extra });
    return response;
  } catch (err) {
    await logAiResponse({ agent, logName, model, durationMs: Date.now() - start, inputMessages: messages, error: err, extra });
    throw err;
  }
}
