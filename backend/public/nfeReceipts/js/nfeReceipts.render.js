// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.render.js — Telas do Canhoto Digital                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements, STATUS_LABELS } from './nfeReceipts.config.js';
import { formatMoney, show, hide } from './nfeReceipts.utils.js';

export function statusLabel(status) {
  const key = String(status || '').toUpperCase();
  return STATUS_LABELS[key] || key || '-';
}

export function renderSearch() {
  const els = getPageElements();

  show(els.searchBox);
  hide(els.loadingBox);
  hide(els.errorBox);
  hide(els.receiptContent);
  hide(els.successBox);
  hide(els.closedBox);
  hide(els.btnNewSearch);
}

export function renderLoading() {
  const els = getPageElements();

  show(els.loadingBox);
  hide(els.errorBox);
  hide(els.receiptContent);
}

export function renderError(message) {
  const els = getPageElements();

  hide(els.loadingBox);
  hide(els.receiptContent);
  hide(els.successBox);

  els.errorBox.textContent = message;
  show(els.errorBox);
}

/**
 * Mostra o resumo da NF-e e decide a tela:
 * PENDING → formulário | SIGNED → sucesso | REFUSED/CANCELLED → encerrado.
 */
export function renderReceipt(row) {
  const els = getPageElements();
  const status = String(row?.status || '').toUpperCase();

  els.nfeNumero.textContent = row?.numero || row?.nfe_number || '-';
  els.nfeSerie.textContent = row?.serie || '-';
  els.nfeValor.textContent = formatMoney(row?.total_nf ?? row?.total_amount);
  els.receiptStatus.textContent = statusLabel(status);
  els.receiptStatus.dataset.status = status;

  hide(els.loadingBox);
  hide(els.errorBox);
  hide(els.searchBox);
  show(els.receiptContent);
  show(els.btnNewSearch);

  hide(els.form);
  hide(els.successBox);
  hide(els.closedBox);

  if (status === 'PENDING') {
    show(els.form);
  } else if (status === 'SIGNED') {
    show(els.successBox);
  } else {
    els.closedBox.textContent = status === 'REFUSED'
      ? 'Este recebimento foi recusado.'
      : 'Este canhoto está cancelado e não pode ser assinado.';
    show(els.closedBox);
  }
}

export function renderSubmitting(isSubmitting) {
  const els = getPageElements();

  els.btnSubmit.disabled = isSubmitting;
  els.btnRefuse.disabled = isSubmitting;
  els.btnClearSignature.disabled = isSubmitting;
  els.btnSubmit.textContent = isSubmitting ? 'Enviando...' : 'Confirmar Recebimento';
}

export function renderSignatureHint(isEmpty) {
  const els = getPageElements();
  els.signatureHint?.classList.toggle('hidden', !isEmpty);
  els.signatureWrap?.classList.remove('is-invalid');
}

export function markSignatureInvalid() {
  const els = getPageElements();
  els.signatureWrap?.classList.add('is-invalid');
}
