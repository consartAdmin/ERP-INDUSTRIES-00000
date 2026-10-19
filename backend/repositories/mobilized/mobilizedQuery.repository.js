// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilizedQuery.repository.js — getMobilizedById / listMobilized    ║
// ║ Tabelas: public.mobilized, public."mobilizedItems"                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_M, TB_I } from './mobilized.constants.js';
import { asInt, safeStr, parseLimit, parseOffset } from './mobilized.sanitizers.js';
import { parseOrder } from './mobilized.sql.js';
import { q } from './mobilized.utils.js';

export async function getMobilizedById(mobilized_id) {
  const id = asInt(mobilized_id);
  if (!id) throw new Error('invalid mobilized_id');

  const res = await q(`SELECT * FROM ${TB_M} WHERE mobilized_id = $1`, [id]);
  return res.rows[0] || null;
}

export async function listMobilized(filters = {}) {
  const where = [];
  const params = [];

  if (filters.status) {
    params.push(safeStr(filters.status, 20));
    where.push(`m.status = $${params.length}`);
  }
  if (filters.source_system) {
    params.push(safeStr(filters.source_system, 60));
    where.push(`m.source_system = $${params.length}`);
  }
  if (filters.external_ref) {
    params.push(safeStr(filters.external_ref, 80));
    where.push(`m.external_ref = $${params.length}`);
  }
  if (filters.q) {
    const qtxt = safeStr(filters.q, 200);
    if (qtxt) {
      params.push(`%${qtxt}%`);
      where.push(`(m.title ILIKE $${params.length} OR m.notes ILIKE $${params.length} OR m.external_ref ILIKE $${params.length})`);
    }
  }
  if (filters.from) {
    const d = new Date(filters.from);
    if (!isNaN(d)) {
      params.push(d);
      where.push(`m.acquired_at >= $${params.length}`);
    }
  }
  if (filters.to) {
    const d = new Date(filters.to);
    if (!isNaN(d)) {
      params.push(d);
      where.push(`m.acquired_at <= $${params.length}`);
    }
  }

  const limit = parseLimit(filters.limit, 50, 200);
  const offset = parseOffset(filters.offset, 0);
  const orderSql = parseOrder(filters.orderBy);

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')} ` : '';

  // ✅ items_total: soma do total_value (gerado no DB)
  const sql = `
    SELECT m.*,
      (SELECT COUNT(*) FROM ${TB_I} i WHERE i.mobilized_id = m.mobilized_id) AS items_count,
      (SELECT COALESCE(SUM(i.total_value), 0)::numeric(15,2)
         FROM ${TB_I} i
        WHERE i.mobilized_id = m.mobilized_id
      ) AS items_total
    FROM ${TB_M} m
    ${whereSql}
    ${orderSql}
    LIMIT ${limit} OFFSET ${offset};
  `;

  const countSql = `SELECT COUNT(*)::int AS total FROM ${TB_M} m ${whereSql};`;

  const [rowsRes, countRes] = await Promise.all([q(sql, params), q(countSql, params)]);
  return { rows: rowsRes.rows, total: countRes.rows[0]?.total ?? 0, limit, offset };
}
