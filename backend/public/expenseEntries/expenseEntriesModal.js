// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesModal.js — Modal behavior (PRODNEX ERP)                 ║
// ║ Path: backend/public/expenseEntries/expenseEntriesModal.js            ║
// ║ ESM: exporta setupExpenseEntriesModal + setExpenseEntriesModalOpen    ║
// ╚══════════════════════════════════════════════════════════════════════╝

let _inited = false;

function $(sel) {
  return document.querySelector(sel);
}

export function setExpenseEntriesModalOpen(open) {
  const modal = $('#modal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
}

export function setupExpenseEntriesModal() {
  if (_inited) return;
  _inited = true;

  const modal = $('#modal');
  if (!modal) return;

  const body = document.body;
  const card = modal.querySelector('.ee-modal-card');

  let lastActive = null;
  let lastBodyOverflow = '';

  function isOpen() {
    return modal.getAttribute('aria-hidden') === 'false';
  }

  function lockScroll() {
    lastBodyOverflow = body.style.overflow || '';
    body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    body.style.overflow = lastBodyOverflow;
  }

  function focusFirstField() {
    const candidates = ['#issueDate', '#documentType', '#supplierName', 'input,select,textarea,button'];
    for (const sel of candidates) {
      const el = modal.querySelector(sel);
      if (el && typeof el.focus === 'function' && !el.disabled) {
        el.focus({ preventScroll: true });
        return;
      }
    }
  }

  function onOpen() {
    lastActive = document.activeElement;
    lockScroll();
    setTimeout(focusFirstField, 0);
  }

  function onClose() {
    unlockScroll();
    if (lastActive && typeof lastActive.focus === 'function') {
      setTimeout(() => lastActive.focus({ preventScroll: true }), 0);
    }
    lastActive = null;
  }

  // Observa aria-hidden (caso você ainda use setAttribute direto)
  const obs = new MutationObserver((mutList) => {
    for (const m of mutList) {
      if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
        if (isOpen()) onOpen();
        else onClose();
      }
    }
  });
  obs.observe(modal, { attributes: true });

  // Clique no backdrop / data-close="1"
  modal.addEventListener('click', (ev) => {
    const t = ev.target;

    // clique direto no backdrop
    if (t && t.classList && t.classList.contains('ee-modal-backdrop')) {
      setExpenseEntriesModalOpen(false);
      return;
    }

    // qualquer elemento com data-close="1"
    const closeBtn = t?.closest?.('[data-close="1"]');
    if (closeBtn) {
      setExpenseEntriesModalOpen(false);
    }
  });

  // ESC fecha
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!isOpen()) return;
    ev.preventDefault();
    setExpenseEntriesModalOpen(false);
  });

  // evita propagação dentro do card
  if (card) card.addEventListener('click', (ev) => ev.stopPropagation());
}
