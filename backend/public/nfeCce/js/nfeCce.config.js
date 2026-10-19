/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.config.js                                             ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

export const API_BASE =
    window.API_BASE ||
    window.apiBase ||
    'http://localhost:3000';

export const ROUTES = Object.freeze({
    emitir: `${API_BASE}/api/nfe/cce`,
    status: (id) => `${API_BASE}/api/nfe/cce/status/${encodeURIComponent(id)}`,
    pdf: (id) => `${API_BASE}/api/nfe/cce/pdf/${encodeURIComponent(id)}`,
    xml: (id) => `${API_BASE}/api/nfe/cce/xml/${encodeURIComponent(id)}`,
    historicoPorPedido: (orderId) =>
        `${API_BASE}/api/nfe/cce/order/${encodeURIComponent(orderId)}`,
    historico: `${API_BASE}/api/nfe/cce/eventos`,
    historicoPorNfe: (id) =>
        `${API_BASE}/api/nfe/cce/${encodeURIComponent(id)}/eventos`,

    // NF-e emitidas — lookup para preencher a CC-e a partir de public.\"invoicesIssued\".
    // A API tenta aliases comuns para manter compatibilidade com o backend atual.
    invoicesIssuedCandidates: [
        `${API_BASE}/api/invoices-issued`,
        `${API_BASE}/api/invoicesIssued`,
        `${API_BASE}/api/invoices/issued`,
    ],
});
