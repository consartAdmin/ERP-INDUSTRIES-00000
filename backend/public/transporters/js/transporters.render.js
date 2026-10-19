// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.render.js — Renderização de tabela e anexos            ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './transporters.config.js';
import { state } from './transporters.state.js';
import { getModalElements } from './transporters.modal.js';
import { escapeHtml, formatBytes, formatCnpj, formatCpf, formatDate, formatPhone } from './transporters.utils.js';

export function paginateTransporters() {
  const start = (state.page - 1) * state.pageSize;
  return state.filteredRows.slice(start, start + state.pageSize);
}

export function renderTransportersTable() {
  const els = getPageElements();
  const rows = paginateTransporters();
  const total = state.filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  if (state.page > totalPages) state.page = totalPages;

  if (!rows.length) {
    els.bodyTable.innerHTML = `
      <tr><td colspan="13" class="tp-empty-row">Nenhuma transportadora encontrada.</td></tr>
    `;
  } else {
    els.bodyTable.innerHTML = rows.map((t) => `
      <tr>
        <td>${escapeHtml(t.transporter_id)}</td>
        <td>${escapeHtml(t.legal_name || '')}</td>
        <td>${escapeHtml(t.trade_name || '')}</td>
        <td>${escapeHtml(t.tax_id ? formatCnpj(t.tax_id) : '')}</td>
        <td>${escapeHtml(t.cpf ? formatCpf(t.cpf) : '')}</td>
        <td>${escapeHtml(t.state_registration || '')}</td>
        <td>${escapeHtml(t.city || '')}</td>
        <td>${escapeHtml(t.state || '')}</td>
        <td>${escapeHtml(t.contact_name || '')}</td>
        <td>${escapeHtml(t.phone_number ? formatPhone(t.phone_number) : '')}</td>
        <td>${escapeHtml(t.mobile_number ? formatPhone(t.mobile_number) : '')}</td>
        <td>
          <span class="tp-badge ${t.is_active ? 'is-active' : 'is-inactive'}">
            ${t.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <div class="tp-row-actions">
            <button type="button" class="btn btn-toolbar btn-sm" data-action="edit" data-id="${escapeHtml(t.transporter_id)}" title="Editar">✏️</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(t.transporter_id)}" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  const start = total === 0 ? 0 : ((state.page - 1) * state.pageSize) + 1;
  const end = Math.min(state.page * state.pageSize, total);

  els.apTableInfo.textContent = `${start}-${end} de ${total} registros`;
  els.pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
  els.btnPrevious.disabled = state.page <= 1;
  els.btnNext.disabled = state.page >= totalPages;
}

export function renderAttachments(rows = []) {
  const els = getModalElements();

  if (!Array.isArray(rows) || rows.length === 0) {
    els.attachmentsTable.innerHTML = `
      <tr><td colspan="4" class="tpm-empty-row">Nenhum anexo.</td></tr>
    `;
    return;
  }

  els.attachmentsTable.innerHTML = rows.map((file) => {
    const id = file.attachment_id ?? file.id ?? '';
    const fileName = file.file_name ?? file.original_name ?? file.name ?? 'Anexo';
    const size = formatBytes(file.size_bytes ?? file.size);
    const createdAt = formatDate(file.created_at);
    const url = file.file_url ?? file.url ?? file.signed_url ?? '';

    const openButton = url
      ? `<a class="btn btn-toolbar btn-sm" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
      : '';

    return `
      <tr>
        <td>${escapeHtml(fileName)}</td>
        <td>${escapeHtml(size)}</td>
        <td>${escapeHtml(createdAt)}</td>
        <td>
          <div class="tpm-attachment-actions">
            ${openButton}
            <button type="button" class="btn btn-danger btn-sm" data-attachment-delete="${escapeHtml(id)}">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
