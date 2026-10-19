// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.config.js — Config/Endpoints/Logs                          ║
// ║ PRODNEX ERP | Inventário (Frontend ESM)                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

/* ──────────────────────────────────────────────────────────────
   Logs
────────────────────────────────────────────────────────────── */
export const DEBUG = true;

export function log(...args) { if (DEBUG) console.log('[INVENTORY]', ...args); }
export function logError(...args) { console.error('[INVENTORY][ERROR]', ...args); }

/* ──────────────────────────────────────────────────────────────
   API base
────────────────────────────────────────────────────────────── */
export function getApiBaseSafe() {
  try { if (typeof window.getApiBase === 'function') return window.getApiBase(); } catch {}
  return window.API_BASE || window.apiBase || 'http://localhost:8080';
}

const rawBase = getApiBaseSafe();
export const API_BASE = String(rawBase || '').replace(/\/$/, '');

// Endpoints
export const INVENTORY_API_BASE = `${API_BASE}/api/inventories`;
export const PRODUCTS_UNITS_API_BASE = `${API_BASE}/api/products-units`;
export const PRODUCTS_LOCATIONS_API_BASE = `${API_BASE}/api/products-locations`;

// ✅ LOTES
export const PRODUCTS_STOCK_LOTS_API_BASE = `${API_BASE}/api/productsStockLots`;
export const PRODUCTS_STOCK_API_BASE = `${API_BASE}/api/productsStock`; // fallback p/ resolver product_stock_id por SKU

log('Init config');
log('apiBase:', rawBase);
log('INVENTORY_API_BASE:', INVENTORY_API_BASE);
log('PRODUCTS_UNITS_API_BASE:', PRODUCTS_UNITS_API_BASE);
log('PRODUCTS_LOCATIONS_API_BASE:', PRODUCTS_LOCATIONS_API_BASE);
log('PRODUCTS_STOCK_LOTS_API_BASE:', PRODUCTS_STOCK_LOTS_API_BASE);