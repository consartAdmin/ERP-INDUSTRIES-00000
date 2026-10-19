// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.state.js — Estado do módulo Canhotos Digitais       ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { DEFAULT_PAGE_SIZE } from './nfeReceiptsList.config.js';

export const state = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  filters: {
    q: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  },
  rows: [],
  isLoading: false
};

export function getTotalPages() {
  return Math.max(1, Math.ceil(state.total / state.limit));
}

export function findRowById(receiptId) {
  return state.rows.find((row) => String(row.receipt_id) === String(receiptId)) || null;
}
