// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesQuery.repository.js — list / search / getById  ║
// ║ Tabela: public."signaturesDeliveries"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './signaturesDeliveries.constants.js';
import { rowToModel } from './signaturesDeliveries.mappers.js';

/* =======================================================================
 * LIST / SEARCH
 * ======================================================================= */
export async function list(params = {}) {
  const {
    q,
    order_id,
    nfe_key,
    limit  = 50,
    offset = 0,
  } = params;

  const wh = ['1=1'];
  const values = [];
  let i = 1;

  if (q) {
    wh.push(`(
      ${ALIAS}.signed_name ILIKE $${i} OR
      ${ALIAS}.nfe_key     ILIKE $${i}
    )`);
    values.push(`%${q}%`);
    i++;
  }

  if (order_id != null) {
    wh.push(`${ALIAS}.order_id = $${i}`);
    values.push(Number(order_id));
    i++;
  }

  if (nfe_key) {
    wh.push(`${ALIAS}.nfe_key = $${i}`);
    values.push(String(nfe_key));
    i++;
  }

  const sql = `
    SELECT ${ALIAS}.*
    FROM ${TB} ${ALIAS}
    WHERE ${wh.join(' AND ')}
    ORDER BY ${ALIAS}.created_at DESC, ${ALIAS}.id DESC
    LIMIT $${i} OFFSET $${i + 1};
  `;

  values.push(Number(limit), Number(offset));
  const { rows } = await pool.query(sql, values);
  return rows.map(rowToModel);
}

export async function search(q, limit = 20) {
  return list({ q, limit });
}

/* =======================================================================
 * GET BY ID
 * ======================================================================= */
export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE id = $1 LIMIT 1`,
    [Number(id)]
  );
  return rowToModel(rows[0]);
}
