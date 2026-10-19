// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsReorder.repository.js — reordena paradas         ║
// ║ Transação única; devolve a lista atualizada da rota                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRouteStops.constants.js';
import { toInt } from './deliveryRouteStops.sanitizers.js';
import { listDeliveryRouteStopsByRoute } from './deliveryRouteStopsQuery.repository.js';

export async function reorderDeliveryRouteStops(route_id, items = []) {
  const rid = toInt(route_id, null);
  if (!rid) {
    const err = new Error('route_id invalid');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(items) || !items.length) {
    const err = new Error('items is required');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      const stop_id = toInt(item?.stop_id, null);
      const stop_order = toInt(item?.stop_order, null);

      if (!stop_id || !stop_order || stop_order <= 0) {
        const err = new Error('Invalid reorder item');
        err.status = 400;
        throw err;
      }

      const sql = `
        UPDATE ${TB}
        SET stop_order = $1
        WHERE stop_id = $2
          AND route_id = $3;
      `;
      await client.query(sql, [stop_order, stop_id, rid]);
    }

    await client.query('COMMIT');
    return await listDeliveryRouteStopsByRoute(rid);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
