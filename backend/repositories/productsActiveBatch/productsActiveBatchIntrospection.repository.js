// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatchIntrospection.repository.js — information_schema (best-effort) ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './productsActiveBatch.constants.js';

export async function tableExists(tableNameQuoted) {
  const [schema, raw] = String(tableNameQuoted || '').split('.');
  const table = raw?.replace(/"/g, '');
  if (!schema || !table) return false;

  const res = await pool.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2
      LIMIT 1;
    `,
    [schema.replace(/"/g, ''), table],
  );

  return res.rowCount > 0;
}

export async function columnExists(tableNameQuoted, colName) {
  const [schema, raw] = String(tableNameQuoted || '').split('.');
  const table = raw?.replace(/"/g, '');
  if (!schema || !table || !colName) return false;

  const res = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      LIMIT 1;
    `,
    [schema.replace(/"/g, ''), table, String(colName)],
  );

  return res.rowCount > 0;
}

export async function getColumnUdtName(tableNameQuoted, colName) {
  const [schema, raw] = String(tableNameQuoted || '').split('.');
  const table = raw?.replace(/"/g, '');
  if (!schema || !table || !colName) return null;

  const res = await pool.query(
    `
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      LIMIT 1;
    `,
    [schema.replace(/"/g, ''), table, String(colName)],
  );

  return res.rows?.[0]?.udt_name || null; // int4, int8, uuid, varchar, text...
}

// ✅ detecta colunas pesquisáveis existentes na tabela products
export async function detectSearchColumns() {
  const candidates = [
    'product_code',
    'product_description',
    'sku',
    'code',
    'barcode',
    'name',
    'description',
  ];

  const ok = [];
  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await columnExists(TB_PRODUCTS, c).catch(() => false);
    if (exists) ok.push(c);
  }
  return ok;
}
