// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsRemove.repository.js — deleteDeliveryRouteStop   ║
// ║ Tabela: public."deliveryRouteStops"                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRouteStops.constants.js';
import { toInt } from './deliveryRouteStops.sanitizers.js';

export async function deleteDeliveryRouteStop(stop_id) {
  const id = toInt(stop_id, null);
  if (!id) {
    const err = new Error('stop_id invalid');
    err.status = 400;
    throw err;
  }

  const sql = `
    DELETE FROM ${TB}
    WHERE stop_id = $1
    RETURNING stop_id, route_id;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
