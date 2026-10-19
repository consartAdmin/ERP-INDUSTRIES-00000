// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsCorridors.repository.js — CRUD de public."locationCorridors"    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { buildUpdateSet } from './locations.utils.js';

/* ------------------------------------------------------------------------- */
/* 2) locationCorridors — CRUD                                               */
/* ------------------------------------------------------------------------- */

export async function listCorridors(pgPool, { localId = null, activeOnly = true } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (localId !== null) {
    conditions.push(`local_id = $${idx++}`);
    params.push(localId);
  }
  if (activeOnly) {
    conditions.push(`active = TRUE`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const text = `
    SELECT id, name, description, local_id, active, created_at, updated_at
    FROM ${TABLES.CORRIDORS}
    ${where}
    ORDER BY name;
  `;
  const { rows } = await pgPool.query(text, params);
  return rows;
}

export async function createCorridor(pgPool, { name, description = null, local_id = null, active = true }) {
  const text = `
    INSERT INTO ${TABLES.CORRIDORS} (name, description, local_id, active)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, description, local_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [name, description, local_id, active]);
  return rows[0];
}

export async function updateCorridor(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);
  if (!setClause) {
    throw new Error('[locationsApi] updateCorridor: empty payload');
  }

  const text = `
    UPDATE ${TABLES.CORRIDORS}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING id, name, description, local_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [...values, id]);
  return rows[0] || null;
}

export async function deleteCorridor(pgPool, id) {
  const text = `DELETE FROM ${TABLES.CORRIDORS} WHERE id = $1;`;
  await pgPool.query(text, [id]);
  return { success: true };
}
