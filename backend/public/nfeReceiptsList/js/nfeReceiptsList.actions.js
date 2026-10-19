// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.actions.js — Ações do módulo Canhotos Digitais      ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_SIGNATURE_PNG, MAX_API_PAGE_SIZE, STATUS_LABELS } from './nfeReceiptsList.config.js';
import { listReceipts } from './nfeReceiptsList.api.js';
import { state, getTotalPages, findRowById } from './nfeReceiptsList.state.js';
import { readFilters, readPageSize } from './nfeReceiptsList.form.js';
import { validateFilters } from './nfeReceiptsList.validation.js';
import {
  renderTable,
  renderLoading,
  renderMessageRow,
  renderPrintDocument,
  statusLabel
} from './nfeReceiptsList.render.js';
import { openSignatureModal } from './nfeReceiptsList.modal.js';
import {
  buildMapsUrl,
  formatDateTime,
  formatDocument,
  formatPhone,
  hasCoordinates,
  todayStamp
} from './nfeReceiptsList.utils.js';

function notify(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  alert(message);
}

// ──────────────────────────────────────────────────────────────────────
// Carregamento
// ──────────────────────────────────────────────────────────────────────

export async function loadReceipts() {
  state.isLoading = true;
  renderLoading(true);

  try {
    const data = await listReceipts({
      page: state.page,
      limit: state.limit,
      ...state.filters
    });

    state.rows = Array.isArray(data?.rows) ? data.rows : [];
    state.total = Number(data?.total) || 0;
  } finally {
    state.isLoading = false;
    renderLoading(false);
  }

  // Se a página atual ficou vazia (ex.: registros removidos), volta para a última válida.
  if (!state.rows.length && state.total && state.page > getTotalPages()) {
    state.page = getTotalPages();
    return loadReceipts();
  }

  renderTable();
}

export function handleLoadError(error) {
  console.error('[nfeReceiptsList] load error:', error);
  state.rows = [];
  state.total = 0;
  renderTable();
  renderMessageRow(`Erro ao carregar canhotos: ${error?.message || 'erro desconhecido'}`);
}

function reload() {
  return loadReceipts().catch(handleLoadError);
}

// ──────────────────────────────────────────────────────────────────────
// Filtros e paginação
// ──────────────────────────────────────────────────────────────────────

export function applyFilters() {
  const filters = readFilters();
  const error = validateFilters(filters);

  if (error) {
    notify(error, 'warning');
    return;
  }

  state.filters = filters;
  state.page = 1;
  reload();
}

export function refresh() {
  reload();
}

export function nextPage() {
  if (state.isLoading || state.page >= getTotalPages()) return;
  state.page += 1;
  reload();
}

export function previousPage() {
  if (state.isLoading || state.page <= 1) return;
  state.page -= 1;
  reload();
}

export function changePageSize() {
  const size = readPageSize();
  if (!size || size === state.limit) return;

  state.limit = size;
  state.page = 1;
  reload();
}

// ──────────────────────────────────────────────────────────────────────
// Ações das linhas (delegação de eventos no <tbody>)
// ──────────────────────────────────────────────────────────────────────

function openExternal(url) {
  window.open(url, '_blank', 'noopener');
}

const ROW_ACTIONS = {
  map(row) {
    if (!hasCoordinates(row)) return notify('Localização não disponível.', 'warning');
    openExternal(buildMapsUrl(row.latitude, row.longitude));
  },

  signature(row) {
    if (!row.access_key) return notify('Assinatura indisponível.', 'warning');

    openSignatureModal({
      imageUrl: `${API_SIGNATURE_PNG(row.access_key)}?ts=${Date.now()}`,
      meta: [
        row.numero ? `NF-e ${row.numero}` : null,
        row.receiver_name || null,
        row.received_at ? formatDateTime(row.received_at) : null
      ].filter(Boolean).join(' · ')
    });
  },

  danfe(row) {
    if (!row.danfe_url) return notify('DANFE indisponível.', 'warning');
    openExternal(row.danfe_url);
  },

  xml(row) {
    if (!row.xml_url) return notify('XML indisponível.', 'warning');
    openExternal(row.xml_url);
  }
};

export function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;

  const row = findRowById(button.dataset.id);
  const action = ROW_ACTIONS[button.dataset.action];

  if (row && action) action(row);
}

// ──────────────────────────────────────────────────────────────────────
// Exportação (feita no navegador com os filtros aplicados)
// ──────────────────────────────────────────────────────────────────────

async function fetchAllFilteredRows() {
  const rows = [];
  let page = 1;
  let total = Infinity;

  while (rows.length < total) {
    const data = await listReceipts({ page, limit: MAX_API_PAGE_SIZE, ...state.filters });
    const pageRows = Array.isArray(data?.rows) ? data.rows : [];

    total = Number(data?.total) || 0;
    rows.push(...pageRows);

    if (!pageRows.length) break;
    page += 1;
  }

  return rows;
}

function describeFilters() {
  const { q, status, dateFrom, dateTo } = state.filters;
  const parts = [];

  if (q) parts.push(`Pesquisa: "${q}"`);
  if (status) parts.push(`Status: ${STATUS_LABELS[status] || status}`);
  if (dateFrom || dateTo) {
    const fmt = (d) => d.split('-').reverse().join('/');
    parts.push(`Período: ${dateFrom ? fmt(dateFrom) : '...'} a ${dateTo ? fmt(dateTo) : '...'}`);
  }

  return parts.length ? parts.join(' · ') : 'Sem filtros';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(rows) {
  const header = ['NF-e', 'Cliente', 'Recebedor', 'Documento', 'Telefone', 'Recebido em', 'Status', 'Latitude', 'Longitude', 'Chave de acesso'];

  const lines = rows.map((row) => [
    row.numero ?? '',
    row.customer_name || '',
    row.receiver_name || '',
    formatDocument(row.receiver_document),
    formatPhone(row.receiver_phone),
    formatDateTime(row.received_at),
    statusLabel(row.status),
    row.latitude ?? '',
    row.longitude ?? '',
    row.access_key || ''
  ].map(csvCell).join(';'));

  // BOM + ";" para o Excel pt-BR abrir com acentos e colunas corretas.
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `canhotos-digitais-${todayStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportExcel() {
  try {
    const rows = await fetchAllFilteredRows();
    if (!rows.length) return notify('Nenhum canhoto para exportar.', 'warning');
    downloadCsv(rows);
  } catch (error) {
    console.error('[nfeReceiptsList] exportExcel error:', error);
    notify(`Erro ao exportar: ${error.message}`, 'error');
  }
}

export async function exportPdf() {
  // Abre a janela antes do await para não ser bloqueada como pop-up.
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    notify('Permita pop-ups para gerar o PDF.', 'warning');
    return;
  }

  printWindow.document.write('<p style="font-family:Arial">Gerando relatório...</p>');

  try {
    const rows = await fetchAllFilteredRows();

    printWindow.document.open();
    printWindow.document.write(renderPrintDocument(rows, describeFilters()));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    printWindow.close();
    console.error('[nfeReceiptsList] exportPdf error:', error);
    notify(`Erro ao gerar PDF: ${error.message}`, 'error');
  }
}
