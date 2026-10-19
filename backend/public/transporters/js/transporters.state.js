// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.state.js — Estado do módulo Transportadoras            ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { DEFAULT_PAGE_SIZE } from './transporters.config.js';

export const state = {
  rows: [],
  filteredRows: [],
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  editingId: null,
  loading: false,
  attachments: []
};

export function resetPagination() {
  state.page = 1;
}

export function resetEditing() {
  state.editingId = null;
  state.attachments = [];
}
