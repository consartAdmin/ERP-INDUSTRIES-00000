// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.utils.js — Funções auxiliares                ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { DELIVERY_STATUS_LABELS } from './deliveryLabels.config.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function statusLabel(status) {
  return DELIVERY_STATUS_LABELS[status] || status || '-';
}

export function toPositiveInteger(value, fallback = 1) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function reportError(context, error, userMessage) {
  console.error(`[deliveryLabels] ${context}:`, error);
  window.alert(`${userMessage}: ${error?.message || 'Erro desconhecido.'}`);
}

export function getField(id) {
  return document.getElementById(id);
}

export function getDeliveryLabelsElements() {
  const ids = [
    'filtroBusca', 'filtroStatus', 'btnBuscar', 'importSource', 'inputOrderId',
    'btnBuscarPedido', 'btnImportarPedido', 'btnNovaEtiqueta',
    'btnImprimirSelecionadas', 'tableBody', 'checkTodos', 'apTableInfo',
    'apPageInfo', 'apRowsPerPage', 'btnPreviousPage', 'btnNextPage',
    'modalEtiqueta', 'modalTitulo', 'btnFecharModal', 'btnCancelar',
    'formEtiqueta'
  ];

  return Object.fromEntries(ids.map((id) => [id, getField(id)]));
}

export function assertRequiredElements(elements) {
  const missing = Object.entries(elements)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Elementos obrigatórios não encontrados: ${missing.join(', ')}`);
  }
}
