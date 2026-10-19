// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehiclesUpdate.repository.js — updateVehicle                       ║
// ║ Tabela: public."vehicles"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, toInt, mapDbError } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB, COLS } from './vehicles.constants.js';
import { pickPayload } from './vehicles.sanitizers.js';
import { getVehicleById } from './vehiclesQuery.repository.js';

export async function updateVehicle(id, data) {
  const p = pickPayload(data, { partial: true });
  const cols = Object.keys(p);
  if (!cols.length) return getVehicleById(id);
  try {
    const { rows } = await pool.query(
      `UPDATE ${TB} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}
        WHERE vehicle_id = $1 RETURNING ${COLS}`,
      [toInt(id), ...cols.map((c) => p[c])]
    );
    if (!rows[0]) throw httpError('VEHICLE_NOT_FOUND', 404);
    return rows[0];
  } catch (err) {
    throw mapDbError(err);
  }
}
