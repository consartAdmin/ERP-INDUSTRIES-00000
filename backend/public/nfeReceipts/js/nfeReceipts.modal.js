// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.modal.js — Modal "Motivo da recusa"                     ║
// ║ PRODNEX ERP                                                         ║
// ║ Substitui o prompt(), que é bloqueado em navegadores embutidos      ║
// ║ (WhatsApp, Instagram etc.).                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { REFUSE_MODAL_ID } from './nfeReceipts.config.js';
import { validateRefuseReason } from './nfeReceipts.validation.js';

let resolvePending = null;

export function ensureRefuseModal() {
  const existing = document.getElementById(REFUSE_MODAL_ID);
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = REFUSE_MODAL_ID;
  modal.className = 'nr-modal hidden';
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="nr-modal__backdrop" data-refuse-close="true"></div>

    <section class="nr-modal__panel" role="dialog" aria-modal="true" aria-labelledby="nrRefuseTitle">
      <h2 id="nrRefuseTitle" class="nr-modal__title">Recusar recebimento</h2>

      <label class="nr-field" for="nrRefuseReason">
        Motivo da recusa *
        <textarea id="nrRefuseReason" rows="4" maxlength="500"
          placeholder="Ex.: mercadoria avariada, pedido incorreto..."></textarea>
      </label>

      <p class="nr-modal__error hidden" id="nrRefuseError" role="alert"></p>

      <div class="nr-modal__actions">
        <button type="button" class="nr-btn nr-btn--danger" id="nrRefuseConfirm">Confirmar recusa</button>
        <button type="button" class="nr-btn nr-btn--secondary" data-refuse-close="true">Voltar</button>
      </div>
    </section>
  `;

  document.body.appendChild(modal);
  bindRefuseModal(modal);
  return modal;
}

function getModalElements() {
  const overlay = ensureRefuseModal();
  return {
    overlay,
    reason: overlay.querySelector('#nrRefuseReason'),
    error: overlay.querySelector('#nrRefuseError'),
    confirm: overlay.querySelector('#nrRefuseConfirm')
  };
}

function close(result) {
  const els = getModalElements();
  els.overlay.classList.add('hidden');
  els.overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('nr-modal-open');

  const resolve = resolvePending;
  resolvePending = null;
  resolve?.(result);
}

function bindRefuseModal(overlay) {
  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-refuse-close="true"]')) close(null);
  });

  overlay.querySelector('#nrRefuseConfirm').addEventListener('click', () => {
    const els = getModalElements();
    const reason = els.reason.value.trim();
    const error = validateRefuseReason(reason);

    if (error) {
      els.error.textContent = error;
      els.error.classList.remove('hidden');
      els.reason.focus();
      return;
    }

    close(reason);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && resolvePending) close(null);
  });
}

/** Abre o modal e resolve com o motivo digitado, ou null se cancelado. */
export function askRefuseReason() {
  const els = getModalElements();

  els.reason.value = '';
  els.error.textContent = '';
  els.error.classList.add('hidden');

  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('nr-modal-open');

  requestAnimationFrame(() => els.reason.focus());

  return new Promise((resolve) => {
    resolvePending = resolve;
  });
}
