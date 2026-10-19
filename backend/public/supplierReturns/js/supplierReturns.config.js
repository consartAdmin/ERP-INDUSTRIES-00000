// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.config.js — Configurações do módulo                  ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

function getApiBase() {
  try {
    if (typeof window.getApiBase === 'function') {
      return String(window.getApiBase()).replace(/\/$/, '');
    }
    if (window.API_BASE) return String(window.API_BASE).replace(/\/$/, '');
    if (window.apiBase) return String(window.apiBase).replace(/\/$/, '');
  } catch { }
  return '';
}

export const API_BASE = getApiBase();
export const ENDPOINT = `${API_BASE}/api/supplier-returns`;

export const ICONS = Object.freeze({
  xml: '/iconsImagens/xmlDanfe.png',
  danfe: '/iconsImagens/excelIcons.png',
  sync: '🔄',
  delete: '🗑️',
});

/** Status em que a NF-e de devolução não pode mais ser emitida. */
export const NON_EMITTABLE_STATUSES = Object.freeze([
  'PROCESSING',
  'TRANSMITTED',
  'AUTHORIZED',
  'CANCELLED',
]);

export const SEARCH_DEBOUNCE_MS = 250;
