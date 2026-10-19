// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.render.js                                            ║
// ║ Renderização da tabela de perfis                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PERMISSION_KEYS, SELECTORS } from './accessProfiles.config.js';
import { $, escapeHtml } from './accessProfiles.utils.js';

const COLSPAN = 12;

function renderMessage(message, className) {
  const tbody = $(SELECTORS.tableBody);
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${COLSPAN}" class="${className}">${escapeHtml(message)}</td>
      </tr>
    `;
  }
}

export function renderLoading() {
  renderMessage('Carregando perfis...', 'apf-loading');
  const info = $(SELECTORS.tableInfo);
  if (info) info.textContent = 'Carregando...';
}

export function renderError(message) {
  renderMessage(message, 'apf-error');
  const info = $(SELECTORS.tableInfo);
  if (info) info.textContent = 'Erro ao carregar';
}

function flagCell(profile, key) {
  if (profile.is_custom) {
    return '<td class="apf-col-flag"><span class="apf-flag-custom">por módulo</span></td>';
  }
  return profile[key]
    ? '<td class="apf-col-flag"><span class="apf-flag-yes">✔</span></td>'
    : '<td class="apf-col-flag"><span class="apf-flag-no">—</span></td>';
}

export function renderTable(rows = []) {
  const tbody = $(SELECTORS.tableBody);
  const info = $(SELECTORS.tableInfo);
  if (!tbody) return;

  if (info) info.textContent = `${rows.length} Registros`;

  if (!rows.length) {
    renderMessage('Nenhum perfil encontrado.', 'apf-empty');
    return;
  }

  tbody.innerHTML = rows.map((p) => `
    <tr>
      <td>${escapeHtml(p.sort_order)}</td>
      <td>
        ${escapeHtml(p.name)}
        ${p.is_system ? '<span class="apf-badge system" title="Perfil do sistema">SISTEMA</span>' : ''}
      </td>
      <td>${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.description || '-')}</td>
      ${PERMISSION_KEYS.map((k) => flagCell(p, k)).join('')}
      <td>${escapeHtml(p.users_count ?? 0)}</td>
      <td><span class="apf-badge ${p.is_active ? 'on' : 'off'}">${p.is_active ? 'ATIVO' : 'INATIVO'}</span></td>
      <td>
        <div class="apf-actions">
          <button class="btn btn-toolbar btn-sm" type="button" data-apf-action="edit" data-id="${escapeHtml(p.id)}"
            title="Editar perfil">✏️</button>
          ${p.is_system ? '' : `
          <button class="btn btn-toolbar btn-sm" type="button" data-apf-action="delete" data-id="${escapeHtml(p.id)}"
            title="Excluir perfil">🗑</button>`}
        </div>
      </td>
    </tr>
  `).join('');
}
