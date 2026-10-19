// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: locationsBarCode.render.js                                   ║
// ║ MODULE: Locations Barcode — Render                                 ║
// ║ PRODNEX ERP · Frontend · ESM                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './locationsBarCode.state.js';
import { $, escapeHtml } from './locationsBarCode.utils.js';

export function findRowById(id) {
  return state.cacheBarcodes.find((row) => String(row.id) === String(id)) || null;
}

export function getTotalPages() {
  return Math.max(1, Math.ceil(state.filteredBarcodes.length / state.pageSize));
}

export function getPaginatedRows() {
  const start = (state.currentPage - 1) * state.pageSize;
  return state.filteredBarcodes.slice(start, start + state.pageSize);
}

export function renderRow(row) {
  const checked = state.selectedIds.has(Number(row.id)) ? 'checked' : '';
  return `<tr data-row-id="${escapeHtml(row.id)}">
    <td><input type="checkbox" class="row-check" data-id="${escapeHtml(row.id)}" ${checked}></td>
    <td>${escapeHtml(row.id)}</td>
    <td><strong>${escapeHtml(row.barcode)}</strong></td>
    <td>${escapeHtml(row.local)}</td>
    <td>${escapeHtml(row.corredor)}</td>
    <td>${escapeHtml(row.prateleira)}</td>
    <td>${escapeHtml(row.bandeja)}</td>
    <td>${escapeHtml(row.position)}</td>
    <td><span class="badge ${row.active ? 'badge-active' : 'badge-inactive'}">${row.active ? 'ATIVO' : 'INATIVO'}</span></td>
    <td><div class="actions">
      <button type="button" class="btn btn-toolbar btn-sm" data-action="view" data-id="${escapeHtml(row.id)}">👁️</button>
      <button type="button" class="btn btn-toolbar btn-sm" data-action="print" data-id="${escapeHtml(row.id)}">🖨️</button>
    </div></td>
  </tr>`;
}

export function renderTable() {
  const tbody = $('#tableBody');
  if (!tbody) return;
  const rows = getPaginatedRows();
  tbody.innerHTML = rows.length
    ? rows.map(renderRow).join('')
    : '<tr><td colspan="10" class="empty">Nenhum registro encontrado.</td></tr>';
  updatePaginationInfo();
  updateTotalInfo();
}

export function setTableLoading() {
  const tbody = $('#tableBody');
  if (tbody) tbody.innerHTML =
    '<tr><td colspan="10" class="empty">Carregando...</td></tr>';
}

export function setTableError(message) {
  const tbody = $('#tableBody');
  if (tbody) tbody.innerHTML =
    `<tr><td colspan="10" class="empty">Erro: ${escapeHtml(message)}</td></tr>`;
}

export function updatePaginationInfo() {
  const info = $('#pageInfo');
  if (info) info.textContent = `Página ${state.currentPage} de ${getTotalPages()}`;
}

export function updateTotalInfo() {
  const total = $('#totalRecords');
  if (total) total.textContent = `${state.filteredBarcodes.length} registro(s)`;
}

export function highlightRow(id) {
  const row = document.querySelector(`[data-row-id="${CSS.escape(String(id))}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.style.outline = '3px solid #2563eb';
  setTimeout(() => { row.style.outline = ''; }, 1800);
}

