// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.render.js                                                ║
// ║ Renderização da tabela de Empresas                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SELECTORS } from './enterprise.config.js';
import { $, escapeHtml, formatCnpj } from './enterprise.utils.js';

function getRowId(row) {
  return row?.id ?? row?.enterprise_id ?? '';
}

export function renderEnterpriseLoading() {
  const tbody = $(SELECTORS.tableBody);
  const info = $(SELECTORS.resultInfo);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="enterprise-loading">Carregando empresas...</td>
      </tr>
    `;
  }

  if (info) info.textContent = 'Carregando...';
}

export function renderEnterpriseError(message) {
  const tbody = $(SELECTORS.tableBody);
  const info = $(SELECTORS.resultInfo);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="enterprise-error">${escapeHtml(message)}</td>
      </tr>
    `;
  }

  if (info) info.textContent = 'Não foi possível carregar a lista.';
}

export function renderEnterpriseTable(rows = []) {
  const tbody = $(SELECTORS.tableBody);
  const info = $(SELECTORS.resultInfo);

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="enterprise-empty">Nenhuma empresa encontrada.</td>
      </tr>
    `;
    if (info) info.textContent = '0 empresas encontradas';
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const id = getRowId(row);
    const active = row.is_active !== false;

    return `
      <tr data-enterprise-id="${escapeHtml(id)}">
        <td>${escapeHtml(id)}</td>
        <td>${escapeHtml(row.corporate_name || '-')}</td>
        <td>${escapeHtml(row.trade_name || '-')}</td>
        <td>${escapeHtml(formatCnpj(row.cnpj))}</td>
        <td>${escapeHtml(row.city || '-')}</td>
        <td>${escapeHtml(row.state || '-')}</td>
        <td>
          <span class="enterprise-badge ${active ? 'on' : 'off'}">
            ${active ? 'ATIVA' : 'INATIVA'}
          </span>
        </td>
        <td>
          <div class="enterprise-actions">
            <button
              class="btn btn-toolbar btn-sm btn-edit-enterprise"
              type="button"
              data-enterprise-action="edit"
              data-enterprise-id="${escapeHtml(id)}"
              aria-label="Editar ${escapeHtml(row.trade_name || row.corporate_name || 'empresa')}"
            >Editar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (info) {
    info.textContent = `${rows.length} ${rows.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}`;
  }
}
