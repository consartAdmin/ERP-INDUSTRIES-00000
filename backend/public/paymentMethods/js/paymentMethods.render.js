// Payment Methods — table and pagination rendering

'use strict';

import { GAP_FIELDS, SELECTORS, TABLE_COLUMNS } from './paymentMethods.config.js';
import {
  getTotalPages,
  getVisibleRows,
  paymentMethodsState,
} from './paymentMethods.state.js';
import { $, escapeHtml, normalizePaymentMethod, prettyDate } from './paymentMethods.utils.js';

export function renderPaymentMethods() {
  const rows = getVisibleRows();
  const tbody = $(SELECTORS.tableBody);
  if (!tbody) return;

  if (!rows.length) {
    renderTableMessage('Nenhuma forma de pagamento cadastrada.');
    renderPagination();
    return;
  }

  tbody.innerHTML = rows.map(raw => {
    const row = normalizePaymentMethod(raw);
    return `
      <tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.installments)}</td>
        <td>${escapeHtml(row.nfe_tpag)}</td>
        ${GAP_FIELDS.map(field => `<td>${escapeHtml(row[field])}</td>`).join('')}
        <td>${row.active
          ? '<span class="badge badge-ok">Ativo</span>'
          : '<span class="badge badge-no">Inativo</span>'}</td>
        <td>${row.updated_at ? escapeHtml(prettyDate(row.updated_at)) : ''}</td>
        <td class="actions">
          <button class="btn btn-new btn-sm" type="button" title="Editar" data-edit="${escapeHtml(row.id)}">✏️</button>
          <button class="btn btn-new btn-sm" type="button" title="${row.active ? 'Desativar' : 'Ativar'}" data-toggle="${escapeHtml(row.id)}" data-active="${row.active}">${row.active ? '⏸️' : '▶️'}</button>
          <button class="btn btn-new btn-sm" type="button" title="Excluir" data-del="${escapeHtml(row.id)}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination();
}

export function renderTableMessage(message) {
  const tbody = $(SELECTORS.tableBody);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${TABLE_COLUMNS}" class="loading-cell">${escapeHtml(message)}</td>
    </tr>
  `;
}

export function renderPagination() {
  const total = paymentMethodsState.filteredRows.length;
  const totalPages = getTotalPages();
  const info = $(SELECTORS.tableInfo);
  const pageInfo = $(SELECTORS.pageInfo);
  const previous = $(SELECTORS.previousButton);
  const next = $(SELECTORS.nextButton);

  if (info) info.textContent = `${total} ${total === 1 ? 'Registro' : 'Registros'}`;
  if (pageInfo) pageInfo.textContent = `Página ${paymentMethodsState.page} de ${totalPages}`;
  if (previous) previous.disabled = paymentMethodsState.page <= 1;
  if (next) next.disabled = paymentMethodsState.page >= totalPages;
}
