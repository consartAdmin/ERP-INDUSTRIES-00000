// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehiclesCreate.repository.js — createVehicle                       ║
// ║ Tabela: public."vehicles"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { mapDbError } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB, COLS } from './vehicles.constants.js';
import { pickPayload } from './vehicles.sanitizers.js';

export async function createVehicle(data) {
  const p = pickPayload(data);
  const cols = Object.keys(p);
  try {
    const { rows } = await pool.query(
      `INSERT INTO ${TB} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING ${COLS}`,
      cols.map((c) => p[c])
    );
    return rows[0];
  } catch (err) {
    throw mapDbError(err);
  }
}
