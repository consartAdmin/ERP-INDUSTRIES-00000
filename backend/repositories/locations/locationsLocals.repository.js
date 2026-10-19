// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsLocals.repository.js — CRUD de public."locationLocals"          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { buildUpdateSet } from './locations.utils.js';

/* ------------------------------------------------------------------------- */
/* 1) locationLocals — CRUD                                                  */
/* ------------------------------------------------------------------------- */

export async function listLocals(pgPool, { activeOnly = true } = {}) {
  const text = `
    SELECT
      id,
      name,
      description,
      active,
      created_at,
      updated_at
    FROM ${TABLES.LOCALS}
    ${activeOnly ? 'WHERE active = TRUE' : ''}
    ORDER BY name;
  `;
  const { rows } = await pgPool.query(text);
  return rows;
}

export async function getLocalById(pgPool, id) {
  const text = `
    SELECT
      id,
      name,
      description,
      active,
      created_at,
      updated_at
    FROM ${TABLES.LOCALS}
    WHERE id = $1;
  `;
  const { rows } = await pgPool.query(text, [id]);
  return rows[0] || null;
}

export async function createLocal(pgPool, { name, description = null, active = true }) {
  const text = `
    INSERT INTO ${TABLES.LOCALS} (name, description, active)
    VALUES ($1, $2, $3)
    RETURNING id, name, description, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [name, description, active]);
  return rows[0];
}

export async function updateLocal(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);

  if (!setClause) {
    throw new Error('[locationsApi] updateLocal: empty payload');
  }

  const text = `
    UPDATE ${TABLES.LOCALS}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING id, name, description, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [...values, id]);
  return rows[0] || null;
}

export async function deleteLocal(pgPool, id) {
  const text = `DELETE FROM ${TABLES.LOCALS} WHERE id = $1;`;
  await pgPool.query(text, [id]);
  return { success: true };
}
