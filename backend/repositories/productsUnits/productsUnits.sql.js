// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnits.sql.js — ORDER BY seguro e SELECTs de barcode/description ║
// ╚════════════════════════════════════════════════════════════════════╝

import { COLS } from './productsUnits.constants.js';
import { checkBarcodeColumn } from './productsUnitsCatalog.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   ORDER / mapRow
───────────────────────────────────────────────────────────────────────────── */
export function sanitizeOrder(orderBy, dir, puProductCol) {
  const ORDERABLE = new Set([
    COLS.id, puProductCol, COLS.unit, COLS.fator,
    COLS.standard, COLS.created_at, COLS.updated_at,
  ]);

  const safeCol = ORDERABLE.has(orderBy) ? orderBy : COLS.unit;
  const safeDir = String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return { orderBy: safeCol, dir: safeDir };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers: barcode via productsBarCode + fallback productsUnits.barcode
───────────────────────────────────────────────────────────────────────────── */
export async function buildBarcodeSelect() {
  const hasBarcode = await checkBarcodeColumn();
  return hasBarcode
    ? `COALESCE(pbc.barcode, pu.${COLS.barcode}) AS barcode`
    : `pbc.barcode AS barcode`;
}

export function buildDescriptionSelect() {
  return `COALESCE(NULLIF(u.description, ''), pu.${COLS.description}) AS description`;
}
