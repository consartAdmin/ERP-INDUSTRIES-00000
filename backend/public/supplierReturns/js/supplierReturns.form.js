// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.form.js — Formulário de importação / rascunho        ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ║ ✔ Preenche cabeçalho da NF-e importada                               ║
// ║ ✔ Sincroniza seleção, quantidade e CFOP dos itens                    ║
// ║ ✔ Monta o payload de criação da devolução                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './supplierReturns.state.js';
import { qs, qsa, money, setMessage } from './supplierReturns.utils.js';
import { renderImportedItems, updateItemsSummary } from './supplierReturns.render.js';
import { validateImportedHeader } from './supplierReturns.validation.js';

const HEADER_FIELDS = [
  '#supplierName',
  '#supplierId',
  '#supplierDocument',
  '#originalNfeKey',
  '#originalDocumentNumber',
  '#originalSeries',
];

/** Normaliza itens vindos do import do XML (todos selecionados, qtd total). */
export function mapImportedItems(items) {
  return Array.isArray(items)
    ? items.map((item) => ({
      ...item,
      selected: true,
      quantity_return: Number(item.quantity_return || item.quantity_original || 0),
      total_value_return:
        Number(item.total_value_return || 0) ||
        Number(item.quantity_return || item.quantity_original || 0) * Number(item.unit_value || 0),
    }))
    : [];
}

export function renderImportedDraft() {
  const box = qs('#draftBox');
  const hasDraft = Boolean(state.importedHeader);

  box?.classList.toggle('is-hidden', !hasDraft);

  if (!hasDraft) {
    const tbody = qs('#importedItemsBody');
    if (tbody) tbody.innerHTML = '';

    HEADER_FIELDS.forEach((sel) => {
      const el = qs(sel);
      if (el) el.value = '';
    });

    updateItemsSummary();
    return;
  }

  const h = state.importedHeader;

  qs('#supplierName').value = h.supplier_name || h.supplier?.trade_name || h.supplier?.legal_name || '';
  qs('#supplierId').value = h.supplier_id || '';
  qs('#supplierDocument').value = h.supplier_document || h.supplier?.tax_id || '';
  qs('#originalNfeKey').value = h.original_nfe_key || '';
  qs('#originalDocumentNumber').value = h.original_document_number || '';
  qs('#originalSeries').value = h.original_series || '';

  renderImportedItems();
}

export function clearImportForm() {
  state.importedHeader = null;
  state.importedItems = [];

  const fileInput = qs('#xmlFile');
  if (fileInput) fileInput.value = '';

  const reason = qs('#returnReason');
  if (reason) reason.value = '';

  setMessage('');
  renderImportedDraft();
}

export function syncItemFromRow(row) {
  const index = Number(row?.dataset?.index);
  const item = state.importedItems[index];
  if (!item) return;

  const selected = row.querySelector('.item-selected')?.checked ?? false;
  const qtyInput = row.querySelector('.item-qty');
  const cfopInput = row.querySelector('.item-cfop');

  const rawQty = Math.max(0, Number(qtyInput?.value || 0));
  const max = Number(item.quantity_original || 0);

  item.selected = selected;
  item.quantity_return = max > 0 ? Math.min(rawQty, max) : rawQty;
  item.cfop = String(cfopInput?.value || '').replace(/\D/g, '').slice(0, 4);
  item.total_value_return = Number(item.quantity_return || 0) * Number(item.unit_value || 0);

  if (qtyInput) qtyInput.value = item.quantity_return;
  if (cfopInput) cfopInput.value = item.cfop;

  const totalCell = row.querySelector('.item-total');
  if (totalCell) totalCell.textContent = money(item.total_value_return);

  updateItemsSummary();
}

export function syncAllImportedRows() {
  qsa('#importedItemsBody tr').forEach(syncItemFromRow);
}

export function buildCreatePayload() {
  const h = state.importedHeader;
  validateImportedHeader(h);

  const items = state.importedItems
    .filter((item) => item.selected !== false && Number(item.quantity_return || 0) > 0)
    .map((item) => ({
      source_import_item_id: item.import_item_id,
      xml_item_no: item.xml_item_no,
      product_id: item.product_id || 0,
      product_code: item.product_code || item.xml_product_code || '',
      description: item.description || '',
      quantity: Number(item.quantity_return || 0),
      unit: item.unit || 'UN',
      unit_value: Number(item.unit_value || 0),
      total_value: Number(item.total_value_return || 0),
      cfop: item.cfop || '',
      ncm: item.ncm || '',
      cest: item.cest || '',
      cst_icms: item.cst_icms || '',
      cst_pis: item.cst_pis || '',
      cst_cofins: item.cst_cofins || '',
    }));

  return {
    supplier_id: h.supplier_id,
    supplier_name: h.supplier_name || h.supplier?.trade_name || h.supplier?.legal_name || '',
    supplier_document: h.supplier_document || h.supplier?.tax_id || '',
    supplier_ie: h.supplier_ie || h.supplier?.ie || '',
    supplier_city: h.supplier_city || h.supplier?.city || '',
    supplier_uf: h.supplier_uf || h.supplier?.uf || '',
    original_nfe_key: h.original_nfe_key,
    original_document_number: h.original_document_number,
    original_series: h.original_series,
    original_issue_date: h.original_issue_date,
    return_reason: qs('#returnReason')?.value || '',
    status: 'DRAFT',
    items,
  };
}

export function bindImportedItemsForm() {
  const tbody = qs('#importedItemsBody');

  const onRowEdit = (ev) => {
    const row = ev.target.closest('tr');
    if (row) syncItemFromRow(row);
  };

  tbody?.addEventListener('input', onRowEdit);
  tbody?.addEventListener('change', onRowEdit);
}
