// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutesQuery.repository.js — getById / list paginado        ║
// ║ Tabela: public."deliveryRoutes"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryRoutes.constants.js';
import { toInt } from './deliveryRoutes.sanitizers.js';
import { buildWhere } from './deliveryRoutes.sql.js';

export async function getDeliveryRouteById(route_id) {
  const id = toInt(route_id, null);
  if (!id) return null;

  const sql = `
    SELECT
      route_id, route_code, name, route_type, city, region, weekdays, driver_name, vehicle_plate, is_active, notes,
      customer_id, supplier_id, linked_name, linked_tax_id,
      created_at, updated_at
    FROM ${TB}
    WHERE route_id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

// ======================================================================
// List / Search (paginado)
// ======================================================================
export async function listDeliveryRoutes({
  q = '',
  is_active = null,
  route_type = null,
  limit = 50,
  offset = 0,
  order = 'name',
  dir = 'asc',
} = {}) {
  const { whereSql, params } = buildWhere({ q, is_active, route_type });

  const lim = Math.max(1, Math.min(200, toInt(limit, 50)));
  const off = Math.max(0, toInt(offset, 0));

  const allowedOrder = new Set(['name', 'route_id', 'created_at', 'updated_at']);
  const orderBy = allowedOrder.has(String(order)) ? String(order) : 'name';
  const direction = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const sqlCount = `SELECT COUNT(*)::bigint AS total FROM ${TB} ${whereSql};`;
  const countRes = await pool.query(sqlCount, params);
  const total = Number(countRes.rows?.[0]?.total || 0);

  params.push(lim);
  const pLim = `$${params.length}`;
  params.push(off);
  const pOff = `$${params.length}`;

  const sql = `
    SELECT
      route_id, route_code, name, route_type, city, region, weekdays, driver_name, vehicle_plate, is_active, notes,
      customer_id, supplier_id, linked_name, linked_tax_id,
      created_at, updated_at
    FROM ${TB}
    ${whereSql}
    ORDER BY ${orderBy} ${direction}, route_id ASC
    LIMIT ${pLim} OFFSET ${pOff};
  `;

  const { rows } = await pool.query(sql, params);

  return {
    total,
    limit: lim,
    offset: off,
    rows,
  };
}
