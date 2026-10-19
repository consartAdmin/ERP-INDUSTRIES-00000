// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKeyQuery.repository.js — getById / list / resolve          ║
// ║ Tabela: public."productsKey"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsKey.constants.js';
import { normalizeKeyText, clampInt } from './productsKey.sanitizers.js';

export async function getById(id) {
  const keyId = Number(id);
  if (!Number.isFinite(keyId)) throw new Error('ID inválido.');

  const { rows } = await pool.query(
    `
      SELECT products_key_id, product_code, word_keys, word_keys_norm, created_at, updated_at
      FROM ${TB}
      WHERE products_key_id = $1
      LIMIT 1
    `,
    [keyId]
  );

  return rows[0] || null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* List / Search                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export async function list({
  q,
  product_code,
  limit = 50,
  offset = 0,
  orderBy = 'products_key_id',
  order = 'DESC',
} = {}) {
  const L = clampInt(limit, 50, 1, 200);
  const O = clampInt(offset, 0, 0, 1_000_000);

  const allowedOrderBy = new Set([
    'products_key_id',
    'product_code',
    'word_keys_norm',
    'created_at',
    'updated_at',
  ]);
  const ob = allowedOrderBy.has(orderBy) ? orderBy : 'products_key_id';
  const od = String(order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const where = [];
  const params = [];

  if (product_code) {
    params.push(String(product_code).trim());
    where.push(`product_code = $${params.length}`);
  }

  if (q) {
    const nq = normalizeKeyText(q);
    // busca por norm e por texto original
    params.push(`%${nq}%`);
    params.push(`%${String(q).trim()}%`);
    where.push(`(word_keys_norm ILIKE $${params.length - 1} OR word_keys ILIKE $${params.length})`);
  }

  const sql = `
    SELECT products_key_id, product_code, word_keys, word_keys_norm, created_at, updated_at
    FROM ${TB}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${ob} ${od}
    LIMIT ${L} OFFSET ${O}
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Resolve (matching)                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Resolve por texto do cliente:
 * 1) normaliza
 * 2) tenta match exato (word_keys_norm)
 * 3) fallback: contém (ILIKE) com ranking simples
 *
 * Retorna:
 * { normalized, exact: [...], candidates: [...] }
 */
export async function resolve({
  text,
  limit = 10,
  product_code, // opcional: força resolver dentro de um produto específico
} = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new Error('text é obrigatório.');

  const normalized = normalizeKeyText(raw);
  const L = clampInt(limit, 10, 1, 50);

  const paramsExact = [];
  const whereExact = [];

  paramsExact.push(normalized);
  whereExact.push(`word_keys_norm = $${paramsExact.length}`);

  if (product_code) {
    paramsExact.push(String(product_code).trim());
    whereExact.push(`product_code = $${paramsExact.length}`);
  }

  const exactSql = `
    SELECT products_key_id, product_code, word_keys, word_keys_norm
    FROM ${TB}
    WHERE ${whereExact.join(' AND ')}
    LIMIT ${L}
  `;

  const exact = (await pool.query(exactSql, paramsExact)).rows;

  // fallback candidates
  const paramsCand = [];
  const whereCand = [];

  paramsCand.push(`%${normalized}%`);
  whereCand.push(`word_keys_norm ILIKE $${paramsCand.length}`);

  if (product_code) {
    paramsCand.push(String(product_code).trim());
    whereCand.push(`product_code = $${paramsCand.length}`);
  }

  // ranking simples: mais curto e mais próximo primeiro
  const candSql = `
    SELECT
      products_key_id,
      product_code,
      word_keys,
      word_keys_norm,
      LENGTH(word_keys_norm) AS len
    FROM ${TB}
    WHERE ${whereCand.join(' AND ')}
    ORDER BY len ASC, products_key_id DESC
    LIMIT ${L}
  `;

  const candidates = (await pool.query(candSql, paramsCand)).rows;

  return { normalized, exact, candidates };
}
