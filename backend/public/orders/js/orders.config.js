// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.config.js                                               ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Configuration and API routes                                         ║
// ║                                                                      ║
// ║ ✔ Centraliza todas as rotas usadas pelo módulo                       ║
// ║ ✔ Compatível com API_BASE dinâmica                                   ║
// ║ ✔ Inclui preview PDF antes da emissão da NF-e                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE =
  (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

export const ROUTES = Object.freeze({

  // =========================================================================
  // PEDIDOS
  // =========================================================================

  orders: `${API_BASE}/api/orders`,

  orderById: (id) =>
    `${API_BASE}/api/orders/${encodeURIComponent(id)}`,

  ordersSearch: (q, limit, offset, dateFrom, dateTo, status) => {

    const params = new URLSearchParams();

    params.set('q', q || '');
    params.set('limit', limit || 50);
    params.set('offset', offset || 0);

    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    if (status && status !== 'TODOS') {
      params.set('status', status);
    }

    return `${API_BASE}/api/orders/search?${params.toString()}`;
  },

  // =========================================================================
  // NF-e
  // =========================================================================

  nfeIssue: (id) =>
    `${API_BASE}/api/orders-nfe-attempts/orders/${encodeURIComponent(id)}/issue`,

  nfeStatus: (id) =>
    `${API_BASE}/api/orders-nfe-attempts/orders/${encodeURIComponent(id)}/status`,

  // 🔎 Preview do PDF antes da emissão
  orderPreviewPdf: (id) =>
    `${API_BASE}/api/orders/${encodeURIComponent(id)}/preview-pdf`,

  // =========================================================================
  // OUTRAS AÇÕES DO PEDIDO
  // =========================================================================

  returnOrder: (id) =>
    `${API_BASE}/api/orders/${encodeURIComponent(id)}/return-to-budget`,

  // =========================================================================
  // PAGAMENTOS
  // =========================================================================

  paymentMethods:
    `${API_BASE}/api/paymentMethods`,

  // =========================================================================
  // RELATÓRIOS
  // =========================================================================

  ordersReportPdf: (q, dateFrom, dateTo, status) => {

    const params = new URLSearchParams();

    if (q) params.set('q', q);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status && status !== 'TODOS') params.set('status', status);

    return `${API_BASE}/api/orders/report/pdf?${params.toString()}`;
  },

});
