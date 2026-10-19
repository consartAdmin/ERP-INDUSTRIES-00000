// ╔════════════════════════════════════════════════════════════════════╗
// ║ pricesQuery.repository.js — listSimple / list / getById            ║
// ║ Tabela: public."prices"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES } from './prices.constants.js';
import { ensurePricesTable } from './prices.schema.js';

/** dropdown: GET /api/prices -> { ok:true, rows:[{price_id,name}] } */
export async function listSimple({ onlyActive = true } = {}) {
  await ensurePricesTable();
  const rs = await pool.query(
    `
      SELECT price_id, name
      FROM ${TB_PRICES}
      WHERE ($1::bool = false OR active = true)
      ORDER BY name ASC
    `,
    [!!onlyActive]
  );
  return rs.rows;
}

export async function list({ q = '', page = 1, limit = 50, sort = 'name', dir = 'asc', onlyActive = false } = {}) {
  await ensurePricesTable();

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const sortWhitelist = new Set(['name', 'created_at', 'updated_at', 'price_id']);
  const dirWhitelist = new Set(['asc', 'desc']);
  const safeSort = sortWhitelist.has(String(sort)) ? String(sort) : 'name';
  const safeDir = dirWhitelist.has(String(dir).toLowerCase()) ? String(dir).toLowerCase() : 'asc';

  const where = [];
  const params = [];
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    where.push(`(name ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length})`);
  }
  if (onlyActive === true) {
    params.push(true);
    where.push(`active = $${params.length}`);
  }
  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const dataSql = `
    SELECT price_id, name, description, active, created_at, updated_at
    FROM ${TB_PRICES}
    ${whereSQL}
    ORDER BY ${safeSort} ${safeDir}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM ${TB_PRICES}
    ${whereSQL}
  `;

  const [dataRs, countRs] = await Promise.all([
    pool.query(dataSql, [...params, safeLimit, offset]),
    pool.query(countSql, params),
  ]);

  return {
    rows: dataRs.rows,
    total: countRs.rows?.[0]?.total ?? 0,
    page: safePage,
    limit: safeLimit,
  };
}

export async function getById(id) {
  await ensurePricesTable();
  const rs = await pool.query(
    `SELECT price_id, name, description, active, created_at, updated_at
     FROM ${TB_PRICES}
     WHERE price_id = $1`,
    [id]
  );
  return rs.rows?.[0] || null;
}
