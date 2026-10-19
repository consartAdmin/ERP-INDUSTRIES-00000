// js/debts.table.js
'use strict';

import { els } from './debts.config.js';
import { state } from './debts.state.js';
import { API_BASE, fetchJSON } from './debts.api.js';
import {
  buildQuery,
  escapeHtml,
  formatDate,
  formatMoney,
  getStatusBadge,
  toNumber,
  showToast
} from './debts.utils.js';
import { getFilters } from './debts.filters.js';
import { actionIconsHtml } from '/public/includes/js/actionIcons.js';

export function renderTable() {
  const rows = Array.isArray(state.rows) ? state.rows : [];
  const currentPage = Math.max(Number(state.page || 1), 1);
  const totalPages = Math.max(Number(state.pages || 1), 1);
  const totalRecords = Math.max(Number(state.total || 0), 0);

  if (!els.tableBody) {
    console.error('[debts.table] Elemento #tableBody não encontrado.');
    return;
  }

  if (!rows.length) {
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">
          Nenhuma dívida encontrada.
        </td>
      </tr>
    `;
  } else {
    els.tableBody.innerHTML = rows.map((row) => {
      const debtId = escapeHtml(row.id || row.debt_id || '');
      const description = escapeHtml(row.description || '');
      const paidAmount = toNumber(row.paid_amount);
      const status = String(row.status || '').toUpperCase();

      return `
        <tr data-id="${debtId}">
          <td>
            ${escapeHtml(row.code || row.id || row.debt_id || '-')}
          </td>

          <td>
            ${description || '-'}
          </td>

          <td>
            ${escapeHtml(row.creditor_name || '-')}
          </td>

          <td>
            ${escapeHtml(row.debt_type || '-')}
          </td>

          <td>
            ${escapeHtml(formatDate(row.due_date))}
          </td>

          <td>
            ${escapeHtml(formatMoney(row.original_amount))}
          </td>

          <td class="${paidAmount > 0 ? 'money-success' : ''}">
            ${escapeHtml(formatMoney(row.paid_amount))}
          </td>

          <td class="${status === 'VENCIDO' ? 'money-danger' : ''}">
            ${escapeHtml(formatMoney(row.open_amount))}
          </td>

          <td>
            ${getStatusBadge(row.status)}
          </td>

          <td class="td-actions">
            ${actionIconsHtml([
              { action: 'edit', title: 'Editar dívida', attrs: { 'data-action': 'edit', 'data-id': row.id || row.debt_id || '' } },
              { action: 'payment', title: 'Pagamentos', attrs: { 'data-action': 'payments', 'data-id': row.id || row.debt_id || '', 'data-description': row.description || '' } },
              { action: 'delete', title: 'Excluir dívida', attrs: { 'data-action': 'delete', 'data-id': row.id || row.debt_id || '' } },
            ])}
          </td>
        </tr>
      `;
    }).join('');
  }

  if (els.apTableInfo) {
    els.apTableInfo.textContent =
      `${totalRecords} ${totalRecords === 1 ? 'registro' : 'registros'}`;
  }

  if (els.pageInfo) {
    els.pageInfo.textContent =
      `Página ${currentPage} de ${totalPages}`;
  }

  if (els.pageSize && String(els.pageSize.value) !== String(state.limit)) {
    const hasOption = Array.from(els.pageSize.options)
      .some((option) => Number(option.value) === state.limit);
    if (hasOption) els.pageSize.value = String(state.limit);
  }

  if (els.btnPrevPage) {
    els.btnPrevPage.disabled =
      state.loading || currentPage <= 1;
  }

  if (els.btnNextPage) {
    els.btnNextPage.disabled =
      state.loading || currentPage >= totalPages;
  }
}

export async function loadDebts() {
  try {
    state.loading = true;

    if (els.btnPrevPage) {
      els.btnPrevPage.disabled = true;
    }

    if (els.btnNextPage) {
      els.btnNextPage.disabled = true;
    }

    els.tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">
          Carregando dívidas...
        </td>
      </tr>
    `;

    const qs = buildQuery(getFilters());
    const url = qs
      ? `${API_BASE}/debts?${qs}`
      : `${API_BASE}/debts`;

    const data = await fetchJSON(url);

    const payload = data?.data && typeof data.data === 'object' ? data.data : data;
    const pagination = payload?.pagination || payload?.meta || {};

    state.rows = Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.results)
          ? payload.results
          : [];

    state.page = Math.max(Number(payload?.page ?? pagination?.page ?? state.page), 1);
    state.limit = Math.max(Number(payload?.limit ?? payload?.pageSize ?? pagination?.limit ?? pagination?.pageSize ?? state.limit), 1);
    state.total = Math.max(Number(payload?.total ?? payload?.count ?? pagination?.total ?? state.rows.length), 0);
    state.pages = Math.max(Number(payload?.pages ?? payload?.totalPages ?? pagination?.pages ?? pagination?.totalPages ?? Math.ceil(state.total / state.limit)), 1);
  } catch (error) {
    console.error('[debts] loadDebts', error);

    state.rows = [];
    state.total = 0;
    state.pages = 1;

    els.tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">
          Erro ao carregar dívidas.
        </td>
      </tr>
    `;

    showToast(
      error?.message || 'Erro ao carregar dívidas.',
      'error'
    );
  } finally {
    state.loading = false;
    renderTable();
  }
}
