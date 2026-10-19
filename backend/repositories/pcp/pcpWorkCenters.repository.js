// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpWorkCenters.repository.js — Centros de trabalho (máquinas,      ║
// ║ células, setores)                                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_WORK_CENTERS } from './pcp.constants.js';
import { notEmpty, toText, toNum, badRequest, notFound } from './pcp.sanitizers.js';

export async function list({ q = '', onlyActive = 'false' } = {}) {
  const params = [];
  const where = [];
  if (String(onlyActive) === 'true') where.push('is_active = TRUE');
  if (notEmpty(q)) {
    params.push(`%${q.trim()}%`);
    where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM ${TB_WORK_CENTERS}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY code`,
    params
  );
  return rows;
}

function clean(body = {}) {
  const code = toText(body.code)?.toUpperCase();
  const name = toText(body.name);
  if (!code) throw badRequest('Informe o código do centro de trabalho.');
  if (!name) throw badRequest('Informe o nome do centro de trabalho.');
  return {
    code,
    name,
    hourly_cost: toNum(body.hourly_cost, 0),
    capacity_hours_day: toNum(body.capacity_hours_day, 8),
    notes: toText(body.notes),
    is_active: body.is_active !== false && body.is_active !== 'false',
  };
}

export async function create(body) {
  const d = clean(body);
  const { rows } = await pool.query(
    `INSERT INTO ${TB_WORK_CENTERS} (code, name, hourly_cost, capacity_hours_day, notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [d.code, d.name, d.hourly_cost, d.capacity_hours_day, d.notes, d.is_active]
  );
  return rows[0];
}

export async function update(id, body) {
  const d = clean(body);
  const { rows } = await pool.query(
    `UPDATE ${TB_WORK_CENTERS}
        SET code = $2, name = $3, hourly_cost = $4, capacity_hours_day = $5,
            notes = $6, is_active = $7, updated_at = NOW()
      WHERE work_center_id = $1 RETURNING *`,
    [id, d.code, d.name, d.hourly_cost, d.capacity_hours_day, d.notes, d.is_active]
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}

export async function remove(id) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM ${TB_WORK_CENTERS} WHERE work_center_id = $1`, [id]);
    if (!rowCount) throw notFound();
    return { removed: true };
  } catch (e) {
    if (e.code !== '23503') throw e;
    // Em uso em roteiros/apontamentos: apenas inativa.
    await pool.query(`UPDATE ${TB_WORK_CENTERS} SET is_active = FALSE, updated_at = NOW() WHERE work_center_id = $1`, [id]);
    return { removed: false, deactivated: true };
  }
}
