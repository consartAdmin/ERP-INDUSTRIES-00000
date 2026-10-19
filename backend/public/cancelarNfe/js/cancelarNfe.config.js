// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.config.js — Configuração do módulo                     ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API_BASE =
  window.API_BASE ||
  window.apiBase ||
  '';

export const ROUTES = Object.freeze({
  invoicesIssued: `${API_BASE}/api/invoices-issued`,
  nfeStatusMap: `${API_BASE}/api/nfe-status-map`,
  nfeStatus: (id) =>
    `${API_BASE}/api/nfe/status/${encodeURIComponent(id)}`,
  requestCancellation: `${API_BASE}/api/nfe/cancelar`,
  cancellationStatus: (id) =>
    `${API_BASE}/api/nfe/cancelamento/${encodeURIComponent(id)}/status`,
});

export const CANCELLATION = Object.freeze({
  minReasonLength: 15,
  maxReasonLength: 255,

  // PlugNotas processa o cancelamento de forma assíncrona.
  pollIntervalMs: 2000,
  pollTimeoutMs: 60000,

  // Aguarda antes da primeira consulta de status para evitar consulta precoce.
  initialDelayMs: 2000,

  // HTTP 400 com mensagem de processamento pode ser transitório nesta janela.
  transient400WindowMs: 10000,
});

export const CANONICAL_STATUS = Object.freeze({
  PENDENTE: 'PENDENTE',
  PROCESSANDO: 'PROCESSANDO',
  AUTORIZADO: 'AUTORIZADO',
  REJEITADO: 'REJEITADO',
  DENEGADO: 'DENEGADO',
  CANCELADO: 'CANCELADO',
  INUTILIZADO: 'INUTILIZADO',
  ERRO: 'ERRO',
});
