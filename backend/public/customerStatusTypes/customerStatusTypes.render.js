import { FALLBACK_TYPE_COLOR } from './customerStatusTypes.config.js';
import { elements } from './customerStatusTypes.state.js';
import {
  escapeHtml,
  safeColor
} from './customerStatusTypes.utils.js';

/* =====================================================================
   FOOTER — TOTAL DE REGISTROS
===================================================================== */

function renderTableInfo(total = 0) {
  if (!elements.apTableInfo) return;

  elements.apTableInfo.textContent =
    `${total} ${total === 1 ? 'Registro' : 'Registros'}`;
}

/* =====================================================================
   TABELA VAZIA
===================================================================== */

export function renderEmptyTypes(
  message = 'Nenhum tipo de status encontrado.'
) {
  elements.typesTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-row">
        ${escapeHtml(message)}
      </td>
    </tr>
  `;

  renderTableInfo(0);
}

/* =====================================================================
   RENDERIZAÇÃO DOS TIPOS DE STATUS
===================================================================== */

export function renderTypes(rows = []) {
  const normalizedRows = Array.isArray(rows) ? rows : [];

  elements.typesTableBody.innerHTML = '';

  renderTableInfo(normalizedRows.length);

  if (!normalizedRows.length) {
    renderEmptyTypes();
    return;
  }

  for (const type of normalizedRows) {
    const color = safeColor(
      type.color_hex,
      FALLBACK_TYPE_COLOR
    );

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>
        ${escapeHtml(type.id)}
      </td>

      <td>
        ${escapeHtml(type.name_pt)}
      </td>

      <td>
        ${escapeHtml(type.internal_code)}
      </td>

      <td>
        <span
          class="color-chip"
          style="background: ${escapeHtml(color)};"
        >
          ${escapeHtml(color)}
        </span>
      </td>

      <td class="${type.is_active ? 'status-active' : 'status-inactive'}">
        ${type.is_active ? 'Sim' : 'Não'}
      </td>

      <td>
        <div class="table-actions">

          <button
            type="button"
            class="btn-action-edit"
            data-edit-id="${escapeHtml(type.id)}"
            data-edit-name="${escapeHtml(type.name_pt)}"
            data-edit-code="${escapeHtml(type.internal_code)}"
            data-edit-color="${escapeHtml(color)}"
            data-edit-order="${escapeHtml(type.sort_order ?? 0)}"
            title="Editar"
            aria-label="Editar ${escapeHtml(type.name_pt)}"
          >
            ✏️
          </button>

          <button
            type="button"
            class="btn-action-delete"
            data-delete-id="${escapeHtml(type.id)}"
            data-delete-name="${escapeHtml(type.name_pt)}"
            title="Excluir"
            aria-label="Excluir ${escapeHtml(type.name_pt)}"
          >
            🗑️
          </button>

        </div>
      </td>
    `;

    elements.typesTableBody.appendChild(row);
  }
}

/* =====================================================================
   ERRO AO CARREGAR A TABELA
===================================================================== */

export function renderTypesError(message) {
  renderEmptyTypes(
    `Erro ao carregar tipos: ${message}`
  );
}