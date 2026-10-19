// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsQuery.repository.js — getById / listByRoute      ║
// ║ Tabela: public."deliveryRouteStops"                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRouteStops.constants.js';
import { toInt } from './deliveryRouteStops.sanitizers.js';

export async function getDeliveryRouteStopById(stop_id) {
  const id = toInt(stop_id, null);
  if (!id) return null;

  const sql = `
    SELECT
      stop_id, route_id, stop_order, movement_type, linked_type,
      customer_id, supplier_id,
      name, tax_id, address, city, region,
      contact_name, phone, notes, expected_date, expected_time, status,
      created_at, updated_at
    FROM ${TB}
    WHERE stop_id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

export async function listDeliveryRouteStopsByRoute(route_id) {
  const id = toInt(route_id, null);
  if (!id) {
    const err = new Error('route_id invalid');
    err.status = 400;
    throw err;
  }

  const sql = `
    SELECT
      stop_id, route_id, stop_order, movement_type, linked_type,
      customer_id, supplier_id,
      name, tax_id, address, city, region,
      contact_name, phone, notes, expected_date, expected_time, status,
      created_at, updated_at
    FROM ${TB}
    WHERE route_id = $1
    ORDER BY stop_order ASC, stop_id ASC;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows;
}
