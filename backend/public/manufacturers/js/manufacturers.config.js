function resolveApiBase() {
  try {
    if (typeof globalThis.getApiBase === 'function') return globalThis.getApiBase();
    if (window.apiBase) return window.apiBase;
  } catch (error) {
    console.error('[manufacturers] erro ao ler apiBase:', error);
  }
  return 'http://localhost:8080';
}

export const API_URL = `${resolveApiBase().replace(/\/$/, '')}/api/manufacturers`;

export const $ = (selector, root = document) => root.querySelector(selector);

export const elements = Object.freeze({
  searchInput: $('#searchInput'),
  btnNew: $('#btnNew'),
  btnReload: $('#btnReload'),
  pageSizeSelect: $('#pageSizeSelect'),
  tableBody: $('#tableBody'),
  prevPageBtn: $('#prevPage'),
  nextPageBtn: $('#nextPage'),
  pageInfo: $('#pageInfo'),
  tableInfo: $('#tableInfo'),
  form: $('#formManufacturer'),
  fieldId: $('#manufacturer_id'),
  btnCancel: $('#btnCancel'),
});
