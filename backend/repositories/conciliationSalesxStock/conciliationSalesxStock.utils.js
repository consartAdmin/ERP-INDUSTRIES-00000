// ╔════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStock.utils.js — Ordenação e filtros de período  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { SORT_COLUMNS_OPERATION, SORT_COLUMNS_TOTAL } from './conciliationSalesxStock.constants.js';

export function normalizeSortDirection(value) {
  return String(value || '').trim().toLowerCase() === 'desc' ? 'DESC' : 'ASC';
}

export function resolveSort(filters = {}) {
  const map = filters.viewMode === 'total'
    ? SORT_COLUMNS_TOTAL
    : SORT_COLUMNS_OPERATION;
  const requested = String(filters.sortColumn || 'movement_date').trim();
  const column = Object.prototype.hasOwnProperty.call(map, requested)
    ? requested
    : 'movement_date';

  return {
    column,
    expression: map[column],
    direction: normalizeSortDirection(filters.sortDirection),
  };
}

export function buildFilters(filters = {}) {
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const past = new Date(today);
  past.setUTCDate(past.getUTCDate() - 30);

  return {
    values: [
      filters.dateStart || past.toISOString().slice(0, 10),
      filters.dateEnd || defaultEnd,
    ],
    nextIndex: 3,
  };
}
