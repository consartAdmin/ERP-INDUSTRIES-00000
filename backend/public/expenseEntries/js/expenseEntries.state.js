// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.state.js — Shared state (PRODNEX ERP)                ║
// ║ Path: backend/public/expenseEntries/expenseEntries.state.js          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULT_PAGE_SIZE } from './expenseEntries.config.js';

export const state = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  paging: { total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE },
  rows: [],
  xmlItems: [],
};

