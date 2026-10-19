// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsUpdate.repository.js — update parcial / status   ║
// ║ Tabela: public."deliveryRouteStops"                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRouteStops.constants.js';
import {
  toInt,
  cleanText,
  normalizeMovementType,
  normalizeLinkedType,
  normalizeStatus,
  normalizeDate,
  normalizeTime,
} from './deliveryRouteStops.sanitizers.js';
import { ensureRouteExists } from './deliveryRouteStopsLookup.repository.js';
import { getDeliveryRouteStopById } from './deliveryRouteStopsQuery.repository.js';

export async function updateDeliveryRouteStop(stop_id, data = {}) {
  const id = toInt(stop_id, null);
  if (!id) {
    const err = new Error('stop_id invalid');
    err.status = 400;
    throw err;
  }

  const current = await getDeliveryRouteStopById(id);
  if (!current) return null;

  const finalLinkedType = Object.prototype.hasOwnProperty.call(data, 'linked_type')
    ? normalizeLinkedType(data.linked_type, 'other')
    : normalizeLinkedType(current.linked_type, 'other');

  const set = [];
  const params = [];

  if ('route_id' in data) {
    const route_id = toInt(data.route_id, null);
    if (!route_id) {
      const err = new Error('route_id invalid');
      err.status = 400;
      throw err;
    }
    if (!(await ensureRouteExists(route_id))) {
      const err = new Error('Route not found');
      err.status = 404;
      throw err;
    }
    params.push(route_id);
    set.push(`route_id = $${params.length}`);
  }

  if ('stop_order' in data) {
    const v = toInt(data.stop_order, null);
    if (!v || v <= 0) {
      const err = new Error('stop_order invalid');
      err.status = 400;
      throw err;
    }
    params.push(v);
    set.push(`stop_order = $${params.length}`);
  }

  if ('movement_type' in data) {
    params.push(normalizeMovementType(data.movement_type, 'delivery'));
    set.push(`movement_type = $${params.length}`);
  }

  if ('linked_type' in data) {
    params.push(finalLinkedType);
    set.push(`linked_type = $${params.length}`);
  }

  if ('name' in data) {
    params.push(cleanText(data.name, 255));
    set.push(`name = $${params.length}`);
  }

  if ('tax_id' in data) {
    params.push(cleanText(data.tax_id, 32));
    set.push(`tax_id = $${params.length}`);
  }

  if ('address' in data) {
    params.push(cleanText(data.address, 500));
    set.push(`address = $${params.length}`);
  }

  if ('city' in data) {
    params.push(cleanText(data.city, 120));
    set.push(`city = $${params.length}`);
  }

  if ('region' in data) {
    params.push(cleanText(data.region, 120));
    set.push(`region = $${params.length}`);
  }

  if ('contact_name' in data) {
    params.push(cleanText(data.contact_name, 255));
    set.push(`contact_name = $${params.length}`);
  }

  if ('phone' in data) {
    params.push(cleanText(data.phone, 50));
    set.push(`phone = $${params.length}`);
  }

  if ('notes' in data) {
    params.push(data.notes ?? null);
    set.push(`notes = $${params.length}`);
  }

  if ('expected_date' in data) {
    params.push(normalizeDate(data.expected_date));
    set.push(`expected_date = $${params.length}`);
  }

  if ('expected_time' in data) {
    params.push(normalizeTime(data.expected_time));
    set.push(`expected_time = $${params.length}`);
  }

  if ('status' in data) {
    params.push(normalizeStatus(data.status, 'pending'));
    set.push(`status = $${params.length}`);
  }

  const customerProvided = Object.prototype.hasOwnProperty.call(data, 'customer_id');
  const supplierProvided = Object.prototype.hasOwnProperty.call(data, 'supplier_id');
  const linkedTypeProvided = Object.prototype.hasOwnProperty.call(data, 'linked_type');
  const shouldTouchLinks = customerProvided || supplierProvided || linkedTypeProvided;

  if (shouldTouchLinks) {
    let finalCustomerId = current.customer_id;
    let finalSupplierId = current.supplier_id;

    if (customerProvided) {
      finalCustomerId = data.customer_id == null ? null : toInt(data.customer_id, null);
    }

    if (supplierProvided) {
      finalSupplierId = data.supplier_id == null ? null : toInt(data.supplier_id, null);
    }

    if (finalLinkedType === 'customer') {
      finalSupplierId = null;
    } else if (finalLinkedType === 'supplier') {
      finalCustomerId = null;
    } else {
      finalCustomerId = null;
      finalSupplierId = null;
    }

    params.push(finalCustomerId);
    set.push(`customer_id = $${params.length}`);

    params.push(finalSupplierId);
    set.push(`supplier_id = $${params.length}`);
  }

  if (!set.length) return current;

  params.push(id);

  const sql = `
    UPDATE ${TB}
    SET ${set.join(', ')}
    WHERE stop_id = $${params.length}
    RETURNING
      stop_id, route_id, stop_order, movement_type, linked_type,
      customer_id, supplier_id,
      name, tax_id, address, city, region,
      contact_name, phone, notes, expected_date, expected_time, status,
      created_at, updated_at;
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function setDeliveryRouteStopStatus(stop_id, status) {
  const id = toInt(stop_id, null);
  const st = normalizeStatus(status, null);

  if (!id) {
    const err = new Error('stop_id invalid');
    err.status = 400;
    throw err;
  }

  if (!st) {
    const err = new Error('status invalid');
    err.status = 400;
    throw err;
  }

  const sql = `
    UPDATE ${TB}
    SET status = $1
    WHERE stop_id = $2
    RETURNING
      stop_id, route_id, stop_order, movement_type, linked_type,
      customer_id, supplier_id,
      name, tax_id, address, city, region,
      contact_name, phone, notes, expected_date, expected_time, status,
      created_at, updated_at;
  `;

  const { rows } = await pool.query(sql, [st, id]);
  return rows[0] || null;
}
