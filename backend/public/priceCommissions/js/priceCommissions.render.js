// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.render.js — Renderização da tabela | PRODNEX ERP   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './priceCommissions.config.js';
import { state } from './priceCommissions.state.js';
import {
  escapeHtml,
  formatCommissionType,
  formatCommissionValue,
  formatValidity
} from './priceCommissions.utils.js';

export function renderPriceCommissions() {
  if (!state.rows.length) {
    dom.tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          Nenhuma regra de comissão encontrada.
        </td>
      </tr>
    `;
    dom.lblTotal.textContent = '0';
    return;
  }

  dom.tbody.innerHTML = state.rows.map((row) => `
    <tr data-id="${escapeHtml(row.commission_id)}">
      <td>${escapeHtml(row.commission_id)}</td>
      <td>${escapeHtml(row.price_name ?? row.price_id)}</td>
      <td>${escapeHtml(row.seller_name ?? row.seller_id)}</td>
      <td>${escapeHtml(formatCommissionType(row.commission_type))}</td>
      <td>${escapeHtml(formatCommissionValue(row))}</td>
      <td>${escapeHtml(formatValidity(row))}</td>
      <td>
        <span class="pc-badge ${row.active ? 'on' : 'off'}">
          ${row.active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="pc-actions-row">
          <button
            class="pc-btnMini"
            type="button"
            data-edit="${escapeHtml(row.commission_id)}">
            Editar
          </button>

          <button
            class="pc-btnMini"
            type="button"
            data-dup="${escapeHtml(row.commission_id)}">
            Duplicar
          </button>
        </div>
      </td>
    </tr>
  `).join('');

}

