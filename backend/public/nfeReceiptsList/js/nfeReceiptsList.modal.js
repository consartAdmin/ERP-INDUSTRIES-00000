// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.modal.js — Modal da assinatura do recebedor         ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { MODAL_ID } from './nfeReceiptsList.config.js';

export function ensureSignatureModal() {
  const existing = document.getElementById(MODAL_ID);
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal modal-width-5';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="modal__backdrop" data-modal-close="true"></div>

    <div class="modal__dialog">
      <section class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="nrlSignatureTitle">
        <header class="modal__header">
          <h2 id="nrlSignatureTitle" class="modal__title">Assinatura do Recebedor</h2>
          <button type="button" class="modal__close" id="nrlSignatureClose"
            aria-label="Fechar modal" title="Fechar">&times;</button>
        </header>

        <div class="modal__body modal-section">
          <p class="nrl-signature-meta" id="nrlSignatureMeta"></p>

          <div class="nrl-signature-box">
            <p class="nrl-signature-status" id="nrlSignatureStatus">Carregando assinatura...</p>
            <img id="nrlSignatureImage" class="nrl-signature-image" alt="Assinatura do recebedor" hidden />
          </div>
        </div>

        <footer class="modal__footer">
          <button type="button" class="btn btn-cancel btn-sm" id="nrlSignatureCancel">Fechar</button>
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function getModalElements() {
  const overlay = ensureSignatureModal();
  return {
    overlay,
    meta: overlay.querySelector('#nrlSignatureMeta'),
    status: overlay.querySelector('#nrlSignatureStatus'),
    image: overlay.querySelector('#nrlSignatureImage'),
    closeBtn: overlay.querySelector('#nrlSignatureClose'),
    cancelBtn: overlay.querySelector('#nrlSignatureCancel')
  };
}

export function openSignatureModal({ imageUrl, meta = '' }) {
  const els = getModalElements();

  els.meta.textContent = meta;
  els.status.textContent = 'Carregando assinatura...';
  els.status.hidden = false;
  els.image.hidden = true;
  els.image.removeAttribute('src');
  els.image.src = imageUrl;

  els.overlay.hidden = false;
  els.overlay.classList.add('is-open');
  els.overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => els.closeBtn?.focus({ preventScroll: true }));
}

export function closeSignatureModal() {
  const els = getModalElements();

  els.overlay.classList.remove('is-open');
  els.overlay.setAttribute('aria-hidden', 'true');
  els.overlay.hidden = true;
  els.image.removeAttribute('src');

  if (!document.querySelector('.modal.is-open:not([hidden])')) {
    document.body.classList.remove('modal-open');
  }
}

export function bindSignatureModal() {
  const els = getModalElements();
  if (els.overlay.dataset.bound === 'true') return;
  els.overlay.dataset.bound = 'true';

  els.overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-close="true"]')) closeSignatureModal();
  });

  els.closeBtn.addEventListener('click', closeSignatureModal);
  els.cancelBtn.addEventListener('click', closeSignatureModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.overlay.hidden) closeSignatureModal();
  });

  els.image.addEventListener('load', () => {
    els.status.hidden = true;
    els.image.hidden = false;
  });

  els.image.addEventListener('error', () => {
    if (!els.image.getAttribute('src')) return;
    els.image.hidden = true;
    els.status.hidden = false;
    els.status.textContent = 'Assinatura não encontrada para este canhoto.';
  });
}
