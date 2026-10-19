// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventory.utils.js — Logs de debug e query wrapper com label       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { INVENTORY_DEBUG } from './inventory.constants.js';

export function invDebug(scope, message, data = {}) {
  if (!INVENTORY_DEBUG) return;
  console.log(`[inventoryApi][${scope}] ${message}`, data);
}

export function invWarn(scope, message, data = {}) {
  console.warn(`[inventoryApi][${scope}] ${message}`, data);
}

export function invError(scope, message, err, data = {}) {
  console.error(`[inventoryApi][${scope}] ${message}`, {
    ...data,
    error: {
      code: err?.code,
      message: err?.message,
      detail: err?.detail,
      where: err?.where,
      table: err?.table,
      column: err?.column,
      constraint: err?.constraint,
      stack: err?.stack,
    },
  });
}

export function qtyDebug(rawQty, factor) {
  const raw = Number(rawQty ?? 0);
  const f = Number(factor ?? 1);
  const safeFactor = Number.isFinite(f) && f > 0 ? f : 1;

  return {
    counted_qty_input: rawQty,
    counted_qty_raw: Number.isFinite(raw) ? raw : null,
    unit_factor: safeFactor,
    counted_qty_base: Number.isFinite(raw) ? raw * safeFactor : null,
  };
}

// ──────────────────────────────────────────────────────────────
// ✅ Query wrapper (LOGA ERRO RAIZ)
// ──────────────────────────────────────────────────────────────
export async function q(clientOrPool, label, sql, params = []) {
  try {
    return await clientOrPool.query(sql, params);
  } catch (err) {
    console.error('[inventoryApi] QUERY FAILED:', {
      label,
      code: err?.code,
      message: err?.message,
      detail: err?.detail,
      where: err?.where,
      schema: err?.schema,
      table: err?.table,
      column: err?.column,
      constraint: err?.constraint,
    });

    console.error('[inventoryApi] SQL:', sql);
    console.error('[inventoryApi] PARAMS:', params);

    throw err;
  }
}
