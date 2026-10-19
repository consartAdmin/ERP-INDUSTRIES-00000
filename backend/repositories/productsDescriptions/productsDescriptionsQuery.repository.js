// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsDescriptionsQuery.repository.js — list / getById           ║
// ║ Tabela: public."productsDescriptions"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsDescriptions.constants.js';

/**
 * list({ q, product_code, is_active, limit, offset })
 * - q: busca em product_code e description (ILIKE)
 * - product_code: filtro exato
 * - is_active: true/false
 * - limit/offset: paginação simples
 */
export async function list(params = {}) {
  const {
    q,
    product_code,
    is_active,
    limit = 200,
    offset = 0,
  } = params;

  const where = [];
  const values = [];
  let i = 1;

  if (q && String(q).trim()) {
    values.push(`%${String(q).trim()}%`);
    where.push(`(product_code ILIKE $${i} OR description ILIKE $${i})`);
    i++;
  }

  if (product_code && String(product_code).trim()) {
    values.push(String(product_code).trim());
    where.push(`product_code = $${i++}`);
  }

  if (is_active !== undefined && is_active !== null && is_active !== '') {
    const v = (is_active === true || is_active === 'true' || is_active === 1 || is_active === '1');
    values.push(v);
    where.push(`is_active = $${i++}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const safeOffset = Math.max(0, Number(offset) || 0);

  values.push(safeLimit);
  const limitPos = i++;

  values.push(safeOffset);
  const offsetPos = i++;

  const sql = `
    SELECT
      product_description_id,
      product_code,
      description,
      is_active,
      created_at,
      updated_at
    FROM ${TABLE}
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${limitPos} OFFSET $${offsetPos};
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

export async function getById(id) {
  const { rows } = await pool.query(
    `
    SELECT
      product_description_id,
      product_code,
      description,
      is_active,
      created_at,
      updated_at
    FROM ${TABLE}
    WHERE product_description_id = $1
    LIMIT 1;
    `,
    [id]
  );
  return rows[0] || null;
}
