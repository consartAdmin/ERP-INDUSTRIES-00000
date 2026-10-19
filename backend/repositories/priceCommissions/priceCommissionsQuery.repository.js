// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsQuery.repository.js — list / getById               ║
// ║ Tabela: public."priceCommissions" (+ prices, sellers)              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES, TB_SELLERS, TB_PC } from './priceCommissions.constants.js';
import { rowToObj } from './priceCommissions.mappers.js';

// ======================================================================
// CRUD
// ======================================================================
export async function list({
  q = '',
  price_id,
  seller_id,
  active,
  date,        // data de referência (pega regra vigente nela)
  dateFrom,
  dateTo,
  limit = 200,
  offset = 0,
} = {}) {
  const where = [];
  const args = [];
  let ai = 1;

  if (q && String(q).trim()) {
    const v = `%${String(q).toLowerCase().trim()}%`;
    where.push(`(
      LOWER(p.name) LIKE $${ai} OR
      LOWER(s.name) LIKE $${ai} OR
      CAST(pc.price_id AS TEXT) LIKE $${ai} OR
      CAST(pc.seller_id AS TEXT) LIKE $${ai} OR
      CAST(pc.commission_id AS TEXT) LIKE $${ai}
    )`);
    args.push(v);
    ai++;
  }

  if (price_id != null && String(price_id).trim() !== '') {
    where.push(`pc.price_id = $${ai}`); args.push(Number(price_id)); ai++;
  }
  if (seller_id != null && String(seller_id).trim() !== '') {
    where.push(`pc.seller_id = $${ai}`); args.push(Number(seller_id)); ai++;
  }
  if (active === 'true' || active === 'false') {
    where.push(`pc.active = $${ai}`); args.push(active === 'true'); ai++;
  }

  // vigência
  if (date) {
    where.push(`pc.valid_from <= $${ai}`); args.push(date); ai++;
    where.push(`(pc.valid_to IS NULL OR pc.valid_to >= $${ai})`); args.push(date); ai++;
  } else {
    if (dateFrom) { where.push(`pc.valid_from >= $${ai}`); args.push(dateFrom); ai++; }
    if (dateTo)   { where.push(`pc.valid_from <= $${ai}`); args.push(dateTo); ai++; }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT
      pc.*,
      p.name AS price_name,
      s.name AS seller_name
    FROM ${TB_PC} pc
    JOIN ${TB_PRICES} p ON p.price_id = pc.price_id
    JOIN ${TB_SELLERS} s ON s.id = pc.seller_id
    ${whereSql}
    ORDER BY pc.active DESC, pc.valid_from DESC, pc.price_id ASC, pc.seller_id ASC
    LIMIT $${ai} OFFSET $${ai + 1}
  `;
  args.push(Number(limit) || 200, Number(offset) || 0);

  const sqlCount = `
    SELECT COUNT(*)::int AS total
    FROM ${TB_PC} pc
    JOIN ${TB_PRICES} p ON p.price_id = pc.price_id
    JOIN ${TB_SELLERS} s ON s.id = pc.seller_id
    ${whereSql}
  `;

  const client = await pool.connect();
  try {
    const [rowsRes, countRes] = await Promise.all([
      client.query(sql, args),
      client.query(sqlCount, args.slice(0, ai - 1)),
    ]);

    return {
      ok: true,
      rows: rowsRes.rows.map(rowToObj),
      total: Number(countRes.rows?.[0]?.total || 0),
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  } finally {
    client.release();
  }
}

export async function getById(id) {
  const pid = Number(id);
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'ID inválido' };

  const sql = `
    SELECT pc.*,
           p.name AS price_name,
           s.name AS seller_name
    FROM ${TB_PC} pc
    JOIN ${TB_PRICES} p ON p.price_id = pc.price_id
    JOIN ${TB_SELLERS} s ON s.id = pc.seller_id
    WHERE pc.commission_id = $1
    LIMIT 1
  `;
  try {
    const r = await pool.query(sql, [pid]);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToObj(r.rows[0]) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
