// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.config.js — Configuração do módulo Transportadoras     ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_TRANSPORTERS = '/api/transporters';
export const API_PUBLIC_CNPJ = (cnpj) => `/api/public-cnpj/${encodeURIComponent(cnpj)}`;
export const API_IBGE_RESOLVE_CITY = (uf, city) =>
  `/api/ibge-locations/resolve?uf=${encodeURIComponent(uf)}&city=${encodeURIComponent(city)}`;

export const DEFAULT_PAGE_SIZE = 50;
export const MODAL_ID = 'transportersModalOverlay';

export const SELECTORS = Object.freeze({
  searchInput: '#searchInput',
  searchCity: '#searchCity',
  searchState: '#searchState',
  searchStatus: '#searchStatus',
  btnSearch: '#btnSearch',
  btnRefresh: '#btnRefresh',
  btnNew: '#btnNew',
  btnPrevious: '#btnPrevious',
  btnNext: '#btnNext',
  pageSize: '#pageSize',
  bodyTable: '#bodyTable',
  apTableInfo: '#apTableInfo',
  pageInfo: '#pageInfo'
});

export function getPageElements() {
  const elements = {};
  for (const [key, selector] of Object.entries(SELECTORS)) {
    elements[key] = document.querySelector(selector);
  }
  return elements;
}
