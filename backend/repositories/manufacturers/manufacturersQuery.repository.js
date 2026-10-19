// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturersQuery.repository.js — list / search / getById         ║
// ║ Tabela: public.manufacturers                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, PK } from './manufacturers.constants.js';
import { ok, fail } from './manufacturers.utils.js';
import { normalize } from './manufacturers.mappers.js';

// ─────────────────────────────────────────────────────────────
// LIST (com paginação + busca)
// GET /api/products-manufacturers
// ─────────────────────────────────────────────────────────────
export async function list({
  q,
  page = 1,
  limit = 50,
  sort = 'trade_name',
  dir = 'asc'
} = {}) {
  try {
    const pg = Math.max(Number(page), 1);
    const lim = Math.min(Math.max(Number(limit), 1), 500);
    const offset = (pg - 1) * lim;

    const allowedSort = new Set([
      'manufacturer_id', 'trade_name', 'corporate_name',
      'tax_id', 'city', 'state', 'created_at'
    ]);

    const orderCol = allowedSort.has(sort) ? sort : 'trade_name';
    const orderDir = dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const params = [];
    const where = [];

    if (q?.trim()) {
      params.push(`%${q.toLowerCase()}%`);
      const idx = params.length;
      where.push(`
        (
          LOWER(trade_name) LIKE $${idx} OR
          LOWER(corporate_name) LIKE $${idx} OR
          LOWER(tax_id) LIKE $${idx}
        )
      `);
    }

    params.push(lim);
    const limitIdx = params.length;

    params.push(offset);
    const offsetIdx = params.length;

    const sql = `
      SELECT *,
        COUNT(*) OVER() AS total_count
      FROM ${TABLE}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `;

    const { rows } = await pool.query(sql, params);

    return ok({
      rows: rows.map(normalize),
      total: rows.length ? Number(rows[0].total_count) : 0,
      page: pg,
      limit: lim
    });
  } catch (err) {
    console.error('[manufacturersApi:list] Erro:', err);
    return fail(err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// SEARCH — atalho
// ─────────────────────────────────────────────────────────────
export async function search(q) {
  return list({ q, limit: 50 });
}

// ─────────────────────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────────────────────
export async function getById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${PK} = $1`,
      [id]
    );

    if (!rows.length) return fail('Fabricante não encontrado', 404);
    return ok(normalize(rows[0]));
  } catch (err) {
    console.error('[manufacturersApi:getById] Erro:', err);
    return fail(err.message, 500);
  }
}
