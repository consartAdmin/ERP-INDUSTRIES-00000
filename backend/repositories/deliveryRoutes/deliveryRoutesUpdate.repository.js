// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutesUpdate.repository.js — update parcial / ativo        ║
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
} from './deliveryRoutes.sanitizers.js';
import { getDeliveryRouteById } from './deliveryRoutesQuery.repository.js';

export async function updateDeliveryRoute(route_id, data = {}) {
  const id = toInt(route_id, null);
  if (!id) {
    const err = new Error('route_id invalid');
    err.status = 400;
    throw err;
  }

  const current = await getDeliveryRouteById(id);
  if (!current) return null;

  const finalRouteType = ('route_type' in data)
    ? normalizeRouteType(data.route_type, 'customers')
    : normalizeRouteType(current.route_type, 'customers');

  const set = [];
  const params = [];

  if ('route_code' in data) {
    params.push(cleanText(data.route_code, 80));
    set.push(`route_code = $${params.length}`);
  }

  if ('name' in data) {
    const v = cleanText(data.name, 255) || '';
    if (!v) {
      const err = new Error('name is required');
      err.status = 400;
      throw err;
    }
    params.push(v);
    set.push(`name = $${params.length}`);
  }

  if ('route_type' in data) {
    params.push(finalRouteType);
    set.push(`route_type = $${params.length}`);
  }

  if ('city' in data) {
    params.push(cleanText(data.city, 100));
    set.push(`city = $${params.length}`);
  }

  if ('region' in data) {
    params.push(cleanText(data.region, 100));
    set.push(`region = $${params.length}`);
  }

  if ('weekdays' in data) {
    params.push(normalizeWeekdays(data.weekdays));
    set.push(`weekdays = $${params.length}`);
  }

  if ('driver_name' in data) {
    params.push(cleanText(data.driver_name, 120));
    set.push(`driver_name = $${params.length}`);
  }

  if ('vehicle_plate' in data) {
    params.push(cleanText(data.vehicle_plate, 20));
    set.push(`vehicle_plate = $${params.length}`);
  }

  if ('is_active' in data) {
    const v = toBool(data.is_active, null);
    if (v === null) {
      const err = new Error('is_active invalid');
      err.status = 400;
      throw err;
    }
    params.push(v);
    set.push(`is_active = $${params.length}`);
  }

  if ('notes' in data) {
    params.push(data.notes ?? null);
    set.push(`notes = $${params.length}`);
  }

  if ('linked_name' in data) {
    params.push(cleanText(data.linked_name, 255));
    set.push(`linked_name = $${params.length}`);
  }

  if ('linked_tax_id' in data) {
    params.push(cleanText(data.linked_tax_id, 32));
    set.push(`linked_tax_id = $${params.length}`);
  }

  // ============================================================
  // VÍNCULOS — sempre definir UMA ÚNICA VEZ, sem repetir coluna
  // ============================================================
  const customerProvided = Object.prototype.hasOwnProperty.call(data, 'customer_id');
  const supplierProvided = Object.prototype.hasOwnProperty.call(data, 'supplier_id');
  const routeTypeProvided = Object.prototype.hasOwnProperty.call(data, 'route_type');

  const shouldTouchLinks = routeTypeProvided || customerProvided || supplierProvided;

  if (shouldTouchLinks) {
    let finalCustomerId = current.customer_id;
    let finalSupplierId = current.supplier_id;

    if (customerProvided) {
      finalCustomerId = data.customer_id == null ? null : toInt(data.customer_id, null);
    }

    if (supplierProvided) {
      finalSupplierId = data.supplier_id == null ? null : toInt(data.supplier_id, null);
    }

    if (finalRouteType === 'customers') {
      finalSupplierId = null;
    } else if (finalRouteType === 'suppliers') {
      finalCustomerId = null;
    }

    params.push(finalCustomerId);
    set.push(`customer_id = $${params.length}`);

    params.push(finalSupplierId);
    set.push(`supplier_id = $${params.length}`);
  }

  if (!set.length) {
    return current;
  }

  params.push(id);

  const sql = `
    UPDATE ${TB}
    SET ${set.join(', ')}
    WHERE route_id = $${params.length}
    RETURNING
      route_id, route_code, name, route_type, city, region, weekdays, driver_name, vehicle_plate, is_active, notes,
      customer_id, supplier_id, linked_name, linked_tax_id,
      created_at, updated_at;
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function setDeliveryRouteActive(route_id, isActive) {
  const id = toInt(route_id, null);
  const v = toBool(isActive, null);

  if (!id || v === null) {
    const err = new Error('route_id / is_active invalid');
    err.status = 400;
    throw err;
  }

  const sql = `
    UPDATE ${TB}
    SET is_active = $1
    WHERE route_id = $2
    RETURNING
      route_id, route_code, name, route_type, city, region, weekdays, driver_name, vehicle_plate, is_active, notes,
      customer_id, supplier_id, linked_name, linked_tax_id,
      created_at, updated_at;
  `;

  const { rows } = await pool.query(sql, [v, id]);
  return rows[0] || null;
}
