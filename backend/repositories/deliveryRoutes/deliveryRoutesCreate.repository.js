// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutesCreate.repository.js — createDeliveryRoute           ║
// ║ Tabela: public."deliveryRoutes"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRoutes.constants.js';
import {
  toInt,
  toBool,
  normalizeWeekdays,
  normalizeRouteType,
  cleanText,
  coerceLinkByType,
} from './deliveryRoutes.sanitizers.js';

export async function createDeliveryRoute(data = {}) {
  const payload = coerceLinkByType({
    route_code: cleanText(data.route_code, 80),
    name: cleanText(data.name, 255) || '',
    route_type: normalizeRouteType(data.route_type, 'customers'),

    city: cleanText(data.city, 100),
    region: cleanText(data.region, 100),
    weekdays: normalizeWeekdays(data.weekdays),

    driver_name: cleanText(data.driver_name, 120),
    vehicle_plate: cleanText(data.vehicle_plate, 20),

    is_active: toBool(data.is_active, true),
    notes: data.notes ?? null,

    customer_id: data.customer_id != null ? toInt(data.customer_id, null) : null,
    supplier_id: data.supplier_id != null ? toInt(data.supplier_id, null) : null,
    linked_name: cleanText(data.linked_name, 255),
    linked_tax_id: cleanText(data.linked_tax_id, 32),
  });

  if (!payload.name) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }

  const sql = `
    INSERT INTO ${TB}
      (route_code, name, route_type, city, region, weekdays, driver_name, vehicle_plate, is_active, notes,
       customer_id, supplier_id, linked_name, linked_tax_id)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING
      route_id, route_code, name, route_type, city, region, weekdays, driver_name, vehicle_plate, is_active, notes,
      customer_id, supplier_id, linked_name, linked_tax_id,
      created_at, updated_at;
  `;

  const params = [
    payload.route_code,
    payload.name,
    payload.route_type,
    payload.city,
    payload.region,
    payload.weekdays,
    payload.driver_name,
    payload.vehicle_plate,
    payload.is_active,
    payload.notes,
    payload.customer_id,
    payload.supplier_id,
    payload.linked_name,
    payload.linked_tax_id,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}
