// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventorySchemaInfo.repository.js — Schema-safe helpers            ║
// ║ tabela/coluna existe? + productsLocations + inventoryItems.lot_id  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { q } from './inventory.utils.js';

// ──────────────────────────────────────────────────────────────
// ✅ Schema-safe helpers (tabela/coluna existe?)
// ──────────────────────────────────────────────────────────────
export const __COLS_CACHE = new Map();

export async function getTableCols(schema, table, clientOrPool = pool) {
  const key = `${schema}.${table}`;
  if (__COLS_CACHE.has(key)) return __COLS_CACHE.get(key);

  const { rows } = await q(
    clientOrPool,
    `cols:${schema}.${table}`,
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name   = $2
    `,
    [schema, table],
  );

  const set = new Set(rows.map((r) => r.column_name));
  __COLS_CACHE.set(key, set);
  return set;
}

export async function hasCol(schema, table, col, clientOrPool = pool) {
  const cols = await getTableCols(schema, table, clientOrPool);
  return cols.has(col);
}

export async function hasTable(schema, table, clientOrPool = pool) {
  const { rows } = await q(
    clientOrPool,
    `hasTable:${schema}.${table}`,
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name   = $2
    LIMIT 1
    `,
    [schema, table],
  );
  return !!rows?.length;
}

// ──────────────────────────────────────────────────────────────
// ✅ productsLocations: JOIN seguro + idCol dinâmico
// ──────────────────────────────────────────────────────────────
export let __PL_COLS_CACHE = null;
export let __PL_ID_COL_CACHE = null;

export function qIdent(col) {
  return `"${String(col).replaceAll('"', '""')}"`;
}

export async function getProductsLocationsCols(clientOrPool = pool) {
  if (__PL_COLS_CACHE) return __PL_COLS_CACHE;

  const { rows } = await q(
    clientOrPool,
    'cols:productsLocations',
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'productsLocations'
    `,
    [],
  );

  __PL_COLS_CACHE = new Set(rows.map((r) => r.column_name));
  return __PL_COLS_CACHE;
}

export async function getProductsLocationsIdCol(clientOrPool = pool) {
  if (__PL_ID_COL_CACHE) return __PL_ID_COL_CACHE;

  const cols = await getProductsLocationsCols(clientOrPool);
  const candidates = ['id', 'product_location_id', 'location_id'];
  const found = candidates.find((c) => cols.has(c));

  if (!found) {
    throw new Error(
      `productsLocations: não encontrei coluna identificadora (tentado: ${candidates.join(', ')}). ` +
      `Colunas atuais: ${[...cols].join(', ')}`,
    );
  }

  __PL_ID_COL_CACHE = found;
  return found;
}

export async function getProductsLocationsDefaultCol(clientOrPool = pool) {
  const cols = await getProductsLocationsCols(clientOrPool);
  const candidates = ['is_default', 'default', 'principal', 'is_principal'];
  return candidates.find((c) => cols.has(c)) || null;
}

export async function joinProductsLocationsSql(clientOrPool = pool, itAlias = 'it') {
  const idCol = await getProductsLocationsIdCol(clientOrPool);
  return `
    LEFT JOIN public."productsLocations" pl
      ON pl.${qIdent(idCol)} = ${itAlias}.product_location_id::bigint
  `;
}

// ──────────────────────────────────────────────────────────────
// ✅ inventoryItems: detectar coluna lot_id
// ──────────────────────────────────────────────────────────────
export let __IT_COLS_CACHE = null;
export async function getInventoryItemsCols(clientOrPool = pool) {
  if (__IT_COLS_CACHE) return __IT_COLS_CACHE;

  const { rows } = await q(
    clientOrPool,
    'cols:inventoryItems',
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'inventoryItems'
    `,
    [],
  );

  __IT_COLS_CACHE = new Set(rows.map((r) => r.column_name));
  return __IT_COLS_CACHE;
}

export async function inventoryItemsHasLot(clientOrPool = pool) {
  const cols = await getInventoryItemsCols(clientOrPool);
  return cols.has('lot_id');
}
