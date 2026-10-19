// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.render.js — List rendering (PRODNEX ERP)             ║
// ║ Path: backend/public/expenseEntries/expenseEntries.render.js         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './expenseEntries.state.js';
import {
  $,
  badge,
  canCancel,
  canDelete,
  canPost,
  escapeHtml,
  moneyBR,
  toISODate,
} from './expenseEntries.utils.js';

export function renderList(pageSizeFallback = 20) {
  const tbody = $('#tbody');
  const rows = state.rows || [];
  const total = Number(state.paging?.total || 0);
  const page = Number(state.paging?.page || state.page || 1);
  const pageSize = Number(state.paging?.pageSize || pageSizeFallback);
  const pageSum = rows.reduce(
    (sum, row) => sum + Number(row.totalExpenseValue || 0),
    0,
  );

  const kpiTotal = $('#kpiTotal');
  const kpiPageSum = $('#kpiPageSum');
  const tableInfo = $('#apTableInfo');

  if (kpiTotal) kpiTotal.textContent = String(total);
  if (kpiPageSum) kpiPageSum.textContent = moneyBR(pageSum);
  if (tableInfo) {
    tableInfo.textContent = `${total} registro${total === 1 ? '' : 's'} • : ${moneyBR(pageSum)}`;
  }
  $('#pageInfo').textContent = `Página ${page} de ${Math.max(1, Math.ceil(total / pageSize))} • ${total} registros`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="ee-muted" style="padding:16px;">
          Nenhum registro encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const id = row.expenseEntryId;
    const document = `${row.documentNumber || '-'}${row.documentSeries ? `/${row.documentSeries}` : ''}`;
    const supplier = row.supplierName || '-';
    const supplierDocument = row.supplierDocument || '-';
    const type = (row.documentType || 'NFE').toUpperCase();
    const postButton = canPost(row.status)
      ? `<button class="btn btn-new btn-sm" data-act="post" data-id="${id}" type="button">Postar</button>`
      : '';
    const editDisabled = String(row.status || '').toUpperCase() === 'POSTED' ? 'disabled' : '';
    const cancelDisabled = canCancel(row.status) ? '' : 'disabled';
    const deleteDisabled = canDelete(row.status) ? '' : 'disabled';

    return `
      <tr>
        <td>${id}</td>
        <td>${toISODate(row.issueDate)}</td>
        <td>${type}</td>
        <td>${escapeHtml(document)}</td>
        <td title="${escapeHtml(supplier)}">${escapeHtml(supplier)}</td>
        <td>${escapeHtml(supplierDocument)}</td>
        <td class="ee-right">${moneyBR(row.totalExpenseValue)}</td>
        <td>${badge(row.status)}</td>
        <td>
          <div class="ee-actions-cell">
            ${postButton}
            <button class="btn btn-new btn-sm" data-act="edit" data-id="${id}" type="button" ${editDisabled}>✏️</button>
            <button class="btn btn-new btn-sm" data-act="cancel" data-id="${id}" type="button" ${cancelDisabled}>Cancelar</button>
            <button class="btn btn-new btn-sm" data-act="delete" data-id="${id}" type="button" ${deleteDisabled}>🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
