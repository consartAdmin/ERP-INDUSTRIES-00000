// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.shortcuts.js — Keyboard shortcuts: SA / Ctrl+S             ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

let __keyBuffer = '';
let __keyBufferTimer = null;

function isTypingContext() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' && el.readOnly) return false;
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

export function bindKeyboardShortcuts({ triggerSave }) {
  document.addEventListener('keydown', (ev) => {
    if (ev.isComposing) return;

    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      triggerSave?.();
      return;
    }

    if (isTypingContext()) return;

    const k = (ev.key || '').toUpperCase();
    if (k.length !== 1 || !/[A-Z0-9]/.test(k)) return;

    __keyBuffer += k;

    clearTimeout(__keyBufferTimer);
    __keyBufferTimer = setTimeout(() => { __keyBuffer = ''; }, 800);

    if (__keyBuffer.endsWith('SA')) {
      __keyBuffer = '';
      triggerSave?.();
    }
  });
}

export function applySaveHotkeyHint(els) {
  const targets = [els.btnSaveInventory].filter(Boolean);
  targets.forEach((btn) => {
    btn.innerHTML = `
      <span class="btn-label">
        <span class="kbd-hotkey">Sa</span>lvar inventário
      </span>
    `;
    btn.title = 'Atalho: SA (sequencial) / Ctrl+S';
    btn.setAttribute('aria-keyshortcuts', 'S A Ctrl+S');
    btn.style.gap = '0';
  });
}