// ╔════════════════════════════════════════════════════════════╗
// ║ units.render.js — Renderização de Unidades                    ║
// ╚════════════════════════════════════════════════════════════╝

import { state } from './units.state.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getId(row) {
  return row?.id ?? row?.unit_id ?? '';
}

function getFactor(row) {
  const value = Number(row?.fator);
  return Number.isFinite(value) ? value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }) : '1,00';
}

function renderRow(row) {
  const id = getId(row);
  const active = row?.is_active !== false;

  return `
    <tr>
      <td>${escapeHtml(id)}</td>
      <td><strong>${escapeHtml(row?.unit)}</strong></td>
      <td>${escapeHtml(row?.description || '—')}</td>
      <td>${escapeHtml(getFactor(row))}</td>
      <td>
        <span class="units-badge ${active ? 'units-badge--active' : 'units-badge--inactive'}">
          ${active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="units-action-group">
          <button
            type="button"
            class="btn btn-toolbar btn-sm units-action-button"
            data-unit-action="edit"
            data-unit-id="${escapeHtml(id)}"
            title="Editar unidade"
            aria-label="Editar unidade"
          >✎</button>

          <button
            type="button"
            class="btn btn-clean btn-sm units-action-button units-action-button--delete"
            data-unit-action="delete"
            data-unit-id="${escapeHtml(id)}"
            title="Excluir unidade"
            aria-label="Excluir unidade"
          >Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

export function renderTable() {
  const body = state.refs.tableBody;
  if (!body) return;

  const total = state.filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * state.pageSize;
  const rows = state.filteredRows.slice(start, start + state.pageSize);

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="units-table-empty">
          Nenhuma unidade encontrada.
        </td>
      </tr>
    `;
  } else {
    body.innerHTML = rows.map(renderRow).join('');
  }

  const activeCount = state.filteredRows.filter((row) => row?.is_active !== false).length;
  const inactiveCount = state.filteredRows.length - activeCount;

  if (state.refs.tableInfo) {
    state.refs.tableInfo.textContent = `${total} ${total === 1 ? 'registro' : 'registros'}`;
  }

  if (state.refs.summaryTotal) state.refs.summaryTotal.textContent = String(total);
  if (state.refs.summaryActive) state.refs.summaryActive.textContent = String(activeCount);
  if (state.refs.summaryInactive) state.refs.summaryInactive.textContent = String(inactiveCount);

  if (state.refs.pageInfo) {
    state.refs.pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
  }

  if (state.refs.previous) state.refs.previous.disabled = state.page <= 1;
  if (state.refs.next) state.refs.next.disabled = state.page >= totalPages;
}

export function renderError(message) {
  if (!state.refs.tableBody) return;

  state.refs.tableBody.innerHTML = `
    <tr>
      <td colspan="6" class="units-table-error">
        ${escapeHtml(message || 'Erro ao carregar unidades.')}
      </td>
    </tr>
  `;
}
