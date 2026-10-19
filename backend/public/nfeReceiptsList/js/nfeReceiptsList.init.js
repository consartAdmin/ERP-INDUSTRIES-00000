// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.init.js — Entry point do módulo Canhotos Digitais   ║
// ║ PRODNEX ERP                                                         ║
// ║ HTML importa somente este arquivo do módulo.                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './nfeReceiptsList.config.js';
import { state } from './nfeReceiptsList.state.js';
import { readPageSize } from './nfeReceiptsList.form.js';
import { bindSignatureModal, ensureSignatureModal } from './nfeReceiptsList.modal.js';
import {
  applyFilters,
  changePageSize,
  exportExcel,
  exportPdf,
  handleLoadError,
  handleTableClick,
  loadReceipts,
  nextPage,
  previousPage,
  refresh
} from './nfeReceiptsList.actions.js';

function bindEnterToSearch(input) {
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
  });
}

function bindPageEvents() {
  const els = getPageElements();

  els.btnSearch?.addEventListener('click', applyFilters);
  els.btnReload?.addEventListener('click', refresh);
  els.btnExcel?.addEventListener('click', exportExcel);
  els.btnPdf?.addEventListener('click', exportPdf);
  els.statusFilter?.addEventListener('change', applyFilters);
  els.tableBody?.addEventListener('click', handleTableClick);
  els.btnPrevious?.addEventListener('click', previousPage);
  els.btnNext?.addEventListener('click', nextPage);
  els.pageSize?.addEventListener('change', changePageSize);

  bindEnterToSearch(els.searchInput);
}

async function bootstrap() {
  ensureSignatureModal();
  bindSignatureModal();
  bindPageEvents();

  state.limit = readPageSize() || state.limit;

  try {
    await loadReceipts();
  } catch (error) {
    handleLoadError(error);
  }
}

bootstrap();
