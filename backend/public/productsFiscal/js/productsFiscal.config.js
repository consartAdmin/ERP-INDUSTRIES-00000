// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.config.js                                      ║
// ║ MODULE: Products Fiscal — Configuration                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE = (
  window.apiBase ||
  window.API_BASE ||
  ''
).replace(/\/$/, '') || window.location.origin;

export const ROUTES = Object.freeze({
  productsFiscal: `${API_BASE}/api/v2/products-fiscal`,
  productsFiscalCurrent: `${API_BASE}/api/v2/products-fiscal/current`,
  fiscalClassificationById: (id) =>
    `${API_BASE}/api/v2/fiscal-classifications/${encodeURIComponent(id)}`,
  fiscalProfileById: (id) =>
    `${API_BASE}/api/v2/fiscal-profiles/${encodeURIComponent(id)}`,
});
