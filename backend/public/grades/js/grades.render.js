import { elements, state } from './grades.state.js';
import { escapeHtml } from './grades.utils.js';

export function showState(message, type = '') {
  elements.gradesEstado.hidden = false;
  elements.gradesEstado.className = `grades-state ${type}`;
  elements.gradesEstado.textContent = message;
}

export function renderSummary() {
  const firstItem = state.total ? state.offset + 1 : 0;
  const lastItem = Math.min(
    state.offset + state.rows.length,
    state.total,
  );
  const label = state.total === 1
    ? 'Registro'
    : 'Registros';

  elements.apTableInfo.textContent =
    `${state.total} ${label}`;
}

export function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
  const currentPage = Math.floor(state.offset / state.limit) + 1;

  elements.infoPagina.textContent = `Página ${currentPage} de ${totalPages}`;
  elements.pagAnterior.disabled = currentPage <= 1;
  elements.pagProxima.disabled = currentPage >= totalPages;
  elements.apRowsPerPage.value = String(state.limit);
}

export function renderGrades() {
  elements.listaGrades.innerHTML = '';

  if (!state.rows.length) {
    const message = state.q || state.status
      ? 'Nenhuma grade encontrada para os filtros informados.'
      : 'Nenhuma grade cadastrada. Clique em “Nova grade” para começar.';

    showState(message);
    return;
  }

  elements.gradesEstado.hidden = true;

  const fragment = document.createDocumentFragment();

  state.rows.forEach((row) => {
    const isActive = row.is_active !== false;
    const tableRow = document.createElement('tr');

    tableRow.innerHTML = `
      <td class="cell-id">${escapeHtml(row.grade_id)}</td>
      <td><strong>${escapeHtml(row.grade || '—')}</strong></td>
      <td class="cell-description">
        ${escapeHtml(row.description || 'Sem descrição')}
      </td>
      <td>
        <span class="status-badge ${isActive ? 'is-active' : 'is-inactive'}">
          ${isActive ? 'Ativa' : 'Inativa'}
        </span>
      </td>
      <td class="row-actions">
        <button
          class="icon-action"
          type="button"
          data-action="edit"
          data-id="${escapeHtml(row.grade_id)}"
          aria-label="Editar grade ${escapeHtml(row.grade || '')}"
          title="Editar"
        >✏️</button>
        <button
          class="icon-action is-danger"
          type="button"
          data-action="delete"
          data-id="${escapeHtml(row.grade_id)}"
          aria-label="Excluir grade ${escapeHtml(row.grade || '')}"
          title="Excluir"
        >🗑️</button>
      </td>
    `;

    fragment.append(tableRow);
  });

  elements.listaGrades.append(fragment);
}
