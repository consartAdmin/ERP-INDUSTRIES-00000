// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.actions.js                                  ║
// ║ MODULE: Locations Barcode — Actions                                ║
// ║ DESCRIPTION: Orquestra scanner, listagem, modal e operações        ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  deactivateBarcode, generateBinBarcodes, getBarcode,
  listBarcodes, readBarcode,
} from './locationsBarCode.api.js';
import { applyFilters as filterRows, clearFilters as resetFilterValues } from './locationsBarCode.filters.js';
import {
  clearScanner, readScannerValue, renderScannerResult, selectScanner,
} from './locationsBarCode.form.js';
import {
  closeDetailsModal, openDetailsModal, showFeedback,
} from './locationsBarCode.modal.js';
import { downloadLabelPdf, printLabels } from './locationsBarCode.print.js';
import {
  findRowById, getTotalPages, highlightRow, renderTable,
  setTableError, setTableLoading,
} from './locationsBarCode.render.js';
import { state } from './locationsBarCode.state.js';
import { safeRows } from './locationsBarCode.utils.js';
import {
  validateRowsForPrint, validateScannedBarcode,
} from './locationsBarCode.validation.js';

/* =====================================================================
   LOAD
===================================================================== */

export async function loadBarcodes() {
  try {
    setTableLoading();
    state.cacheBarcodes = safeRows(await listBarcodes());
    state.filteredBarcodes = [...state.cacheBarcodes];
    state.selectedIds.clear();
    state.currentPage = 1;
    renderTable();
  } catch (error) {
    console.error('[locationsBarCode.load]', error);
    setTableError(error.message);
    showFeedback('error', 'Erro ao carregar', error.message);
  }
}

/* =====================================================================
   FILTERS
===================================================================== */

export function applyFilters() {
  filterRows();
  renderTable();
}

export function clearFilters() {
  resetFilterValues();
  renderTable();
}

/* =====================================================================
   SCANNER
===================================================================== */

export async function readScannerBarcode() {
  const validation = validateScannedBarcode(readScannerValue());
  if (!validation.valid) {
    showFeedback('warning', 'Código obrigatório', validation.message);
    selectScanner();
    return;
  }
  try {
    const response = await readBarcode(validation.barcode);
    const row = response?.data || response;
    if (!row) {
      showFeedback('warning', 'Não encontrado', 'Localização não encontrada.');
      return;
    }
    renderScannerResult(row);
    highlightRow(row.id);
    clearScanner();
  } catch (error) {
    console.error('[locationsBarCode.scanner]', error);
    showFeedback('error', 'Erro ao ler barcode', error.message);
    selectScanner();
  }
}

/* =====================================================================
   GENERATE
===================================================================== */

export async function generateBarcodes() {
  if (!window.confirm('Gerar barcodes para todas as bandejas que ainda não possuem código?')) return;
  try {
    const response = await generateBinBarcodes();
    const total = response.generated ?? response.data?.length ?? 0;
    showFeedback(
      total ? 'success' : 'info',
      total ? 'Barcodes gerados' : 'Nenhum barcode novo',
      total
        ? `${total} barcode(s) gerado(s) com sucesso.`
        : 'Os barcodes existentes foram preservados.',
      4200,
    );
    await loadBarcodes();
  } catch (error) {
    showFeedback('error', 'Erro ao gerar', error.message);
  }
}

/* =====================================================================
   DETAILS MODAL
===================================================================== */

export async function openDetails(id) {
  try {
    const response = await getBarcode(id);
    const row = response?.data || response;
    if (!row) throw new Error('Barcode não encontrado.');
    openDetailsModal(row);
  } catch (error) {
    showFeedback('error', 'Erro ao abrir detalhes', error.message);
  }
}

export { closeDetailsModal };

/* =====================================================================
   DEACTIVATE
===================================================================== */

export async function deactivateCurrentBarcode() {
  const record = state.currentRecord;
  if (!record?.id) {
    showFeedback('warning', 'Nenhum barcode', 'Nenhum barcode selecionado.');
    return;
  }
  if (!window.confirm(`Desativar o barcode ${record.barcode}?`)) return;
  try {
    await deactivateBarcode(record.id);
    showFeedback('success', 'Barcode desativado', 'Barcode desativado com sucesso.', 4200);
    closeDetailsModal();
    await loadBarcodes();
  } catch (error) {
    showFeedback('error', 'Erro ao desativar', error.message);
  }
}

/* =====================================================================
   PRINT
===================================================================== */

export function printSelectedLabels() {
  const rows = state.cacheBarcodes.filter((row) =>
    state.selectedIds.has(Number(row.id)));
  if (!validateRowsForPrint(rows)) {
    showFeedback('warning', 'Impressão', 'Selecione pelo menos um barcode para imprimir.');
    return;
  }
  printLabels(rows);
}

export function printCurrentLabel() {
  downloadLabelPdf(state.currentRecord);
}

/* =====================================================================
   PAGINATION
===================================================================== */

export function previousPage() {
  if (state.currentPage <= 1) return;
  state.currentPage -= 1;
  renderTable();
}

export function nextPage() {
  if (state.currentPage >= getTotalPages()) return;
  state.currentPage += 1;
  renderTable();
}

export function changePageSize(value) {
  state.pageSize = Math.max(1, Number(value) || 50);
  state.currentPage = 1;
  renderTable();
}

/* =====================================================================
   TABLE EVENTS
===================================================================== */

export function handleTableChange(event) {
  const checkbox = event.target.closest('.row-check');
  if (!checkbox) return;
  const id = Number(checkbox.dataset.id);
  if (checkbox.checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
}

export function handleCheckAll(event) {
  document.querySelectorAll('.row-check').forEach((checkbox) => {
    checkbox.checked = event.target.checked;
    const id = Number(checkbox.dataset.id);
    if (checkbox.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
  });
}

export function handleTableClick(event) {
  const button = event.target.closest('[data-action][data-id]');
  if (!button) return;
  if (button.dataset.action === 'view') openDetails(button.dataset.id);
  if (button.dataset.action === 'print') {
    downloadLabelPdf(findRowById(button.dataset.id));
  }
}

