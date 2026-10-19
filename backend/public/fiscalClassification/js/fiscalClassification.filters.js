// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.filters.js                              ║
// ║ MODULE: Fiscal Classification — Filters                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './fiscalClassification.config.js';
import { state } from './fiscalClassification.state.js';
import { $ } from './fiscalClassification.utils.js';

export function syncFiltersFromDom() {
  state.filters.query = ($('#busca')?.value || '').trim();
  state.filters.ncm = ($('#buscaNcm')?.value || '').trim();
  state.filters.cest = ($('#buscaCest')?.value || '').trim();
  state.filters.active = $('#filtroAtivo')?.value || 'all';
  state.page = 1;
}

export function buildListUrl() {
  const offset = (state.page - 1) * state.pageSize;
  const params = new URLSearchParams({
    search: state.filters.query,
    ncm: state.filters.ncm,
    cest: state.filters.cest,
    limit: String(state.pageSize),
    offset: String(offset),
  });

  if (state.filters.active !== 'all') {
    params.set('active', state.filters.active);
  }

  return `${ROUTES.fiscalClassifications}?${params.toString()}`;
}
