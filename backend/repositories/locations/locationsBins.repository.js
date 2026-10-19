// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsBins.repository.js — CRUD de public."locationBins"              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { buildUpdateSet } from './locations.utils.js';

/* ------------------------------------------------------------------------- */
/* 4) locationBins — CRUD                                                    */
/* ------------------------------------------------------------------------- */

export async function listBins(pgPool, { shelfId = null, activeOnly = true } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (shelfId !== null) {
    conditions.push(`shelf_id = $${idx++}`);
    params.push(shelfId);
  }
  if (activeOnly) {
    conditions.push(`active = TRUE`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const text = `
    SELECT id, name, description, shelf_id, active, created_at, updated_at
    FROM ${TABLES.BINS}
    ${where}
    ORDER BY name;
  `;
  const { rows } = await pgPool.query(text, params);
  return rows;
}

export async function createBin(pgPool, { name, description = null, shelf_id = null, active = true }) {
  const text = `
    INSERT INTO ${TABLES.BINS} (name, description, shelf_id, active)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, description, shelf_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [name, description, shelf_id, active]);
  return rows[0];
}

export async function updateBin(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);
  if (!setClause) {
    throw new Error('[locationsApi] updateBin: empty payload');
  }

  const text = `
    UPDATE ${TABLES.BINS}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING id, name, description, shelf_id, active, created_at, updated_at;
  `;
  const { rows } = await pgPool.query(text, [...values, id]);
  return rows[0] || null;
}

export async function deleteBin(pgPool, id) {
  const text = `DELETE FROM ${TABLES.BINS} WHERE id = $1;`;
  await pgPool.query(text, [id]);
  return { success: true };
}
