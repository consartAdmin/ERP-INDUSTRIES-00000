// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.render.js — Renderização da tabela e rodapé         ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  getPageElements,
  STATUS_LABELS,
  TABLE_COLSPAN
} from './nfeReceiptsList.config.js';
import { state, getTotalPages } from './nfeReceiptsList.state.js';
import {
  escapeHtml,
  formatDateTime,
  formatDocument,
  formatPhone,
  hasCoordinates
} from './nfeReceiptsList.utils.js';

const STATUS_CLASSES = Object.freeze({
  PENDING: 'nrl-badge--pending',
  SIGNED: 'nrl-badge--signed',
  REFUSED: 'nrl-badge--refused',
  CANCELLED: 'nrl-badge--cancelled'
});

export function statusLabel(status) {
  const key = String(status || '').toUpperCase();
  return STATUS_LABELS[key] || key || '-';
}

function renderBadge(status) {
  const key = String(status || '').toUpperCase();
  const modifier = STATUS_CLASSES[key] || 'nrl-badge--cancelled';
  return `<span class="nrl-badge ${modifier}">${escapeHtml(statusLabel(key))}</span>`;
}

function renderActionButton({ action, id, icon, title, enabled }) {
  return `
    <button type="button" class="nrl-action-btn" data-action="${action}" data-id="${escapeHtml(id)}"
      title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${enabled ? '' : 'disabled'}>
      ${icon}
    </button>
  `;
}

function renderRow(row) {
  const id = row.receipt_id;
  const isSigned = String(row.status || '').toUpperCase() === 'SIGNED';

  return `
    <tr>
      <td>${escapeHtml(row.numero ?? '-')}</td>
      <td class="nrl-cell-text">${escapeHtml(row.customer_name || '-')}</td>
      <td class="nrl-cell-text">${escapeHtml(row.receiver_name || '-')}</td>
      <td>${escapeHtml(formatDocument(row.receiver_document))}</td>
      <td>${escapeHtml(formatPhone(row.receiver_phone))}</td>
      <td>${escapeHtml(formatDateTime(row.received_at))}</td>
      <td>${renderBadge(row.status)}</td>
      <td>${renderActionButton({ action: 'map', id, icon: '📍', title: hasCoordinates(row) ? 'Ver localização' : 'Localização não disponível', enabled: hasCoordinates(row) })}</td>
      <td>${renderActionButton({ action: 'signature', id, icon: '🖊', title: isSigned ? 'Ver assinatura' : 'Assinatura não disponível', enabled: isSigned && Boolean(row.access_key) })}</td>
      <td>${renderActionButton({ action: 'danfe', id, icon: '📄', title: row.danfe_url ? 'Abrir DANFE' : 'DANFE não disponível', enabled: Boolean(row.danfe_url) })}</td>
      <td>${renderActionButton({ action: 'xml', id, icon: '🧾', title: row.xml_url ? 'Abrir XML' : 'XML não disponível', enabled: Boolean(row.xml_url) })}</td>
    </tr>
  `;
}

export function renderMessageRow(message) {
  const els = getPageElements();
  if (!els.tableBody) return;

  els.tableBody.innerHTML = `
    <tr>
      <td colspan="${TABLE_COLSPAN}" class="nrl-empty">${escapeHtml(message)}</td>
    </tr>
  `;
}

export function renderTable() {
  const els = getPageElements();
  if (!els.tableBody) return;

  if (!state.rows.length) {
    renderMessageRow('Nenhum canhoto encontrado.');
  } else {
    els.tableBody.innerHTML = state.rows.map(renderRow).join('');
  }

  renderFooter();
}

export function renderFooter() {
  const els = getPageElements();
  const totalPages = getTotalPages();

  if (els.tableInfo) {
    els.tableInfo.textContent = `${state.total} ${state.total === 1 ? 'registro' : 'registros'}`;
  }

  if (els.pageInfo) els.pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
  if (els.btnPrevious) els.btnPrevious.disabled = state.isLoading || state.page <= 1;
  if (els.btnNext) els.btnNext.disabled = state.isLoading || state.page >= totalPages;
}

export function renderLoading(isLoading) {
  const els = getPageElements();

  [els.btnSearch, els.btnReload, els.btnExcel, els.btnPdf].forEach((btn) => {
    if (btn) btn.disabled = isLoading;
  });

  if (isLoading && !state.rows.length) renderMessageRow('Carregando canhotos...');
  renderFooter();
}

// ──────────────────────────────────────────────────────────────────────
// Relatório para impressão / PDF
// ──────────────────────────────────────────────────────────────────────

export function renderPrintDocument(rows = [], filtersText = '') {
  const body = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.numero ?? '-')}</td>
      <td>${escapeHtml(row.customer_name || '-')}</td>
      <td>${escapeHtml(row.receiver_name || '-')}</td>
      <td>${escapeHtml(formatDocument(row.receiver_document))}</td>
      <td>${escapeHtml(formatPhone(row.receiver_phone))}</td>
      <td>${escapeHtml(formatDateTime(row.received_at))}</td>
      <td>${escapeHtml(statusLabel(row.status))}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Canhotos Digitais | PRODNEX ERP</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 24px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    p { margin: 0 0 12px; color: #475569; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; }
    th { background: #f1f5f9; }
    @page { size: A4 landscape; margin: 12mm; }
  </style>
</head>
<body>
  <h1>Canhotos Digitais</h1>
  <p>${escapeHtml(filtersText)} · ${rows.length} registro(s) · Gerado em ${escapeHtml(formatDateTime(new Date()))}</p>
  <table>
    <thead>
      <tr>
        <th>NF-e</th><th>Cliente</th><th>Recebedor</th><th>Documento</th>
        <th>Telefone</th><th>Recebido em</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${body || '<tr><td colspan="7">Nenhum canhoto encontrado.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}
