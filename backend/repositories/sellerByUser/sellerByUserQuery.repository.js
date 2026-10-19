// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserQuery.repository.js — list / getById / getByUserId     ║
// ║ Tabela: public."sellerByUser" (JOIN users + sellers)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SELECT_JOIN } from './sellerByUser.sql.js';
import { normalizeRow } from './sellerByUser.mappers.js';

export async function list({
  user_id,
  seller_id,
  active,
  include_inactive, // ✅ NOVO: se true ignora filtro de active
  limit = 200,
  offset = 0,
} = {}) {
  const where = [];
  const params = [];

  const add = (sql, val) => {
    params.push(val);
    where.push(`${sql} $${params.length}`);
  };

  if (user_id !== undefined && user_id !== null && user_id !== '') add('sbu.user_id =', Number(user_id));
  if (seller_id !== undefined && seller_id !== null && seller_id !== '') add('sbu.seller_id =', Number(seller_id));

  // compat: se include_inactive=true -> não força filtro
  const forceActiveFilter = !(include_inactive === true);

  if (forceActiveFilter) {
    if (active !== undefined && active !== null && active !== '') {
      params.push(Boolean(active));
      where.push(`sbu.active = $${params.length}`);
    } else {
      // default do seu front: quando não pediu inativos, mostra só ativos
      where.push(`sbu.active = TRUE`);
    }
  } else {
    // include_inactive=true -> não aplica filtro de active
    // (mas se você quiser honrar "active" mesmo assim, é só remover este else)
  }

  params.push(Number(limit));
  const pLimit = `$${params.length}`;
  params.push(Number(offset));
  const pOffset = `$${params.length}`;

  const sql = `
    ${SELECT_JOIN}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY sbu.is_primary DESC, sbu.user_id ASC, sbu.id ASC
    LIMIT ${pLimit} OFFSET ${pOffset}
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(normalizeRow);
}

export async function getById(id) {
  const { rows } = await pool.query(
    `
    ${SELECT_JOIN}
    WHERE sbu.id = $1
    `,
    [Number(id)]
  );
  return normalizeRow(rows[0]);
}

export async function getByUserId(userId, { include_inactive } = {}) {
  const params = [Number(userId)];
  const where = [`sbu.user_id = $1`];

  if (!(include_inactive === true)) {
    where.push(`sbu.active = TRUE`);
  }

  const sql = `
    ${SELECT_JOIN}
    WHERE ${where.join(' AND ')}
    ORDER BY sbu.is_primary DESC, sbu.id ASC
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(normalizeRow);
}
