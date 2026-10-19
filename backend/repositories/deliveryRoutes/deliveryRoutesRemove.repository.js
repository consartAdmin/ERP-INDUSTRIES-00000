// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutesRemove.repository.js — deleteDeliveryRoute           ║
// ║ Tabela: public."deliveryRoutes"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRoutes.constants.js';
import { toInt } from './deliveryRoutes.sanitizers.js';

export async function deleteDeliveryRoute(route_id) {
  const id = toInt(route_id, null);
  if (!id) {
    const err = new Error('route_id invalid');
    err.status = 400;
    throw err;
  }

  const sql = `
    DELETE FROM ${TB}
    WHERE route_id = $1
    RETURNING route_id;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
