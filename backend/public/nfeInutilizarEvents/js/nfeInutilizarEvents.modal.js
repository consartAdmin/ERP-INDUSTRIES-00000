// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.modal.js — Controle do modal de inutilização    ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

const MODAL_ID = 'modalNovaInutilizacao';
const OPEN_BUTTON_ID = 'btnNovaInutilizacao';
const FIRST_FIELD_ID = 'companyCnpj';
const CLOSE_SELECTOR = '[data-modal-inutilizacao-close]';

let elementFocusedBeforeOpen = null;

function getModal() {
  return document.getElementById(MODAL_ID);
}

export function openModal() {
  const modal = getModal();

  if (!modal) {
    console.error(`Modal #${MODAL_ID} não encontrado.`);
    return;
  }

  elementFocusedBeforeOpen = document.activeElement;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    document.getElementById(FIRST_FIELD_ID)?.focus();
  });
}

export function closeModal() {
  const modal = getModal();
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  document.body.style.removeProperty('overflow');

  if (elementFocusedBeforeOpen instanceof HTMLElement) {
    elementFocusedBeforeOpen.focus();
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && getModal()?.classList.contains('is-open')) {
    closeModal();
  }
}

export function initModal() {
  const modal = getModal();

  document
    .getElementById(OPEN_BUTTON_ID)
    ?.addEventListener('click', openModal);

  modal?.querySelectorAll(CLOSE_SELECTOR).forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', handleKeydown);
}
