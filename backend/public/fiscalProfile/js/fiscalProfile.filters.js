// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.filters.js                                      ║
// ║ MODULE: Fiscal Profile — Filters                                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './fiscalProfile.state.js';

export function syncFiltersFromDom() {
  state.q = (dom.searchInput?.value || '').trim();
  state.page = 1;
}

export function buildListParams() {
  const offset = (state.page - 1) * state.pageSize;

  return new URLSearchParams({
    search: state.q,
    limit: String(state.pageSize),
    offset: String(offset),
  });
}
