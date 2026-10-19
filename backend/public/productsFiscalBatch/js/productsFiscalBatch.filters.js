// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.filters.js                               ║
// ║ MODULE: Products Fiscal Batch — Filters                            ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './productsFiscalBatch.state.js';

export function syncFiltersFromDom() {
  state.search = (dom.searchInput?.value || '').trim();
  state.linkedFilter = dom.linkedFilter?.value || '';
}

export function resetPage() {
  state.page = 1;
}

export function buildListParams() {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search,
    linkedFilter: state.linkedFilter,
  };
}
