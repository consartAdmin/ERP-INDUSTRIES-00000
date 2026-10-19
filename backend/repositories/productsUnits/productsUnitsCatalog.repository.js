// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsCatalog.repository.js — cache de schema (pg_attribute) ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/* ──────────────────────────────────────────────────────────────────────────────
   Cache de schema (evita bater no catálogo toda hora)
───────────────────────────────────────────────────────────────────────────── */
let HAS_BARCODE_COLUMN = null;

let HAS_PBC_PRODUCT_CODE = null;
let HAS_PBC_BARCODE_ID = null;

let HAS_PRODUCTS_ID_COL = null;
let HAS_PRODUCTS_PRODUCT_ID_COL = null;

let PU_HAS_PRODUCT_ID = null;
let PU_HAS_PRODUCT_CODE = null;
let PU_PRODUCT_COL = null; // 'product_id' ou 'product_code'

/* ──────────────────────────────────────────────────────────────────────────────
   Catálogo: products(id/product_id) (pra resolver numérico → product_code)
───────────────────────────────────────────────────────────────────────────── */
export async function checkProductsIdColumns() {
  if (HAS_PRODUCTS_ID_COL !== null && HAS_PRODUCTS_PRODUCT_ID_COL !== null) {
    return { hasId: HAS_PRODUCTS_ID_COL, hasProductId: HAS_PRODUCTS_PRODUCT_ID_COL };
  }

  const { rows } = await pool.query(`
    SELECT a.attname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'products'
       AND a.attnum > 0
       AND NOT a.attisdropped;
  `);

  const cols = new Set(rows.map(r => String(r.attname)));
  HAS_PRODUCTS_ID_COL = cols.has('id');
  HAS_PRODUCTS_PRODUCT_ID_COL = cols.has('product_id');

  return { hasId: HAS_PRODUCTS_ID_COL, hasProductId: HAS_PRODUCTS_PRODUCT_ID_COL };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Catálogo: productsUnits(product_id vs product_code)
───────────────────────────────────────────────────────────────────────────── */
export async function checkProductsUnitsProductColumn() {
  if (PU_PRODUCT_COL) return PU_PRODUCT_COL;

  const { rows } = await pool.query(`
    SELECT a.attname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'productsUnits'
       AND a.attnum > 0
       AND NOT a.attisdropped;
  `);

  const cols = new Set(rows.map(r => String(r.attname)));

  PU_HAS_PRODUCT_ID = cols.has('product_id');
  PU_HAS_PRODUCT_CODE = cols.has('product_code');

  if (!PU_HAS_PRODUCT_CODE && !PU_HAS_PRODUCT_ID) {
    const e = new Error('Schema inválido: public."productsUnits" não possui coluna product_code nem product_id.');
    e.status = 500;
    throw e;
  }

  // Preferência: se existe product_code, usa ela. Senão usa product_id.
  PU_PRODUCT_COL = PU_HAS_PRODUCT_CODE ? 'product_code' : 'product_id';

  return PU_PRODUCT_COL;
}

export async function getPuProductCol() {
  return await checkProductsUnitsProductColumn();
}

export async function checkBarcodeColumn() {
  if (HAS_BARCODE_COLUMN !== null) return HAS_BARCODE_COLUMN;

  const { rows } = await pool.query(`
    SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'productsUnits'
       AND a.attname = 'barcode'
       AND a.attnum > 0
       AND NOT a.attisdropped
     LIMIT 1;
  `);

  HAS_BARCODE_COLUMN = rows.length > 0;
  return HAS_BARCODE_COLUMN;
}

export async function checkPbcColumns() {
  if (HAS_PBC_PRODUCT_CODE !== null && HAS_PBC_BARCODE_ID !== null) {
    return { hasProductCode: HAS_PBC_PRODUCT_CODE, hasBarcodeId: HAS_PBC_BARCODE_ID };
  }

  const { rows } = await pool.query(`
    SELECT a.attname
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'productsBarCode'
       AND a.attnum > 0
       AND NOT a.attisdropped;
  `);

  const cols = new Set(rows.map(r => String(r.attname)));
  HAS_PBC_PRODUCT_CODE = cols.has('product_code');
  HAS_PBC_BARCODE_ID = cols.has('barcode_id');

  return { hasProductCode: HAS_PBC_PRODUCT_CODE, hasBarcodeId: HAS_PBC_BARCODE_ID };
}

// Zera o cache de schema (usado após ensureProductsUnitsTable).
// Fica neste arquivo porque as variáveis `let` só podem ser reatribuídas aqui.
export function resetSchemaCache() {
  HAS_BARCODE_COLUMN = null;
  HAS_PBC_PRODUCT_CODE = null;
  HAS_PBC_BARCODE_ID = null;
  PU_PRODUCT_COL = null;
  PU_HAS_PRODUCT_ID = null;
  PU_HAS_PRODUCT_CODE = null;
}
