// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.form.js — Leitura e limpeza do formulário               ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './nfeReceipts.config.js';
import { onlyDigits } from './nfeReceipts.utils.js';

export function readReceiptForm() {
  const els = getPageElements();

  return {
    receiverName: String(els.receiverName?.value || '').trim(),
    receiverDocument: onlyDigits(els.receiverDocument?.value),
    receiverPhone: String(els.receiverPhone?.value || '').trim(),
    notes: String(els.notes?.value || '').trim(),
    confirmed: Boolean(els.confirmCheck?.checked)
  };
}

export function clearReceiptForm() {
  const els = getPageElements();
  els.form?.reset();
}

export function readNfeNumber() {
  const els = getPageElements();
  return onlyDigits(els.nfeNumberInput?.value);
}

export function focusField(fieldKey) {
  const els = getPageElements();
  const el = els[fieldKey];
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof el.focus === 'function' && el.tagName !== 'DIV') {
    el.focus({ preventScroll: true });
  }
}
