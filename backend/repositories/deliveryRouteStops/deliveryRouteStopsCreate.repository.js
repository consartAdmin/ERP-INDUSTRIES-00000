// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsCreate.repository.js — createDeliveryRouteStop   ║
// ║ Tabela: public."deliveryRouteStops"                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRouteStops.constants.js';
import { coerceByLinkedType } from './deliveryRouteStops.sanitizers.js';
import { ensureRouteExists, getNextStopOrder } from './deliveryRouteStopsLookup.repository.js';

export async function createDeliveryRouteStop(data = {}) {
  const payload = coerceByLinkedType(data);

  if (!payload.route_id) {
    const err = new Error('route_id is required');
    err.status = 400;
    throw err;
  }

  if (!(await ensureRouteExists(payload.route_id))) {
    const err = new Error('Route not found');
    err.status = 404;
    throw err;
  }

  if (!payload.stop_order || payload.stop_order <= 0) {
    payload.stop_order = await getNextStopOrder(payload.route_id);
  }

  const sql = `
    INSERT INTO ${TB}
      (
        route_id, stop_order, movement_type, linked_type,
        customer_id, supplier_id,
        name, tax_id, address, city, region,
        contact_name, phone, notes, expected_date, expected_time, status
      )
    VALUES
      (
        $1,$2,$3,$4,
        $5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17
      )
    RETURNING
      stop_id, route_id, stop_order, movement_type, linked_type,
      customer_id, supplier_id,
      name, tax_id, address, city, region,
      contact_name, phone, notes, expected_date, expected_time, status,
      created_at, updated_at;
  `;

  const params = [
    payload.route_id,
    payload.stop_order,
    payload.movement_type,
    payload.linked_type,
    payload.customer_id,
    payload.supplier_id,
    payload.name,
    payload.tax_id,
    payload.address,
    payload.city,
    payload.region,
    payload.contact_name,
    payload.phone,
    payload.notes,
    payload.expected_date,
    payload.expected_time,
    payload.status,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}
