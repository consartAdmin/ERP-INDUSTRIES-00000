// ╔════════════════════════════════════════════════════════════════════╗
// ║ driversCreate.repository.js — createDriver                         ║
// ║ Tabela: public."drivers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, mapDbError } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB } from './drivers.constants.js';
import { pickPayload } from './drivers.sanitizers.js';
import { getDriverById } from './driversQuery.repository.js';

export async function createDriver(data) {
  const p = pickPayload(data);
  try {
    const { rows } = await pool.query(
      `INSERT INTO ${TB} (employee_id, cnh_number, cnh_category, cnh_expiration, phone, is_active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING driver_id`,
      [p.employee_id, p.cnh_number, p.cnh_category, p.cnh_expiration, p.phone, p.is_active, p.notes]
    );
    return getDriverById(rows[0].driver_id);
  } catch (err) {
    if (err?.code === '23503') throw httpError('EMPLOYEE_NOT_FOUND', 404);
    throw mapDbError(err);
  }
}
