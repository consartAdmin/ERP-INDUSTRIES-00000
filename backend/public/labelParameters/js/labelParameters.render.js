import { fillForm } from './labelParameters.form.js';
import { state } from './labelParameters.state.js';
import { $, $$, escapeHtml, parseLayoutJson, safeNumber } from './labelParameters.utils.js';

export function renderLoading() {
  const tbody = $('#labelParametersTbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="lp-loading-row">Carregando parâmetros de etiquetas...</td></tr>';
  if ($('#labelParametersEmpty')) $('#labelParametersEmpty').style.display = 'none';
}

export function renderLoadError() {
  const tbody = $('#labelParametersTbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="lp-error-row">Erro ao carregar parâmetros. Tente novamente.</td></tr>';
}

export function renderCurrentPage() {
  const totalRecords = state.currentList.length;
  const rowsPerPage = Math.max(1, Number(state.pagination.rowsPerPage) || 50);
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  state.pagination.page = Math.min(Math.max(1, state.pagination.page), totalPages);

  const start = (state.pagination.page - 1) * rowsPerPage;
  const pageItems = state.currentList.slice(start, start + rowsPerPage);

  const tableInfo = $('#apTableInfo');
  const pageInfo = $('#apPageInfo');
  const previous = $('#btnPreviousPage');
  const next = $('#btnNextPage');
  const rowsSelect = $('#apRowsPerPage');

  if (tableInfo) tableInfo.textContent = `${totalRecords} ${totalRecords === 1 ? 'Registro' : 'Registros'}`;
  if (pageInfo) pageInfo.textContent = `Página ${state.pagination.page} de ${totalPages}`;
  if (previous) previous.disabled = state.pagination.page <= 1 || totalRecords === 0;
  if (next) next.disabled = state.pagination.page >= totalPages || totalRecords === 0;
  if (rowsSelect) rowsSelect.value = String(rowsPerPage);

  renderTable(pageItems);
}

export function renderTable(list) {
  const tbody = $('#labelParametersTbody');
  const empty = $('#labelParametersEmpty');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = list.map((item) => {
    const elements = parseLayoutJson(item.layout_json)?.elements?.length || 0;
    return `<tr data-id="${escapeHtml(item.id)}">
      <td>${escapeHtml(item.name)}</td>
      <td>${safeNumber(item.page_width_mm)} × ${safeNumber(item.page_height_mm)}</td>
      <td>${safeNumber(item.label_width_mm)} × ${safeNumber(item.label_height_mm)}</td>
      <td>${elements}</td><td>${item.active ? 'Sim' : 'Não'}</td>
      <td class="lp-col-actions">
        <button type="button" class="btn btn-sm btn-secondary lp-btn-edit"
          data-id="${escapeHtml(item.id)}" title="Editar" aria-label="Editar ${escapeHtml(item.name)}">✏️</button>
        <button type="button" class="btn btn-sm btn-danger lp-btn-delete"
          data-id="${escapeHtml(item.id)}" title="Excluir" aria-label="Excluir ${escapeHtml(item.name)}">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  const open = (id) => {
    const found = state.currentList.find((item) => String(item.id) === String(id));
    if (found) fillForm(found);
  };
  $$('.lp-btn-edit', tbody).forEach((button) =>
    button.addEventListener('click', () => open(button.dataset.id)));
  $$('.lp-btn-delete', tbody).forEach((button) =>
    button.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('label-parameter-delete', {
        detail: { id: button.dataset.id },
      }));
    }));
}
