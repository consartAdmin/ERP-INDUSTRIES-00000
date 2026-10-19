// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.filters.js                                       ║
// ║ MODULE: Products Kits — Filters                                     ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './productsKits.state.js';

export function readListFilters() {
  return {
    q: dom.searchKit?.value?.trim() || '',
    active: 'all',
  };
}
