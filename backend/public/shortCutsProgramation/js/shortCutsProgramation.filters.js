// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.filters.js                              ║
// ║ MODULE: Programming Shortcuts — Filters                             ║
// ║ DESCRIPTION: Filtros, query string e controle da paginação          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els, state } from './shortCutsProgramation.state.js';

export function buildQuery() {
    const params = new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
    });

    const q = els.filterQ.value.trim();
    const categoryId = els.filterCategoryId.value.trim();
    const language = els.filterLanguage.value.trim();
    const active = els.filterActive.value;

    if (q) params.set('q', q);
    if (categoryId) params.set('category_id', categoryId);
    if (language) params.set('language', language);
    if (active !== '') params.set('active', active);

    return params.toString();
}

export function resetPagination() {
    state.page = 1;
}
