// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.form.js                                     ║
// ║ MODULE: Locations Barcode — Scanner Form                           ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { $, setValue } from './locationsBarCode.utils.js';

export function readScannerValue() {
  return $('#scannerInput')?.value || '';
}

export function clearScanner() {
  const input = $('#scannerInput');
  if (!input) return;
  input.value = '';
  input.focus();
}

export function selectScanner() {
  $('#scannerInput')?.select();
}

export function renderScannerResult(row) {
  $('#barcodeResult')?.classList.remove('hidden');
  setValue('#resultBarcode', row.barcode);
  setValue('#resultLocal', row.local);
  setValue('#resultCorridor', row.corredor);
  setValue('#resultShelf', row.prateleira);
  setValue('#resultBin', row.bandeja);
  setValue('#resultPosition', row.position);
}

