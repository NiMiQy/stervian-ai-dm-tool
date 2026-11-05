export function extractJsonObject(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let text = input.trim();
  if (!text) {
    return null;
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const insideBlock = codeBlockMatch[1].trim();
    const parsedFromBlock = tryParseOrRepairJson(insideBlock);
    if (parsedFromBlock) {
      return parsedFromBlock;
    }
  }

  const directParsed = tryParseOrRepairJson(text);
  if (directParsed) {
    return directParsed;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = text.slice(firstBrace, lastBrace + 1);
    const parsedSlice = tryParseOrRepairJson(sliced);
    if (parsedSlice) {
      return parsedSlice;
    }
  }

  if (firstBrace !== -1) {
    const fromFirstBrace = text.slice(firstBrace);
    const repaired = tryRepairTruncatedJson(fromFirstBrace);
    if (repaired) {
      return repaired;
    }
  }

  return null;
}

function tryParseOrRepairJson(candidate) {
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  const normalized = trimmed
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\r?\n/g, ' ');

  try {
    return JSON.parse(normalized);
  } catch {}

  return tryRepairTruncatedJson(trimmed);
}

function tryRepairTruncatedJson(candidate) {
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }

  let text = candidate.trim();
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) {
    return null;
  }
  text = text.slice(firstBrace);
  text = text.replace(/`+$/, '').trim();

  let inString = false;
  let escaped = false;
  let openBraces = 0;
  let openBrackets = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
    }
  }

  let repaired = text;
  if (inString) {
    repaired += '"';
  }
  repaired = repaired.replace(/,\s*$/, '');
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  try {
    return JSON.parse(repaired);
  } catch {
    const cleanedTrailing = repaired
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/,\s*"[^"]*":\s*"?[^"]*$/g, '');
    try {
      let finalFix = cleanedTrailing;
      let finalBraces = 0;
      for (const c of finalFix) {
        if (c === '{') finalBraces++;
        if (c === '}') finalBraces--;
      }
      while (finalBraces > 0) {
        finalFix += '}';
        finalBraces--;
      }
      return JSON.parse(finalFix);
    } catch {
      return null;
    }
  }
}

export function minifyJson(obj) {
  if (obj === null || obj === undefined) return '{}';
  return JSON.stringify(obj);
}
