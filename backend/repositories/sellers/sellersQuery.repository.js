// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellersQuery.repository.js — list / search / getById               ║
// ║ Tabela: public."sellers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, ALIAS } from './sellers.constants.js';
import { rowToModel } from './sellers.mappers.js';

/* =======================================================================
* LIST / SEARCH
* ======================================================================= */
export async function list(params = {}) {
  const {
    q,
    active,
    limit  = 50,
    offset = 0,
  } = params;

  const wh = ['1=1'];
  const values = [];
  let i = 1;

  if (q) {
    wh.push(`(
      ${ALIAS}.name ILIKE $${i} OR
      ${ALIAS}.nickname ILIKE $${i} OR
      ${ALIAS}.email ILIKE $${i} OR
      ${ALIAS}.phone ILIKE $${i} OR
      ${ALIAS}.mobile ILIKE $${i} OR
      ${ALIAS}.document ILIKE $${i} OR
      ${ALIAS}.observations ILIKE $${i}
    )`);
    values.push(`%${q}%`);
    i++;
  }

  if (active === true) {
    wh.push(`${ALIAS}.active = TRUE`);
  } else if (active === false) {
    wh.push(`${ALIAS}.active = FALSE`);
  }

  const sql = `
    SELECT ${ALIAS}.*
    FROM ${tbl()} ${ALIAS}
    WHERE ${wh.join(' AND ')}
    ORDER BY ${ALIAS}.name ASC, ${ALIAS}.id ASC
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
    `SELECT * FROM ${tbl()} WHERE id = $1 LIMIT 1`,
    [Number(id)]
  );
  return rowToModel(rows[0]);
}
