// ╔══════════════════════════════════════════════════════════════════════╗
// ║ modal.js — Global Modal Controller (PRODNEX ERP)                    ║
// ║ Suggested path: backend/public/includes/js/modal.js                 ║
// ║ ESM API: Modal.setup(), Modal.open(), Modal.close(), Modal.isOpen() ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────────────
// 1. PRIVATE STATE
// ──────────────────────────────────────────────────────────────────────

const modalState = new WeakMap();
let initialized = false;

// ──────────────────────────────────────────────────────────────────────
// 2. MODAL LOOKUP
// ──────────────────────────────────────────────────────────────────────

function getModal(modalOrId) {
  if (modalOrId instanceof HTMLElement) return modalOrId;

  const id = String(modalOrId).replace(/^#/, '');
  return document.getElementById(id);
}

function getOpenModals() {
  return [...document.querySelectorAll('.modal.is-open')];
}

// ──────────────────────────────────────────────────────────────────────
// 3. FOCUS MANAGEMENT
// ──────────────────────────────────────────────────────────────────────

function getFocusableElements(modal) {
  const selector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return [...modal.querySelectorAll(selector)].filter((element) => {
    return !element.hidden && element.getClientRects().length > 0;
  });
}

function focusInitialElement(modal, focusSelector) {
  const selectedElement = focusSelector
    ? modal.querySelector(focusSelector)
    : null;

  const target =
    selectedElement ??
    modal.querySelector('[autofocus]') ??
    getFocusableElements(modal)[0] ??
    modal.querySelector('.modal__panel');

  requestAnimationFrame(() => {
    target?.focus({ preventScroll: true });
  });
}

// ──────────────────────────────────────────────────────────────────────
// 4. OPEN MODAL
// ──────────────────────────────────────────────────────────────────────

function open(modalOrId, options = {}) {
  const modal = getModal(modalOrId);
  if (!modal || modal.classList.contains('is-open')) return false;

  modalState.set(modal, {
    previousFocus: document.activeElement,
    previousBodyOverflow: document.body.style.overflow,
  });

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  focusInitialElement(modal, options.focusSelector);

  modal.dispatchEvent(new CustomEvent('modal:open', {
    bubbles: true,
    detail: { modal },
  }));

  return true;
}

// ──────────────────────────────────────────────────────────────────────
// 5. CLOSE MODAL
// ──────────────────────────────────────────────────────────────────────

function close(modalOrId) {
  const modal = getModal(modalOrId);
  if (!modal || !modal.classList.contains('is-open')) return false;

  const state = modalState.get(modal);

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  const remainingOpenModals = getOpenModals();
  if (remainingOpenModals.length === 0) {
    document.body.style.overflow = state?.previousBodyOverflow ?? '';
  }

  state?.previousFocus?.focus?.({ preventScroll: true });
  modalState.delete(modal);

  modal.dispatchEvent(new CustomEvent('modal:close', {
    bubbles: true,
    detail: { modal },
  }));

  return true;
}

function closeTopmost() {
  const topmostModal = getOpenModals().at(-1);
  return topmostModal ? close(topmostModal) : false;
}

function isOpen(modalOrId) {
  return getModal(modalOrId)?.classList.contains('is-open') ?? false;
}

// ──────────────────────────────────────────────────────────────────────
// 6. CLICK EVENTS
// ──────────────────────────────────────────────────────────────────────

function handleClick(event) {
  const openTrigger = event.target.closest?.('[data-modal-open]');

  if (openTrigger) {
    open(openTrigger.dataset.modalOpen, {
      focusSelector: openTrigger.dataset.modalFocus,
    });
    return;
  }

  const closeTrigger = event.target.closest?.('[data-modal-close]');

  if (closeTrigger) {
    const modal = closeTrigger.closest('.modal');
    if (modal) close(modal);
  }
}

// ──────────────────────────────────────────────────────────────────────
// 7. KEYBOARD EVENTS AND FOCUS TRAP
// ──────────────────────────────────────────────────────────────────────

function handleKeydown(event) {
  if (event.key === 'Escape') {
    if (closeTopmost()) event.preventDefault();
    return;
  }

  if (event.key !== 'Tab') return;

  const modal = getOpenModals().at(-1);
  if (!modal) return;

  const focusable = getFocusableElements(modal);

  if (focusable.length === 0) {
    event.preventDefault();
    modal.querySelector('.modal__panel')?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// ──────────────────────────────────────────────────────────────────────
// 8. GLOBAL INITIALIZATION
// ──────────────────────────────────────────────────────────────────────

function setup() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);

  document.querySelectorAll('.modal').forEach((modal) => {
    const initiallyOpen = modal.getAttribute('aria-hidden') === 'false';
    modal.classList.toggle('is-open', initiallyOpen);

    const panel = modal.querySelector('.modal__panel');
    if (panel && !panel.hasAttribute('tabindex')) {
      panel.setAttribute('tabindex', '-1');
    }
  });
}

// ──────────────────────────────────────────────────────────────────────
// 9. PUBLIC API
// ──────────────────────────────────────────────────────────────────────

export const Modal = {
  setup,
  open,
  close,
  closeTopmost,
  isOpen,
};

// Usage in the main application entry point:
// import { Modal } from '/includes/js/modal.js';
// Modal.setup();

// Usage in a module:
// Modal.open('expenseEntryModal', { focusSelector: '#issueDate' });
// Modal.close('expenseEntryModal');
