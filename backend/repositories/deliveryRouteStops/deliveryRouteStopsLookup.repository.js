// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsLookup.repository.js — helpers internos          ║
// ║ ensureRouteExists / getNextStopOrder                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRouteStops.constants.js';

export async function ensureRouteExists(route_id) {
  const sql = `
    SELECT 1
    FROM public."deliveryRoutes"
    WHERE route_id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [route_id]);
  return !!rows[0];
}

export async function getNextStopOrder(route_id) {
  const sql = `
    SELECT COALESCE(MAX(stop_order), 0) + 1 AS next_order
    FROM ${TB}
    WHERE route_id = $1;
  `;
  const { rows } = await pool.query(sql, [route_id]);
  return Number(rows?.[0]?.next_order || 1);
}
