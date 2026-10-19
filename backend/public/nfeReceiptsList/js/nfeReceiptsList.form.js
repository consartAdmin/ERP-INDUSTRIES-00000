// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.form.js — Leitura e preenchimento dos filtros       ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './nfeReceiptsList.config.js';

export function readFilters() {
  const els = getPageElements();

  return {
    q: String(els.searchInput?.value || '').trim(),
    status: String(els.statusFilter?.value || '').trim().toUpperCase(),
    dateFrom: String(els.dateFrom?.value || ''),
    dateTo: String(els.dateTo?.value || '')
  };
}

export function fillFilters(filters = {}) {
  const els = getPageElements();

  if (els.searchInput) els.searchInput.value = filters.q || '';
  if (els.statusFilter) els.statusFilter.value = filters.status || '';
  if (els.dateFrom) els.dateFrom.value = filters.dateFrom || '';
  if (els.dateTo) els.dateTo.value = filters.dateTo || '';
}

export function readPageSize() {
  const els = getPageElements();
  const value = Number(els.pageSize?.value);
  return Number.isInteger(value) && value > 0 ? value : null;
}
