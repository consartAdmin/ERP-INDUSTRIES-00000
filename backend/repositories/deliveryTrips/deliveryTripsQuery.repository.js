// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsQuery.repository.js — listTrips / getTrip             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TRIP_STATUS, httpError, toInt, cleanText, toEnum, toDate,
} from './deliveryTrips.schema.js';
import { TRIPS, STOPS } from './deliveryTrips.constants.js';
import { TRIP_SELECT, STOP_COLS } from './deliveryTrips.sql.js';

/* ─────────────────────────── Rotas ─────────────────────────── */

export async function listTrips({
  q = '', status = '', date_from = null, date_to = null, driver_id = null, page = 1, limit = 30,
} = {}) {
  const where = [];
  const params = [];
  const term = cleanText(q);
  if (term) {
    params.push(`%${term}%`);
    where.push(`(t.name ILIKE $${params.length} OR e.full_name ILIKE $${params.length}
                 OR v.plate ILIKE $${params.length} OR t.trip_id::text = $${params.length + 1})`);
    params.push(term);
  }
  const st = cleanText(status);
  if (st) { params.push(toEnum(st, TRIP_STATUS, 'INVALID_STATUS')); where.push(`t.status = $${params.length}`); }
  const from = toDate(date_from);
  if (from) { params.push(from); where.push(`t.trip_date >= $${params.length}`); }
  const to = toDate(date_to);
  if (to) { params.push(to); where.push(`t.trip_date <= $${params.length}`); }
  const drv = toInt(driver_id);
  if (drv) { params.push(drv); where.push(`t.driver_id = $${params.length}`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(toInt(limit, 30), 1), 200);
  const safePage = Math.max(toInt(page, 1), 1);

  const countSql = `
    SELECT COUNT(*)::int AS total FROM ${TRIPS} t
      LEFT JOIN public."drivers" d  ON d.driver_id = t.driver_id
      LEFT JOIN public.employees e  ON e.employee_id = d.employee_id
      LEFT JOIN public."vehicles" v ON v.vehicle_id = t.vehicle_id
    ${whereSql}`;
  const [{ rows: [{ total }] }, { rows }] = await Promise.all([
    pool.query(countSql, params),
    pool.query(
      `${TRIP_SELECT} ${whereSql} ORDER BY t.trip_date DESC, t.trip_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, (safePage - 1) * safeLimit]
    ),
  ]);
  return { total, page: safePage, limit: safeLimit, rows };
}

export async function getTrip(tripId, db = pool) {
  const id = toInt(tripId);
  const { rows } = await db.query(`${TRIP_SELECT} WHERE t.trip_id = $1`, [id]);
  if (!rows[0]) throw httpError('TRIP_NOT_FOUND', 404);
  const { rows: stops } = await db.query(
    `SELECT ${STOP_COLS} FROM ${STOPS} s
       LEFT JOIN public."invoicesIssued" inv ON inv.invoice_id = s.invoice_id
      WHERE s.trip_id = $1 ORDER BY s.stop_order, s.stop_id`,
    [id]
  );
  return { ...rows[0], stops };
}
