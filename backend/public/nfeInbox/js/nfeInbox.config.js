/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.config.js — Configurações | PRODNEX ERP (ESM)          ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

export const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export const INBOUND_ENTRY_PAGE = '/public/inbound/inbound.html';
export const DEFAULT_PAGE_SIZE = 50;
export const IMPORT_BATCH_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 350;
export const SYNC_STATUS_POLL_MS = 60000;

export const ROUTES = Object.freeze({
  inboxList: () => `${API_BASE}/api/nfe-inbox`,
  inboxById: (id) => `${API_BASE}/api/nfe-inbox/${encodeURIComponent(id)}`,
  inboxXmlById: (id) => `${API_BASE}/api/nfe-inbox/${encodeURIComponent(id)}/xml`,
  inboxPdfById: (id) => `${API_BASE}/api/nfe-inbox/${encodeURIComponent(id)}/pdf`,
  manifestById: (id) => `${API_BASE}/api/nfe-inbox/${encodeURIComponent(id)}/manifest`,
  importXml: () => `${API_BASE}/api/nfe-inbox/import-xml`,
  syncDfe: () => `${API_BASE}/api/nfe-inbox/sync-dfe`,
  syncStatus: () => `${API_BASE}/api/nfe-inbox/sync-status`,
  inboxXmlLote: () => `${API_BASE}/api/nfe-inbox/xml-lote`,
  inboundAutoFromDfe: (accessKey) =>
    `${API_BASE}/api/inbound/auto-from-dfe?accessKey=${encodeURIComponent(accessKey)}`,
});
