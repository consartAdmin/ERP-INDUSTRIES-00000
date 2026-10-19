// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.filters.js                                     ║
// ║ MODULE: Products Fiscal — Filters                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './productsFiscal.config.js';
import { state } from './productsFiscal.state.js';
import { value } from './productsFiscal.utils.js';

export function readListFilters() {
  return {
    query: value('q').trim(),
    limit: Number(value('limit') || 50),
    offset: state.currentOffset,
  };
}

export function buildListUrl(filters = readListFilters()) {
  const url = new URL(ROUTES.productsFiscal);
  if (filters.query) url.searchParams.set('product_code', filters.query);
  url.searchParams.set('current', 'true');
  url.searchParams.set('active', 'true');
  url.searchParams.set('limit', String(filters.limit));
  url.searchParams.set('offset', String(filters.offset));
  return url.toString();
}

export function resetListOffset() {
  state.currentOffset = 0;
}

export function previousListPage() {
  const limit = Number(value('limit') || 50);
  state.currentOffset = Math.max(0, state.currentOffset - limit);
}

export function nextListPage() {
  const limit = Number(value('limit') || 50);
  state.currentOffset += limit;
}
