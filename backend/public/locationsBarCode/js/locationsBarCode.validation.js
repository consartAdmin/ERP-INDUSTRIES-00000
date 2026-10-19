// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.validation.js                               ║
// ║ MODULE: Locations Barcode — Validation                             ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateScannedBarcode(value) {
  const barcode = String(value || '').trim().toUpperCase();
  return barcode
    ? { valid: true, barcode }
    : { valid: false, barcode: '', message: 'Informe ou escaneie um código de barras.' };
}

export function validateRowsForPrint(rows) {
  return Array.isArray(rows) && rows.length > 0;
}

