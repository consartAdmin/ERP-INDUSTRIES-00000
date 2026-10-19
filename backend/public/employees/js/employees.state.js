// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.state.js — State do módulo (PRODNEX ERP | ESM)                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

export const state = {
  list: [],
  selectedId: null,
  docs: [],
  lastQuery: '',
  includeInactive: false,

  // paginação (server-side: limit/offset)
  page: 1,
  pageSize: 50,
  total: 0,
};