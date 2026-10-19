// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.config.js                                        ║
// ║ MODULE: Products Kits — Configuration                               ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE = '/api/products-kits';

export const ROUTES = Object.freeze({
  list: API_BASE,
  create: API_BASE,
  byId: (id) => `${API_BASE}/${id}`,
  update: (id) => `${API_BASE}/${id}`,
  deactivate: (id) => `${API_BASE}/${id}/deactivate`,
});

export const PRODUCTS_MODAL_OPTIONS = Object.freeze({
  apiBase: '',
  defaultVarejoPriceId: 1,
});
