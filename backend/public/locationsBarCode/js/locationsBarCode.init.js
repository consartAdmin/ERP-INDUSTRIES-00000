// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.init.js                                     ║
// ║ MODULE: Locations Barcode — Initialization                         ║
// ║ DESCRIPTION: Ponto único de entrada carregado pelo HTML            ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  applyFilters, changePageSize, clearFilters, closeDetailsModal,
  deactivateCurrentBarcode, generateBarcodes, handleCheckAll,
  handleTableChange, handleTableClick, loadBarcodes, nextPage,
  openDetails, previousPage, printCurrentLabel, printSelectedLabels,
  readScannerBarcode,
} from './locationsBarCode.actions.js';
import { forceCloseModalOnLoad } from './locationsBarCode.modal.js';
import { $, debounce, focusScanner } from './locationsBarCode.utils.js';

/* =====================================================================
   EVENT BINDINGS
===================================================================== */

function bindEvents() {
  $('#btnReload')?.addEventListener('click', loadBarcodes);
  $('#btnSearch')?.addEventListener('click', applyFilters);
  $('#btnClear')?.addEventListener('click', clearFilters);
  $('#btnGenerate')?.addEventListener('click', generateBarcodes);
  $('#btnReadBarcode')?.addEventListener('click', readScannerBarcode);
  $('#btnPrintSelected')?.addEventListener('click', printSelectedLabels);
  $('#btnPrint')?.addEventListener('click', printCurrentLabel);
  $('#btnDeactivate')?.addEventListener('click', deactivateCurrentBarcode);
  $('#btnCloseModal')?.addEventListener('click', closeDetailsModal);
  $('#btnPrev')?.addEventListener('click', previousPage);
  $('#btnNext')?.addEventListener('click', nextPage);
  $('#pageSize')?.addEventListener('change', (event) =>
    changePageSize(event.target.value));
  $('#checkAll')?.addEventListener('change', handleCheckAll);
  $('#tableBody')?.addEventListener('change', handleTableChange);
  $('#tableBody')?.addEventListener('click', handleTableClick);
  $('#scannerInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      readScannerBarcode();
    }
  });
  ['#filterSearch', '#filterLocal', '#filterCorridor', '#filterShelf', '#filterBin']
    .forEach((selector) => {
      const element = $(selector);
      if (!element) return;
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyFilters();
        }
        if (event.key === 'Escape') {
          element.value = '';
          applyFilters();
        }
      });
      element.addEventListener('input', debounce(applyFilters, 250));
    });
  $('#detailsModal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeDetailsModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetailsModal();
  });
}

/* =====================================================================
   BOOTSTRAP
===================================================================== */

function init() {
  forceCloseModalOnLoad();
  bindEvents();
  focusScanner();
  loadBarcodes();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init, { once: true })
  : init();

