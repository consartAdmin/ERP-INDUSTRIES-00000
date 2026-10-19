// ╔════════════════════════════════════════════════════════════════════╗
// ║ driversUpdate.repository.js — updateDriver                         ║
// ║ Tabela: public."drivers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, toInt, mapDbError } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB } from './drivers.constants.js';
import { pickPayload } from './drivers.sanitizers.js';
import { getDriverById } from './driversQuery.repository.js';

export async function updateDriver(id, data) {
  const p = pickPayload(data, { partial: true });
  const cols = Object.keys(p);
  if (!cols.length) return getDriverById(id);
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${TB} SET ${sets} WHERE driver_id = $1`,
      [toInt(id), ...cols.map((c) => p[c])]
    );
    if (!rowCount) throw httpError('DRIVER_NOT_FOUND', 404);
    return getDriverById(id);
  } catch (err) {
    if (err?.code === '23503') throw httpError('EMPLOYEE_NOT_FOUND', 404);
    throw mapDbError(err);
  }
}
