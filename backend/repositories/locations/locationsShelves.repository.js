// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsShelves.repository.js — CRUD de public."locationShelves"        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { buildUpdateSet } from './locations.utils.js';

/* ------------------------------------------------------------------------- */
/* 3) locationShelves — CRUD                                                 */
/* ------------------------------------------------------------------------- */

export async function listShelves(pgPool, { corridorId = null, activeOnly = true } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (corridorId !== null) {
    conditions.push(`corridor_id = $${idx++}`);
    params.push(corridorId);
  }
  if (activeOnly) {
    conditions.push(`active = TRUE`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const text = `
    SELECT id, name, description, corridor_id, active, created_at, updated_at
    FROM ${TABLES.SHELVES}
    ${where}
    ORDER BY name;
  `;
  const { rows } = await pgPool.query(text, params);
  return rows;
}

export async function createShelf(pgPool, { name, description = null, corridor_id = null, active = true }) {
  const text = `
    INSERT INTO ${TABLES.SHELVES} (name, description, corridor_id, active)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, description, corridor_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [name, description, corridor_id, active]);
  return rows[0];
}

export async function updateShelf(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);
  if (!setClause) {
    throw new Error('[locationsApi] updateShelf: empty payload');
  }

  const text = `
    UPDATE ${TABLES.SHELVES}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING id, name, description, corridor_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [...values, id]);
  return rows[0] || null;
}

export async function deleteShelf(pgPool, id) {
  const text = `DELETE FROM ${TABLES.SHELVES} WHERE id = $1;`;
  await pgPool.query(text, [id]);
  return { success: true };
}
