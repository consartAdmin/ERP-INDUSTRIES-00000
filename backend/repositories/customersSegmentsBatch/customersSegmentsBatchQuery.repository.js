// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersSegmentsBatchQuery.repository.js — listBatch              ║
// ║ Lista clientes com/sem segmento (GET batch-list)                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CUSTOMERS, TB_SEGMENTS } from './customersSegmentsBatch.constants.js';

/* ============================================================================
   LIST BATCH
   - Lista clientes com/sem segmento
============================================================================ */

export async function listBatch({
  q = '',
  hasSegment,
  limit = 20,
  offset = 0,
} = {}) {

  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const p = `$${params.length}`;
    where.push(`(
      LOWER(COALESCE(c.trade_name,'')) LIKE ${p}
      OR LOWER(COALESCE(c.legal_name,'')) LIKE ${p}
      OR LOWER(COALESCE(c.tax_id,'')) LIKE ${p}
      OR LOWER(COALESCE(c.email,'')) LIKE ${p}
      OR LOWER(COALESCE(c.phone_number,'')) LIKE ${p}
      OR LOWER(COALESCE(c.mobile_number,'')) LIKE ${p}
    )`);
  }

  if (hasSegment === true) where.push(`c.segment_id IS NOT NULL`);
  if (hasSegment === false) where.push(`c.segment_id IS NULL`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM ${TB_CUSTOMERS} c
      ${whereSql};
    `,
    params
  );

  const total = countRes.rows?.[0]?.total ?? 0;

  const { rows } = await pool.query(
    `
      SELECT
        c.customer_id,
        c.trade_name,
        c.legal_name,
        c.tax_id,
        c.email,
        c.phone_number,
        c.mobile_number,
        c.segment_id,
        (c.segment_id IS NOT NULL) AS has_segment,
        s.segment_code,
        s.segment_name
      FROM ${TB_CUSTOMERS} c
      LEFT JOIN ${TB_SEGMENTS} s
        ON s.segment_id = c.segment_id
      ${whereSql}
      ORDER BY LOWER(COALESCE(c.trade_name, c.legal_name)) ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `,
    [...params, Number(limit), Number(offset)]
  );

  return {
    rows,
    total,
    limit: Number(limit),
    offset: Number(offset)
  };
}
