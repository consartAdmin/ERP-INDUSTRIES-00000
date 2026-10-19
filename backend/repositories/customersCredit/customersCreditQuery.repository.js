// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCreditQuery.repository.js — getByCustomerId / list        ║
// ║ View: public."customersCreditPosition"                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { VW_POSITION } from './customersCredit.constants.js';
import { toCustomerId } from './customersCredit.sanitizers.js';
import { mapPosition } from './customersCredit.mappers.js';

export async function getByCustomerId(customerId) {
  const id = toCustomerId(customerId);
  const { rows } = await pool.query(
    `SELECT * FROM ${VW_POSITION} WHERE customer_id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapPosition(rows[0]) : null;
}

export async function list({ limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM ${VW_POSITION}
       ORDER BY trade_name NULLS LAST, customer_id
       LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset]
    ),
    pool.query(`SELECT COUNT(*)::INTEGER AS total FROM ${VW_POSITION}`),
  ]);
  return {
    rows: rows.map(mapPosition),
    total: countResult.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}
