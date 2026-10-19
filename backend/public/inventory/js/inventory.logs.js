// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.logs.js — Logs (auditoria)                                  ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { apiGet } from './inventory.api.js';
import { INVENTORY_API_BASE } from './inventory.config.js';
import { state } from './inventory.state.js';
import { fmtQty3 } from './inventory.utils.js';
import { logError } from './inventory.config.js';

export function renderLogsTable(els) {
  const tbody = els.logsTbody;
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!state.logsData || !state.logsData.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" style="text-align:center; padding:8px;">Nenhum registro encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  state.logsData.forEach((logRow) => {
    const tr = document.createElement('tr');
    const dt = logRow.created_at ? new Date(logRow.created_at) : null;
    const dtText = dt ? `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR')}` : '';

    tr.innerHTML = `
      <td>${dtText}</td>
      <td>${logRow.user_name || ''}</td>
      <td>${logRow.action || ''}</td>
      <td>${logRow.product_code || ''}</td>
      <td>${logRow.product_name || ''}</td>
      <td>${logRow.unit || ''}</td>
      <td class="col-number">${logRow.system_qty_before != null ? fmtQty3(logRow.system_qty_before) : ''}</td>
      <td class="col-number">${logRow.counted_qty != null ? fmtQty3(logRow.counted_qty) : ''}</td>
      <td class="col-number">${logRow.system_qty_after != null ? fmtQty3(logRow.system_qty_after) : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

export async function loadLogs(els) {
  try {
    if (!state.currentInventory?.inventory_id) {
      state.logsData = [];
      renderLogsTable(els);
      return;
    }

    const url = `${INVENTORY_API_BASE}/${state.currentInventory.inventory_id}/logs`;
    const data = await apiGet(url);

    state.logsData = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    renderLogsTable(els);
  } catch (err) {
    logError('Erro em loadLogs:', err);
    showCenterModal({ variant: 'error', title: 'Erro ao carregar auditoria', message: String(err.message || err) });
  }
}