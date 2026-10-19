// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.form.js — Form handling (PRODNEX ERP)                ║
// ║ Path: backend/public/expenseEntries/expenseEntries.form.js           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './expenseEntries.state.js';
import { $, escapeHtml, moneyBR, toISODate } from './expenseEntries.utils.js';

export function setModalTitle(title, subtitle = '') {
  $('#modalTitle').textContent = title;
  $('#modalSub').textContent = subtitle;
}

export function renderItemsPreview(items = []) {
  const section = $('#itemsSection');
  const hint = $('#itemsHint');
  const tbody = $('#itemsTbody');

  if (!items.length) {
    section.style.display = 'none';
    hint.textContent = '';
    tbody.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  hint.textContent = `${items.length} item(ns) detectado(s) no XML`;
  tbody.innerHTML = items.map((item) => {
    const sku = escapeHtml(item.sku || '-');
    const description = escapeHtml(item.description || '');
    const unit = escapeHtml(item.unit || '');
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const totalValue = Number(item.totalValue || 0);

    return `
      <tr>
        <td>${sku}</td>
        <td title="${description}">${description}</td>
        <td>${unit}</td>
        <td class="ee-right">${quantity.toLocaleString('pt-BR')}</td>
        <td class="ee-right">${moneyBR(unitPrice)}</td>
        <td class="ee-right">${moneyBR(totalValue)}</td>
      </tr>
    `;
  }).join('');
}

export function clearForm() {
  $('#expenseEntryId').value = '';
  $('#documentType').value = 'NFE';
  $('#issueDate').value = '';
  $('#entryDate').value = '';
  $('#status').value = 'OPEN';
  $('#documentNumber').value = '';
  $('#documentSeries').value = '';
  $('#documentKey').value = '';
  $('#supplierName').value = '';
  $('#supplierDocument').value = '';
  $('#totalProductsValue').value = 0;
  $('#totalDiscountValue').value = 0;
  $('#totalTaxValue').value = 0;
  $('#totalExpenseValue').value = 0;
  $('#costCenterId').value = '';
  $('#vehicleId').value = '';
  $('#notes').value = '';
  $('#xmlPath').value = '';
  $('#pdfPath').value = '';
  $('#generatesTaxCredit').checked = false;
  $('#fiscalStatus').value = 'NO_CREDIT';

  state.xmlItems = [];
  renderItemsPreview([]);
}

export function fillForm(row = {}) {
  $('#expenseEntryId').value = row.expenseEntryId ?? '';
  $('#documentType').value = (row.documentType || 'NFE').toUpperCase();
  $('#issueDate').value = toISODate(row.issueDate);
  $('#entryDate').value = toISODate(row.entryDate);
  $('#status').value = (row.status || 'OPEN').toUpperCase();
  $('#documentNumber').value = row.documentNumber ?? '';
  $('#documentSeries').value = row.documentSeries ?? '';
  $('#documentKey').value = row.documentKey ?? '';
  $('#supplierName').value = row.supplierName ?? '';
  $('#supplierDocument').value = row.supplierDocument ?? '';
  $('#totalProductsValue').value = Number(row.totalProductsValue || 0);
  $('#totalDiscountValue').value = Number(row.totalDiscountValue || 0);
  $('#totalTaxValue').value = Number(row.totalTaxValue || 0);
  $('#totalExpenseValue').value = Number(row.totalExpenseValue || 0);
  $('#costCenterId').value = row.costCenterId ?? '';
  $('#vehicleId').value = row.vehicleId ?? '';
  $('#notes').value = row.notes ?? '';
  $('#xmlPath').value = row.xmlPath ?? '';
  $('#pdfPath').value = row.pdfPath ?? '';
  $('#generatesTaxCredit').checked = Boolean(row.generatesTaxCredit);
  $('#fiscalStatus').value = row.fiscalStatus ?? 'NO_CREDIT';
}

export function readForm() {
  return {
    documentType: $('#documentType').value,
    issueDate: $('#issueDate').value,
    entryDate: $('#entryDate').value || null,
    status: $('#status').value,
    documentNumber: $('#documentNumber').value.trim() || null,
    documentSeries: $('#documentSeries').value.trim() || null,
    documentKey: $('#documentKey').value.trim() || null,
    supplierName: $('#supplierName').value.trim() || null,
    supplierDocument: $('#supplierDocument').value.trim() || null,
    totalProductsValue: Number($('#totalProductsValue').value || 0),
    totalDiscountValue: Number($('#totalDiscountValue').value || 0),
    totalTaxValue: Number($('#totalTaxValue').value || 0),
    totalExpenseValue: Number($('#totalExpenseValue').value || 0),
    costCenterId: $('#costCenterId').value ? Number($('#costCenterId').value) : null,
    vehicleId: $('#vehicleId').value ? Number($('#vehicleId').value) : null,
    notes: $('#notes').value.trim() || null,
    xmlPath: $('#xmlPath').value.trim() || null,
    pdfPath: $('#pdfPath').value.trim() || null,
    generatesTaxCredit: $('#generatesTaxCredit').checked,
    fiscalStatus: $('#fiscalStatus').value.trim() || 'NO_CREDIT',
  };
}

