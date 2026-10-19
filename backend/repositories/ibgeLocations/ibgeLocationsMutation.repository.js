// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationsMutation.repository.js — create / update / remove     ║
// ║ remove = soft delete (status = false)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ibgeLocations.constants.js';
import { normalizePayload } from './ibgeLocations.sanitizers.js';
import { rowToModel } from './ibgeLocations.mappers.js';
import { getById } from './ibgeLocationsQuery.repository.js';

/* =======================================================================
 * CREATE
 * ======================================================================= */
export async function create(data = {}) {
  const normalized = normalizePayload(data);

  if (!normalized.state) throw new Error('State (UF) is required.');
  if (!normalized.city) throw new Error('City is required.');
  if (normalized.ibge_code == null) throw new Error('ibge_code is required.');

  const cols = [];
  const vals = [];
  const placeholders = [];
  let i = 1;

  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    cols.push(k);
    vals.push(v);
    placeholders.push(`$${i}`);
    i++;
  }

  const sql = `
    INSERT INTO ${TB} (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, vals);
  return rowToModel(rows?.[0]);
}

/* =======================================================================
 * UPDATE
 * ======================================================================= */
export async function update(id, data = {}) {
  const normalized = normalizePayload(data);

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    if (v === null && (k === 'state' || k === 'city' || k === 'ibge_code')) continue;
    sets.push(`${k} = $${i}`);
    vals.push(v);
    i++;
  }

  if (!sets.length) return getById(id);

  const sql = `
    UPDATE ${TB}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE ibge_location_id = $${i}
    RETURNING *;
  `;

  vals.push(Number(id));
  const { rows } = await pool.query(sql, vals);
  return rowToModel(rows?.[0]);
}

/* =======================================================================
 * REMOVE (soft delete: status = false)
 * ======================================================================= */
export async function remove(id) {
  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET status = FALSE, updated_at = NOW()
    WHERE ibge_location_id = $1
    RETURNING *;
    `,
    [Number(id)]
  );
  return rowToModel(rows?.[0]);
}
