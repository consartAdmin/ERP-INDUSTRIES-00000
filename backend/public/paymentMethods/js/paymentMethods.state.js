// Payment Methods — local UI state

'use strict';

export const paymentMethodsState = {
  rows: [],
  filteredRows: [],
  query: '',
  filters: {
    type: '',
    installments: '',
    status: '',
    tpag: '',
  },
  page: 1,
  pageSize: 50,
};

export function setRows(rows) {
  paymentMethodsState.rows = Array.isArray(rows) ? rows : [];
}

export function setFilteredRows(rows) {
  paymentMethodsState.filteredRows = Array.isArray(rows) ? rows : [];
}

export function setQuery(query) {
  paymentMethodsState.query = String(query || '').trim();
}

export function setFilter(name, value) {
  if (!(name in paymentMethodsState.filters)) return;
  paymentMethodsState.filters[name] = String(value ?? '').trim();
}

export function clearFilters() {
  paymentMethodsState.query = '';
  Object.keys(paymentMethodsState.filters).forEach(name => {
    paymentMethodsState.filters[name] = '';
  });
}

export function setPage(page) {
  const totalPages = getTotalPages();
  paymentMethodsState.page = Math.min(Math.max(Number(page) || 1, 1), totalPages);
}

export function setPageSize(pageSize) {
  paymentMethodsState.pageSize = Math.max(Number(pageSize) || 50, 1);
  paymentMethodsState.page = 1;
}

export function getTotalPages() {
  return Math.max(
    1,
    Math.ceil(paymentMethodsState.filteredRows.length / paymentMethodsState.pageSize),
  );
}

export function getVisibleRows() {
  const start = (paymentMethodsState.page - 1) * paymentMethodsState.pageSize;
  return paymentMethodsState.filteredRows.slice(start, start + paymentMethodsState.pageSize);
}
