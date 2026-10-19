// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.query.js — Query string builder                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './reportsProductsStock.state.js';

export function buildQueryParams({ forExport = false } = {}) {
  const sp = new URLSearchParams();

  if (state.q) sp.set('q', state.q);

  if (!forExport) {
    sp.set('page', String(state.page || 1));
    sp.set('limit', String(state.limit || 50));
  }

  if (state.order) sp.set('order', state.order);
  if (state.supplier_id) sp.set('supplier_id', state.supplier_id);
  if (state.group_id) sp.set('group_id', state.group_id);
  if (state.subgroup_id) sp.set('subgroup_id', state.subgroup_id);
  if (state.brand_id) sp.set('brand_id', state.brand_id);
  if (state.only_stock) sp.set('only_stock', '1');
  if (state.active !== '') sp.set('active', state.active);
  if (state.cost_min !== '' && state.cost_min !== null) sp.set('cost_min', String(state.cost_min));
  if (state.cost_max !== '' && state.cost_max !== null) sp.set('cost_max', String(state.cost_max));

  return sp;
}