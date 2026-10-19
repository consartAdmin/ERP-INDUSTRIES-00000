// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.modal.js                                    ║
// ║ MODULE: Locations Barcode — Modal                                  ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { state } from './locationsBarCode.state.js';
import { $, setValue } from './locationsBarCode.utils.js';

export function showFeedback(variant, title, message, timeoutMs) {
  showCenterModal({ variant, title, message, ...(timeoutMs ? { timeoutMs } : {}) });
}

export function forceCloseModalOnLoad() {
  closeDetailsModal();
}

export function openDetailsModal(row) {
  state.currentRecord = row;
  setValue('#detailBarcode', row.barcode);
  setValue('#detailType', row.barcode_type);
  setValue('#detailLocal', row.local);
  setValue('#detailCorridor', row.corredor);
  setValue('#detailShelf', row.prateleira);
  setValue('#detailBin', row.bandeja);
  setValue('#detailPosition', row.position);
  setValue('#detailStatus', row.active ? 'ATIVO' : 'INATIVO');
  const modal = $('#detailsModal');
  if (!modal) return;
  modal.hidden = false;
  modal.style.display = '';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

export function closeDetailsModal() {
  const modal = $('#detailsModal');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  state.currentRecord = null;
}

