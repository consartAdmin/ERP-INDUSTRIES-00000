import { dom, state } from './prices.state.js';
import { escapeHtml, formatDateTime } from './prices.utils.js';

export function renderTableLoading() {
  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      '<tr><td colspan="7" class="table-empty">Carregando tabelas de preço...</td></tr>';
  }
}

export function renderTableError(message) {
  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      `<tr><td colspan="7" class="table-empty">${escapeHtml(message)}</td></tr>`;
  }
}

export function updateListInfo(text) {
  if (dom.listInfo) dom.listInfo.textContent = text;
}

export function renderTable() {
  if (!dom.tableBody) return;
  if (!state.rows.length) {
    dom.tableBody.innerHTML =
      '<tr><td colspan="7" class="table-empty">Nenhuma tabela de preço encontrada.</td></tr>';
    updateListInfo('0 Registros');
    return;
  }

  dom.tableBody.innerHTML = state.rows.map((row) => {
    const active = !!row.active;
    return `<tr>
      <td>${escapeHtml(row.price_id)}</td>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td class="cell-description">${escapeHtml(row.description) || '<span class="muted">—</span>'}</td>
      <td><span class="status-chip ${active ? 'active' : 'inactive'}">${active ? 'ATIVA' : 'INATIVA'}</span></td>
      <td>${formatDateTime(row.created_at)}</td>
      <td>${formatDateTime(row.updated_at)}</td>
      <td><div class="row-actions">
        <button class="btn btn-light btn-sm" type="button" data-action="edit" data-id="${row.price_id}">✏️</button>
        ${active
          ? `<button class="btn btn-warning btn-sm" type="button" data-action="delete" data-id="${row.price_id}">Inativar</button>`
          : `<button class="btn btn-success btn-sm" type="button" data-action="restore" data-id="${row.price_id}">Restaurar</button>`}
        <button class="btn btn-danger btn-sm" type="button" data-action="remove" data-id="${row.price_id}">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');

  updateListInfo(`${state.total} ${state.total === 1 ? 'Registro' : 'Registros'}`);
}

export function renderPagination() {
  if (dom.paginationInfo) {
    dom.paginationInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
  }
  if (dom.btnFirstPage) dom.btnFirstPage.disabled = state.page <= 1 || state.loading;
  if (dom.btnPrevPage) dom.btnPrevPage.disabled = state.page <= 1 || state.loading;
  if (dom.btnNextPage) dom.btnNextPage.disabled = state.page >= state.totalPages || state.loading;
  if (dom.btnLastPage) dom.btnLastPage.disabled = state.page >= state.totalPages || state.loading;
}

export function setLoading(loading) {
  state.loading = !!loading;
  [dom.btnPesquisar, dom.btnLimpar, dom.btnNovo, dom.btnSalvar]
    .filter(Boolean)
    .forEach((button) => { button.disabled = state.loading; });
  renderPagination();
}
