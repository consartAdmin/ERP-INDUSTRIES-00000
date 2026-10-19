// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehiclesQuery.repository.js — listVehicles / getVehicleById        ║
// ║ Tabela: public."vehicles"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, toInt, toBool, cleanText } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB, COLS } from './vehicles.constants.js';

export async function listVehicles({ q = '', is_active = null } = {}) {
  const where = [];
  const params = [];
  const term = cleanText(q);
  if (term) {
    params.push(`%${term}%`);
    where.push(`(plate ILIKE $${params.length} OR description ILIKE $${params.length} OR brand ILIKE $${params.length})`);
  }
  const active = toBool(is_active, null);
  if (active !== null) {
    params.push(active);
    where.push(`is_active = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM ${TB} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY plate`,
    params
  );
  return rows;
}

export async function getVehicleById(id) {
  const { rows } = await pool.query(`SELECT ${COLS} FROM ${TB} WHERE vehicle_id = $1`, [toInt(id)]);
  if (!rows[0]) throw httpError('VEHICLE_NOT_FOUND', 404);
  return rows[0];
}
