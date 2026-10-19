// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.render.js — Renderização da interface        ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { escapeHtml, statusLabel } from './deliveryLabels.utils.js';

export function renderLoading(elements) {
  elements.tableBody.innerHTML = `
    <tr>
      <td colspan="10" class="dl-empty">Carregando...</td>
    </tr>
  `;
}

export function renderTable(elements, labels) {
  elements.checkTodos.checked = false;

  if (!labels.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="10" class="dl-empty">Nenhuma etiqueta encontrada.</td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = labels.map(buildTableRow).join('');
}

export function renderPagination(elements, state) {
  elements.apTableInfo.textContent = `${state.total} ${state.total === 1 ? 'Registro' : 'Registros'}`;
  elements.apPageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
  elements.apRowsPerPage.value = String(state.rowsPerPage);
  elements.btnPreviousPage.disabled = state.loading || state.page <= 1;
  elements.btnNextPage.disabled = state.loading || state.page >= state.totalPages;
}

export function getSelectedLabelIds() {
  return Array.from(document.querySelectorAll('.checkEtiqueta:checked'))
    .map((element) => Number(element.value))
    .filter(Number.isFinite);
}

export function toggleAllRows(checked) {
  document.querySelectorAll('.checkEtiqueta').forEach((element) => {
    element.checked = checked;
  });
}

function buildTableRow(item) {
  const id = Number(item.delivery_label_id);
  const cityState = [item.city, item.state].filter(Boolean).join('/');
  const safeStatus = escapeHtml(item.delivery_status || '');

  return `
    <tr>
      <td>
        <input class="checkEtiqueta" type="checkbox" value="${escapeHtml(id)}" />
      </td>
      <td>${escapeHtml(id)}</td>
      <td>
        <strong>${escapeHtml(item.customer_name || '-')}</strong><br />
        <small>${escapeHtml(item.customer_tax_id || '')}</small>
      </td>
      <td>${escapeHtml(item.order_number || item.order_id || '-')}</td>
      <td>${escapeHtml(item.nfe_number || '-')}</td>
      <td>${escapeHtml(cityState || '-')}</td>
      <td>${escapeHtml(item.volumes || 1)}</td>
      <td>
        <span class="dl-status ${safeStatus}">
          ${escapeHtml(statusLabel(item.delivery_status))}
        </span>
      </td>
      <td>${escapeHtml(item.driver_name || '-')}</td>
      <td>
        <div class="dl-actions">
          <button type="button" class="dl-action-btn" data-action="edit" data-id="${escapeHtml(id)}"
            title="Editar" aria-label="Editar etiqueta #${escapeHtml(id)}">
            ✏️
          </button>
          <button type="button" class="dl-action-btn" data-action="print" data-id="${escapeHtml(id)}"
            title="Imprimir" aria-label="Imprimir etiqueta #${escapeHtml(id)}">
            🖨️
          </button>
          <button type="button" class="dl-action-btn dl-action-btn--danger" data-action="delete" data-id="${escapeHtml(id)}"
            title="Excluir" aria-label="Excluir etiqueta #${escapeHtml(id)}">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}
