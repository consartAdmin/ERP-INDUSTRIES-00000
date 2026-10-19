// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsPositions.repository.js — CRUD de public."locationPositions"    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { buildUpdateSet } from './locations.utils.js';

/* ------------------------------------------------------------------------- */
/* 5) locationPositions — CRUD                                               */
/* ------------------------------------------------------------------------- */

export async function listPositions(pgPool, { binId = null, activeOnly = true } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (binId !== null) {
    conditions.push(`bin_id = $${idx++}`);
    params.push(binId);
  }
  if (activeOnly) {
    conditions.push(`active = TRUE`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const text = `
    SELECT id, name, description, bin_id, active, created_at, updated_at
    FROM ${TABLES.POSITIONS}
    ${where}
    ORDER BY name;
  `;
  const { rows } = await pgPool.query(text, params);
  return rows;
}

export async function createPosition(pgPool, { name, description = null, bin_id = null, active = true }) {
  const text = `
    INSERT INTO ${TABLES.POSITIONS} (name, description, bin_id, active)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, description, bin_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [name, description, bin_id, active]);
  return rows[0];
}

export async function updatePosition(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);
  if (!setClause) {
    throw new Error('[locationsApi] updatePosition: empty payload');
  }

  const text = `
    UPDATE ${TABLES.POSITIONS}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING id, name, description, bin_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [...values, id]);
  return rows[0] || null;
}

export async function deletePosition(pgPool, id) {
  const text = `DELETE FROM ${TABLES.POSITIONS} WHERE id = $1;`;
  await pgPool.query(text, [id]);
  return { success: true };
}
