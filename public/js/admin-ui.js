// Admin UI helpers: show each field's name on hover (and as placeholder for unlabeled row inputs).
(() => {
  const humanize = (n) => String(n || '').replace(/\[\]$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const labelText = (el) => {
    if (el.dataset.fieldLabel) return el.dataset.fieldLabel;
    let text = '';
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) text = l.textContent; }
    if (!text) { const l = el.closest('label'); if (l) { const c = l.cloneNode(true); c.querySelectorAll('input,select,textarea,small,option').forEach((x) => x.remove()); text = c.textContent; } }
    if (!text) text = el.getAttribute('aria-label') || '';
    text = text.replace(/\s+/g, ' ').trim();
    const name = humanize(el.name);
    return text || name || el.placeholder || '';
  };
  const tip = document.createElement('div');
  tip.className = 'adminFieldTip';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
  const fields = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea';
  const decorate = (root) => root.querySelectorAll?.(fields).forEach((el) => {
    if (el.dataset.fieldLabel) return;
    const t = labelText(el);
    if (!t) return;
    el.dataset.fieldLabel = t;
    if (!el.closest('label') && !el.placeholder && el.tagName !== 'SELECT') el.placeholder = t;
  });
  const show = (el) => { const t = el.dataset.fieldLabel; if (!t) return; const r = el.getBoundingClientRect(); tip.textContent = el.name ? `${t}  ·  ${el.name}` : t; tip.style.left = `${Math.max(8, Math.min(r.left, innerWidth - tip.offsetWidth - 8))}px`; tip.style.top = `${r.top - 30 < 4 ? r.bottom + 6 : r.top - 30}px`; tip.classList.add('show'); };
  const hide = () => tip.classList.remove('show');
  document.addEventListener('mouseover', (e) => { const el = e.target.closest?.(fields); if (el) { if (!el.dataset.fieldLabel) decorate(el.parentNode || document); show(el); } });
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.(fields)) hide(); });
  document.addEventListener('scroll', hide, true);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && decorate(n)))).observe(document.documentElement, { childList: true, subtree: true });
  // Tooltips must live inside the open modal's top layer to be visible above <dialog>
  document.addEventListener('mouseover', (e) => { const d = e.target.closest?.('dialog[open]'); const host = d || document.body; if (tip.parentNode !== host) host.appendChild(tip); });
})();
