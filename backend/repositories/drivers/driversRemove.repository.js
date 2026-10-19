// ╔════════════════════════════════════════════════════════════════════╗
// ║ driversRemove.repository.js — deleteDriver                         ║
// ║ Tabela: public."drivers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, toInt, mapDbError } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB } from './drivers.constants.js';

export async function deleteDriver(id) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM ${TB} WHERE driver_id = $1`, [toInt(id)]);
    if (!rowCount) throw httpError('DRIVER_NOT_FOUND', 404);
    return { driver_id: toInt(id) };
  } catch (err) {
    throw mapDbError(err);
  }
}
