/**
 * Story Entry Component
 * Manages rendering, inline editing, and deletion of story dialogue and narration turns.
 */

export function createFateBadge(fateCheck) {
  if (!fateCheck || !fateCheck.result) return null;
  const badge = document.createElement('p');
  badge.className = `fate-badge is-${String(fateCheck.result).toLowerCase().replace(/_/g, '-')}`;
  const die = document.createElement('span');
  die.className = 'fate-badge-roll';
  die.textContent = `🎲 ${fateCheck.roll}`;
  const verdict = document.createElement('strong');
  verdict.textContent = fateCheck.resultLabel || fateCheck.result;
  const meta = document.createElement('span');
  meta.className = 'fate-badge-meta';
  meta.textContent = `${fateCheck.oddsLabel || fateCheck.odds} · Chaos ${fateCheck.chaosFactor}`;
  badge.append(die, verdict, meta);
  if (fateCheck.randomEvent) {
    const event = document.createElement('span');
    event.className = 'fate-badge-event';
    event.textContent = `Random event: ${fateCheck.randomEvent.label}`;
    badge.append(event);
  }
  return badge;
}

export function createSkillBadge(skillCheck) {
  if (!skillCheck || !skillCheck.result) return null;
  const badge = document.createElement('p');
  badge.className = `fate-badge skill-badge is-${String(skillCheck.result).toLowerCase().replace(/_/g, '-')}`;
  const die = document.createElement('span');
  die.className = 'fate-badge-roll';
  const rolls = Array.isArray(skillCheck.rolls) && skillCheck.rolls.length > 1 ? ` (${skillCheck.rolls.join(' / ')})` : '';
  die.textContent = `🎯 d20 ${skillCheck.die}${rolls}`;
  const verdict = document.createElement('strong');
  verdict.textContent = skillCheck.resultLabel || skillCheck.result;
  const meta = document.createElement('span');
  meta.className = 'fate-badge-meta';
  const mode = skillCheck.rollMode === 'ADVANTAGE' ? ' · Advantage' : skillCheck.rollMode === 'DISADVANTAGE' ? ' · Disadvantage' : '';
  meta.textContent = `${skillCheck.skillName} ${skillCheck.total} vs DC ${skillCheck.dc}${mode}`;
  badge.append(die, verdict, meta);
  if (skillCheck.secretRevealed) {
    const secret = document.createElement('span');
    secret.className = 'fate-badge-event';
    secret.textContent = 'A secret comes out';
    badge.append(secret);
  }
  return badge;
}

export function createStoryEntryElement({ entry, character = {}, npcs = [], onEdit, onDelete }) {
  const isPlayer = entry.role === 'user';
  const article = document.createElement('article');
  article.className = isPlayer ? 'npc-line player-line' : 'narration';
  article.dataset.entryId = entry.id;

  const actionsBar = document.createElement('div');
  actionsBar.className = 'entry-actions';
  actionsBar.setAttribute('aria-label', 'Entry actions');

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'entry-action-btn entry-btn-edit';
  editBtn.title = 'Edit this entry';
  editBtn.setAttribute('aria-label', 'Edit this entry');
  editBtn.innerHTML = '<span class="btn-icon">✏</span><span class="btn-label">Edit</span>';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'entry-action-btn entry-btn-delete';
  deleteBtn.title = 'Delete this entry';
  deleteBtn.setAttribute('aria-label', 'Delete this entry');
  deleteBtn.innerHTML = '<span class="btn-icon">🗑</span><span class="btn-label">Delete</span>';

  actionsBar.append(editBtn, deleteBtn);

  let textContainer;
  let actionTextElement;

  if (isPlayer) {
    const name = character.name || 'Adventurer';
    const initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

    const avatar = document.createElement(character.image_data ? 'img' : 'div');
    avatar.className = 'avatar';
    if (character.image_data) {
      avatar.src = character.image_data;
      avatar.alt = `${name} avatar`;
      avatar.title = `${name} avatar`;
      avatar.style.objectFit = 'cover';
    } else {
      avatar.textContent = initials;
    }

    textContainer = document.createElement('div');
    textContainer.className = 'player-line-content';

    const speaker = document.createElement('p');
    speaker.className = 'speaker';
    speaker.textContent = name;
    const speakerTag = document.createElement('span');
    speakerTag.textContent = 'You';
    speaker.append(speakerTag);

    actionTextElement = document.createElement('p');
    actionTextElement.className = 'player-action-text';
    if (Array.isArray(entry.partyTurn) && entry.partyTurn.length) {
      entry.partyTurn.forEach((line, index) => {
        if (index) actionTextElement.append(document.createElement('br'));
        const label = document.createElement('strong');
        label.textContent = `${Number(line.characterId) === Number(character.id) ? 'You' : line.label}: `;
        actionTextElement.append(label, document.createTextNode(line.text || ''));
      });
    } else {
      actionTextElement.textContent = entry.text || '';
    }

    textContainer.append(speaker, actionTextElement);
    const fateBadge = createFateBadge(entry.fateCheck);
    const skillBadge = createSkillBadge(entry.skillCheck);
    const badges = entry.skillCheck?.order === 'FATE_FIRST' ? [fateBadge, skillBadge] : [skillBadge, fateBadge];
    badges.filter(Boolean).forEach((badge) => textContainer.append(badge));
    article.append(avatar, textContainer, actionsBar);
  } else {
    const mark = document.createElement('span');
    mark.className = 'entry-mark';
    mark.textContent = '✦';

    const activeNpcs = entry.targetNpcId === null
      ? []
      : (entry.targetNpcId ? npcs.filter((n) => n.id === entry.targetNpcId || n.character_id === entry.targetNpcId) : npcs);

    textContainer = document.createElement('div');
    textContainer.className = 'narration-content';
    renderNarration(textContainer, entry.text || '', activeNpcs);

    article.append(mark, textContainer, actionsBar);
  }

  // --- Inline Edit Mode ---
  let isEditing = false;
  let editBox = null;

  const startEditing = () => {
    if (isEditing) return;
    isEditing = true;

    editBox = document.createElement('div');
    editBox.className = 'entry-edit-box';

    const textarea = document.createElement('textarea');
    textarea.className = 'entry-edit-textarea';
    textarea.value = entry.text || '';
    textarea.rows = Math.min(10, Math.max(3, (entry.text || '').split('\n').length + 1));

    const controls = document.createElement('div');
    controls.className = 'entry-edit-controls';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'entry-edit-btn entry-btn-save';
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'entry-edit-btn entry-btn-cancel';
    cancelBtn.textContent = 'Cancel';

    const hint = document.createElement('span');
    hint.className = 'entry-edit-hint';
    hint.textContent = 'Ctrl+Enter to save · Esc to cancel';

    controls.append(saveBtn, cancelBtn, hint);
    editBox.append(textarea, controls);

    // Swap views
    textContainer.style.display = 'none';
    actionsBar.style.display = 'none';

    article.insertBefore(editBox, actionsBar);

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    const autoResize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(60, textarea.scrollHeight + 4)}px`;
    };
    textarea.addEventListener('input', autoResize);
    autoResize();

    const finishEdit = (saved) => {
      if (saved) {
        const newText = textarea.value.trim();
        if (!newText) {
          alert('Message cannot be empty.');
          return;
        }
        entry.text = newText;
        if (isPlayer) {
          if (actionTextElement) actionTextElement.textContent = newText;
        } else {
          renderNarration(textContainer, newText, activeNpcs);
        }
        if (typeof onEdit === 'function') {
          onEdit(entry.id, newText);
        }
      }
      editBox.remove();
      editBox = null;
      textContainer.style.display = '';
      actionsBar.style.display = '';
      isEditing = false;
    };

    saveBtn.addEventListener('click', () => finishEdit(true));
    cancelBtn.addEventListener('click', () => finishEdit(false));

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        finishEdit(true);
      }
    });
  };

  editBtn.addEventListener('click', startEditing);

  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this message from history?')) {
      if (typeof onDelete === 'function') {
        onDelete(entry.id);
      }
      article.remove();
    }
  });

  return article;
}

export function appendPlayerAction(feed, action, character = {}, callbacks = {}) {
  const entry = {
    id: callbacks.id || `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'user',
    text: action,
    timestamp: Date.now()
  };
  const element = createStoryEntryElement({
    entry,
    character,
    onEdit: callbacks.onEdit,
    onDelete: callbacks.onDelete
  });
  feed.append(element);
  feed.scrollTop = feed.scrollHeight;
  return { entry, element };
}

export function appendNarration(feed, text, callbacks = {}) {
  const entry = {
    id: callbacks.id || `narration_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    text,
    timestamp: Date.now()
  };
  const element = createStoryEntryElement({
    entry,
    character: callbacks.character || {},
    npcs: callbacks.npcs || [],
    onEdit: callbacks.onEdit,
    onDelete: callbacks.onDelete
  });
  feed.append(element);
  feed.scrollTop = feed.scrollHeight;
  return { entry, element };
}

export function findNpcSpeaker(paragraphStr, previousParagraphStr, npcs = []) {
  if (!Array.isArray(npcs) || !npcs.length) return null;
  const clean = paragraphStr.trim();

  const tagMatch = clean.match(/^\[(?:Speaker:\s*)?([^\]]+)\]:\s*["“]?(.*?)["”]?$/is);
  if (tagMatch) {
    const speakerName = tagMatch[1].trim().toLowerCase();
    const npc = npcs.find((n) => {
      const full = (n.name || '').toLowerCase();
      const first = full.split(/\s+/)[0];
      return full === speakerName || first === speakerName;
    });
    if (npc) {
      return { npc, speech: tagMatch[2].trim() ? `"${tagMatch[2].trim()}"` : clean };
    }
    return null;
  }

  const colonMatch = clean.match(/^([A-Za-z\s']+):\s*["“](.+)["”]$/s);
  if (colonMatch) {
    const speakerName = colonMatch[1].trim().toLowerCase();
    const npc = npcs.find((n) => {
      const full = (n.name || '').toLowerCase();
      const first = full.split(/\s+/)[0];
      return full === speakerName || first === speakerName;
    });
    if (npc) {
      return { npc, speech: `"${colonMatch[2].trim()}"` };
    }
    return null;
  }

  const isQuoted = /^["“].+["”]$/s.test(clean);
  if (isQuoted && previousParagraphStr) {
    const sentences = previousParagraphStr.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
    const sentence = sentences[sentences.length - 1] || previousParagraphStr.trim();
    const verbMatches = [...sentence.matchAll(/\b(?:says?|said|speaks?|spoke|laughs?|laughed|asks?|asked|shouts?|shouted|exclaims?|exclaimed|replies?|replied|growls?|growled|whispers?|whispered)\b/gi)];

    if (verbMatches.length) {
      const lastVerb = verbMatches[verbMatches.length - 1];
      const beforeVerb = sentence.slice(0, lastVerb.index).trim();
      const immediateLead = beforeVerb.split(/[,;]|(?:\s+\band\b\s+)/i).pop()?.trim() || '';

      if (immediateLead) {
        const leadLower = immediateLead.toLowerCase();
        const matchedImmediate = npcs.find((n) => {
          const full = (n.name || '').toLowerCase();
          const first = full.split(/\s+/)[0];
          return leadLower.includes(full) || (first.length > 2 && leadLower.includes(first));
        });
        if (matchedImmediate) {
          return { npc: matchedImmediate, speech: clean };
        }

        if (/[A-Z][a-z]+/.test(immediateLead) && !/^(and|then|as|while|so|but)$/i.test(immediateLead)) {
          return null;
        }
      }

      const sentenceLead = beforeVerb.split(/[,;]/)[0]?.trim() || '';
      if (sentenceLead) {
        const leadLower = sentenceLead.toLowerCase();
        const matched = npcs.find((n) => {
          const full = (n.name || '').toLowerCase();
          const first = full.split(/\s+/)[0];
          return leadLower.includes(full) || (first.length > 2 && leadLower.includes(first));
        });
        if (matched) {
          return { npc: matched, speech: clean };
        }
      }
    }
  }

  return null;
}

const INLINE_EMPHASIS_PATTERN = /(\*\*\*|___)(?=\S)([\s\S]*?\S)\1|(\*\*|__)(?=\S)([\s\S]*?\S)\3|(\*|_)(?=\S)([\s\S]*?\S)\5(?![\w*])/g;

export function appendInlineMarkdown(element, text) {
  const source = String(text ?? '');
  let cursor = 0;
  for (const match of source.matchAll(INLINE_EMPHASIS_PATTERN)) {
    const [whole, , strongEm, , strong, , em] = match;
    const precedingChar = source[match.index - 1];
    if (match[5] === '_' && precedingChar && /\w/.test(precedingChar)) continue;
    if (match.index > cursor) element.append(source.slice(cursor, match.index));
    if (strongEm !== undefined) {
      const strongEl = document.createElement('strong');
      const emEl = document.createElement('em');
      appendInlineMarkdown(emEl, strongEm);
      strongEl.append(emEl);
      element.append(strongEl);
    } else if (strong !== undefined) {
      const strongEl = document.createElement('strong');
      appendInlineMarkdown(strongEl, strong);
      element.append(strongEl);
    } else {
      const emEl = document.createElement('em');
      appendInlineMarkdown(emEl, em);
      element.append(emEl);
    }
    cursor = match.index + whole.length;
  }
  if (cursor < source.length) element.append(source.slice(cursor));
  return element;
}

const SPEECH_OPEN_QUOTES = new Set(['"', '“']);
const SPEECH_CLOSE_QUOTES = new Set(['"', '”']);

function countSpeechQuotes(text) {
  return [...text].filter((character) => character === '"' || character === '“' || character === '”').length;
}

export function emphasizeSpeech(element) {
  if (!element || countSpeechQuotes(element.textContent || '') % 2 !== 0) return element;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  let inQuote = false;
  for (const node of textNodes) {
    const insideAction = Boolean(node.parentElement?.closest('em'));
    const text = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let buffer = '';
    const flush = (asSpeech) => {
      if (!buffer) return;
      if (asSpeech && !insideAction) {
        const speech = document.createElement('span');
        speech.className = 'story-speech';
        speech.textContent = buffer;
        fragment.append(speech);
      } else {
        fragment.append(document.createTextNode(buffer));
      }
      buffer = '';
    };
    for (const character of text) {
      if (!inQuote && SPEECH_OPEN_QUOTES.has(character)) {
        flush(false);
        inQuote = true;
        buffer += character;
      } else if (inQuote && SPEECH_CLOSE_QUOTES.has(character)) {
        buffer += character;
        flush(true);
        inQuote = false;
      } else {
        buffer += character;
      }
    }
    flush(inQuote);
    node.replaceWith(fragment);
  }
  return element;
}

export function renderNarration(container, text, npcs = []) {
  container.replaceChildren();
  const lines = String(text ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  let paragraphLines = [];
  let list;
  let lastNarrationText = '';

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const paragraphStr = paragraphLines.join(' ');
    paragraphLines = [];

    const match = findNpcSpeaker(paragraphStr, lastNarrationText, npcs);
    if (match) {
      const npcLine = document.createElement('div');
      npcLine.className = 'npc-line npc-speech';

      const avatar = document.createElement(match.npc.image_data ? 'img' : 'div');
      avatar.className = 'npc-avatar avatar';
      if (match.npc.image_data) {
        avatar.src = match.npc.image_data;
        avatar.alt = `${match.npc.name || 'NPC'} avatar`;
        avatar.title = `${match.npc.name || 'NPC'} avatar`;
      } else {
        avatar.textContent = (match.npc.name || 'N')[0].toUpperCase();
        avatar.setAttribute('aria-hidden', 'true');
      }

      const content = document.createElement('div');
      content.className = 'npc-speech-content';

      const speakerEl = document.createElement('p');
      speakerEl.className = 'speaker';
      speakerEl.textContent = match.npc.name || 'NPC';
      if (match.npc.job) {
        const jobTag = document.createElement('span');
        jobTag.textContent = match.npc.job;
        speakerEl.append(jobTag);
      }

      const textEl = document.createElement('p');
      textEl.className = 'npc-speech-text';
      appendInlineMarkdown(textEl, match.speech);
      emphasizeSpeech(textEl);

      content.append(speakerEl, textEl);
      npcLine.append(avatar, content);
      container.append(npcLine);
    } else {
      const paragraph = document.createElement('p');
      appendInlineMarkdown(paragraph, paragraphStr);
      emphasizeSpeech(paragraph);
      container.append(paragraph);
      lastNarrationText = paragraphStr;
    }
  };

  const flushList = () => {
    if (!list) return;
    container.append(list);
    list = null;
  };

  lines.forEach((line) => {
    const listItem = line.match(/^\s*[-*+]\s+(.+)$/u);
    if (listItem) {
      flushParagraph();
      if (!list) list = document.createElement('ul');
      const item = document.createElement('li');
      appendInlineMarkdown(item, listItem[1]);
      emphasizeSpeech(item);
      list.append(item);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    flushList();
    paragraphLines.push(line.trim());
  });

  flushParagraph();
  flushList();
}

export function appendStoryStatus(feed, text) {
  const article = document.createElement('article');
  article.className = 'story-transition';
  article.setAttribute('role', 'status');
  article.setAttribute('aria-live', 'polite');
  article.textContent = text;
  feed.append(article);
  feed.scrollTop = feed.scrollHeight;
  return article;
}
