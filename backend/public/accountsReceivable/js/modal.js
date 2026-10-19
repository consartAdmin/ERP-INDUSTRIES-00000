const modalState = new WeakMap();
let initialized = false;

function getModal(modalOrId) {
  if (modalOrId instanceof HTMLElement) return modalOrId;
  return document.getElementById(String(modalOrId).replace(/^#/, ''));
}

function getOpenModals() {
  return [...document.querySelectorAll('.modal.is-open')];
}

function getFocusableElements(modal) {
  const selector = [
    'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    'a[href]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return [...modal.querySelectorAll(selector)]
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function focusInitialElement(modal, focusSelector) {
  const target = (focusSelector ? modal.querySelector(focusSelector) : null)
    ?? modal.querySelector('[autofocus]')
    ?? getFocusableElements(modal)[0]
    ?? modal.querySelector('.modal__panel');
  requestAnimationFrame(() => target?.focus({ preventScroll: true }));
}

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
  modal.dispatchEvent(new CustomEvent('modal:open', { bubbles: true, detail: { modal } }));
  return true;
}

function close(modalOrId) {
  const modal = getModal(modalOrId);
  if (!modal || !modal.classList.contains('is-open')) return false;
  const state = modalState.get(modal);
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (getOpenModals().length === 0) {
    document.body.style.overflow = state?.previousBodyOverflow ?? '';
  }
  state?.previousFocus?.focus?.({ preventScroll: true });
  modalState.delete(modal);
  modal.dispatchEvent(new CustomEvent('modal:close', { bubbles: true, detail: { modal } }));
  return true;
}

function closeTopmost() {
  const topmostModal = getOpenModals().at(-1);
  return topmostModal ? close(topmostModal) : false;
}

function isOpen(modalOrId) {
  return getModal(modalOrId)?.classList.contains('is-open') ?? false;
}

function handleClick(event) {
  const openTrigger = event.target.closest?.('[data-modal-open]');
  if (openTrigger) {
    open(openTrigger.dataset.modalOpen, { focusSelector: openTrigger.dataset.modalFocus });
    return;
  }
  const closeTrigger = event.target.closest?.('[data-modal-close]');
  if (closeTrigger) {
    const modal = closeTrigger.closest('.modal');
    if (modal) close(modal);
  }
}

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

function setup() {
  if (initialized) return;
  initialized = true;
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.classList.toggle('is-open', modal.getAttribute('aria-hidden') === 'false');
    const panel = modal.querySelector('.modal__panel');
    if (panel && !panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  });
}

export const Modal = { setup, open, close, closeTopmost, isOpen };
