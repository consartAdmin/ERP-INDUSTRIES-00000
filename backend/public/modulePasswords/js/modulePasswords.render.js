// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.render.js                                     ║
// ║ MODULE: Senhas dos Módulos — Render                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './modulePasswords.state.js';
import { $, escapeHtml, fmtDateTime } from './modulePasswords.utils.js';

function badge(ok, okText, offText) {
  return ok
    ? `<span class="module-passwords-badge module-passwords-badge--ok">${okText}</span>`
    : `<span class="module-passwords-badge module-passwords-badge--muted">${offText}</span>`;
}

function filteredRows() {
  const term = state.search.trim().toLocaleLowerCase('pt-BR');
  if (!term) return state.rows;
  return state.rows.filter((row) =>
    [row.module_code, row.action_code, row.description]
      .some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term))
  );
}

export function renderTable() {
  const tbody = $('#tbody');
  const rows = filteredRows();

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9">Nenhuma senha cadastrada.</td></tr>';
  } else {
    tbody.innerHTML = rows.map((row) => {
      const id = escapeHtml(row.module_password_id);
      return `
        <tr>
          <td>${id}</td>
          <td>${escapeHtml(row.module_code)}</td>
          <td>${escapeHtml(row.action_code)}</td>
          <td class="col-description">${escapeHtml(row.description || '—')}</td>
          <td>${badge(row.has_password, 'Definida', 'Não definida')}</td>
          <td>${badge(row.is_active, 'Sim', 'Não')}</td>
          <td>${escapeHtml(fmtDateTime(row.updated_at))}</td>
          <td>${escapeHtml(row.updated_by ?? '—')}</td>
          <td>
            <div class="module-passwords-actions">
              <button type="button" class="btn btn-toolbar btn-sm" data-edit="${id}"
                title="Editar / alterar senha" aria-label="Editar / alterar senha">✏️</button>
              <button type="button" class="btn btn-toolbar btn-sm" data-clear="${id}"
                title="Remover senha" aria-label="Remover senha"
                ${row.has_password ? '' : 'disabled'}>🔓</button>
              <button type="button" class="btn btn-toolbar btn-sm" data-delete="${id}"
                title="Excluir registro" aria-label="Excluir registro">🗑️</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  const total = state.rows.length;
  $('#tableInfo').textContent = rows.length === total
    ? `${total} registro${total === 1 ? '' : 's'}`
    : `${rows.length} de ${total} registros`;
}
