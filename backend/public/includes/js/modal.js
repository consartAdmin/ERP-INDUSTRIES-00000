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

  resetPosition(modal);
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
  resetPosition(modal);

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
// 8. DRAG (move the panel by its header or footer)
// ──────────────────────────────────────────────────────────────────────
// Every .modal can be dragged by .modal__header or .modal__footer.
// Buttons, fields and links inside them keep working normally.
// Opt out with data-modal-draggable="false" on the .modal element.
// The position is reset each time the modal opens or closes.

const DRAG_HANDLE = '.modal__header, .modal__footer';
const DRAG_IGNORE = [
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  'label',
  '[contenteditable="true"]',
  '[data-modal-no-drag]',
].join(',');

const dragOffsets = new WeakMap();
let dragging = null;
let suppressNextClick = false;

function getOffset(panel) {
  return dragOffsets.get(panel) ?? { x: 0, y: 0 };
}

function setOffset(panel, x, y) {
  dragOffsets.set(panel, { x, y });
  panel.style.translate = x || y ? `${x}px ${y}px` : '';
}

function resetPosition(modal) {
  modal.querySelectorAll('.modal__panel').forEach((panel) => {
    if (dragOffsets.has(panel)) setOffset(panel, 0, 0);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function handleDragStart(event) {
  if (event.button !== 0 || !event.isPrimary) return;

  const handle = event.target.closest?.(DRAG_HANDLE);
  if (!handle || event.target.closest(DRAG_IGNORE)) return;

  const modal = handle.closest('.modal');
  const panel = handle.closest('.modal__panel');
  if (!modal || !panel || !modal.classList.contains('is-open')) return;
  if (modal.dataset.modalDraggable === 'false') return;

  const rect = panel.getBoundingClientRect();
  const offset = getOffset(panel);

  dragging = {
    panel,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: offset.x,
    offsetY: offset.y,
    // Panel position without the current offset.
    left: rect.left - offset.x,
    top: rect.top - offset.y,
    width: rect.width,
    height: rect.height,
    moved: false,
  };

  event.preventDefault();
  panel.classList.add('is-dragging');
}

function handleDragMove(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;

  const dx = event.clientX - dragging.startX;
  const dy = event.clientY - dragging.startY;
  if (!dragging.moved && Math.hypot(dx, dy) < 3) return;
  dragging.moved = true;

  // The whole panel stays inside the window.
  const { left, top, width, height } = dragging;
  const x = clamp(dragging.offsetX + dx, -left, window.innerWidth - width - left);
  const y = clamp(dragging.offsetY + dy, -top, window.innerHeight - height - top);

  setOffset(dragging.panel, x, y);
}

function handleDragEnd(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;

  dragging.panel.classList.remove('is-dragging');
  // A drag that ends over the backdrop must not count as a click on it.
  suppressNextClick = dragging.moved;
  dragging = null;

  if (suppressNextClick) {
    setTimeout(() => { suppressNextClick = false; }, 0);
  }
}

function handleClickAfterDrag(event) {
  if (!suppressNextClick) return;
  suppressNextClick = false;
  event.stopPropagation();
  event.preventDefault();
}

function setupDrag() {
  document.addEventListener('pointerdown', handleDragStart);
  document.addEventListener('pointermove', handleDragMove);
  document.addEventListener('pointerup', handleDragEnd);
  document.addEventListener('pointercancel', handleDragEnd);
  document.addEventListener('click', handleClickAfterDrag, true);
}

// Drag works on every page that loads this file (core.js imports it),
// including modals that are opened by their own code instead of Modal.open().
setupDrag();

// ──────────────────────────────────────────────────────────────────────
// 9. GLOBAL INITIALIZATION
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
// 10. PUBLIC API
// ──────────────────────────────────────────────────────────────────────

export const Modal = {
  setup,
  open,
  close,
  closeTopmost,
  isOpen,
  resetPosition: (modalOrId) => {
    const modal = getModal(modalOrId);
    if (modal) resetPosition(modal);
  },
};

// Usage in the main application entry point:
// import { Modal } from '/includes/js/modal.js';
// Modal.setup();

// Usage in a module:
// Modal.open('expenseEntryModal', { focusSelector: '#issueDate' });
// Modal.close('expenseEntryModal');
