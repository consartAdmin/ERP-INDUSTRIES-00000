// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.api.js                                      ║
// ║ MODULE: Locations Barcode — API                                    ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './locationsBarCode.config.js';

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `${options.method || 'GET'} ${url} → ${response.status}`);
  }
  return data;
}

export const listBarcodes = () => request(ROUTES.list);
export const getBarcode = (id) => request(ROUTES.byId(id));
export const readBarcode = (barcode) => request(ROUTES.read(barcode));
export const generateBinBarcodes = () =>
  request(ROUTES.generateBins, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
export const deactivateBarcode = (id) =>
  request(ROUTES.deactivate(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

