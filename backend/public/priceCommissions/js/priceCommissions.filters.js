// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.filters.js — Filtros | PRODNEX ERP                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './priceCommissions.config.js';

export function buildFilterParams() {
  return {
    q: dom.fQ.value.trim(),
    price_id: dom.fPrice.value,
    seller_id: dom.fSeller.value,
    active: dom.fActive.value,
    date: dom.fDate.value,
    limit: 500,
    offset: 0
  };
}

export function clearFilters() {
  dom.fQ.value = '';
  dom.fPrice.value = '';
  dom.fSeller.value = '';
  dom.fActive.value = 'true';
  dom.fDate.value = '';
}

