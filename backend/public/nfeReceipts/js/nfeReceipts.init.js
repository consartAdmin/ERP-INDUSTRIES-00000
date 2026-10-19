// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.init.js — Entry point do Canhoto Digital (mobile)       ║
// ║ PRODNEX ERP                                                         ║
// ║ HTML importa somente este arquivo do módulo.                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './nfeReceipts.config.js';
import { getIdentifierFromUrl } from './nfeReceipts.utils.js';
import { createSignaturePad } from './nfeReceipts.signature.js';
import { ensureRefuseModal } from './nfeReceipts.modal.js';
import { renderSearch } from './nfeReceipts.render.js';
import {
  clearSignature,
  handleSignatureChange,
  loadReceipt,
  newSearch,
  refuseCurrentReceipt,
  requestLocation,
  searchReceipt,
  setSignaturePad,
  submitReceipt
} from './nfeReceipts.actions.js';

function bindPageEvents() {
  const els = getPageElements();

  els.btnSearchNfe?.addEventListener('click', searchReceipt);
  els.nfeNumberInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchReceipt();
    }
  });

  els.form?.addEventListener('submit', submitReceipt);
  els.btnRefuse?.addEventListener('click', refuseCurrentReceipt);
  els.btnClearSignature?.addEventListener('click', clearSignature);
  els.btnNewSearch?.addEventListener('click', newSearch);
}

function bootstrap() {
  const els = getPageElements();

  setSignaturePad(createSignaturePad(els.signatureCanvas, { onChange: handleSignatureChange }));
  ensureRefuseModal();
  bindPageEvents();
  requestLocation();

  // Link/QR code com a NF-e já identificada abre direto no canhoto.
  const identifier = getIdentifierFromUrl();

  if (identifier) {
    loadReceipt(identifier);
  } else {
    renderSearch();
  }
}

bootstrap();
