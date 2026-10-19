// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehiclesRemove.repository.js — deleteVehicle                       ║
// ║ Tabela: public."vehicles"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, toInt, mapDbError } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB } from './vehicles.constants.js';

export async function deleteVehicle(id) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM ${TB} WHERE vehicle_id = $1`, [toInt(id)]);
    if (!rowCount) throw httpError('VEHICLE_NOT_FOUND', 404);
    return { vehicle_id: toInt(id) };
  } catch (err) {
    throw mapDbError(err);
  }
}
