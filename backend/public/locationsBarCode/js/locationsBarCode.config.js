// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.config.js                                   ║
// ║ MODULE: Locations Barcode — Configuration                          ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function getApiBase() {
  try {
    if (typeof window.getApiBase === 'function') return window.getApiBase();
  } catch (error) {
    console.error('[locationsBarCode] getApiBase:', error);
  }
  return window.location.origin || 'http://localhost:8080';
}

export const API_BASE = getApiBase();
export const BARCODE_API = `${API_BASE}/api/locations-barcode`;

export const ROUTES = Object.freeze({
  list: `${BARCODE_API}?limit=5000`,
  byId: (id) => `${BARCODE_API}/${encodeURIComponent(id)}`,
  read: (barcode) => `${BARCODE_API}/read/${encodeURIComponent(barcode)}`,
  generateBins: `${BARCODE_API}/generate-bins`,
  deactivate: (id) => `${BARCODE_API}/${encodeURIComponent(id)}/deactivate`,
});

