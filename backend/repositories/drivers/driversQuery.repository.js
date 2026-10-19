// ╔════════════════════════════════════════════════════════════════════╗
// ║ driversQuery.repository.js — listDrivers / getDriverById /         ║
// ║ listEligibleEmployees                                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { httpError, toInt, toBool, cleanText } from '../deliveryTrips/deliveryTrips.schema.js';
import { TB } from './drivers.constants.js';
import { SELECT } from './drivers.sql.js';

export async function listDrivers({ q = '', is_active = null } = {}) {
  const where = [];
  const params = [];
  const term = cleanText(q);
  if (term) {
    params.push(`%${term}%`);
    where.push(`(e.full_name ILIKE $${params.length} OR e.cpf ILIKE $${params.length} OR d.cnh_number ILIKE $${params.length})`);
  }
  const active = toBool(is_active, null);
  if (active !== null) {
    params.push(active);
    where.push(`d.is_active = $${params.length}`);
  }
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.full_name`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function getDriverById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE d.driver_id = $1`, [toInt(id)]);
  if (!rows[0]) throw httpError('DRIVER_NOT_FOUND', 404);
  return rows[0];
}

/** Funcionários ativos que ainda não são motoristas (para o cadastro) */
export async function listEligibleEmployees({ q = '' } = {}) {
  const params = [];
  let filter = '';
  const term = cleanText(q);
  if (term) {
    params.push(`%${term}%`);
    filter = `AND (e.full_name ILIKE $1 OR e.cpf ILIKE $1)`;
  }
  const { rows } = await pool.query(
    `SELECT e.employee_id, e.full_name, e.cpf, e.position, COALESCE(e.mobile, e.phone) AS phone
       FROM public.employees e
      WHERE COALESCE(e.active, TRUE) = TRUE
        AND NOT EXISTS (SELECT 1 FROM ${TB} d WHERE d.employee_id = e.employee_id)
        ${filter}
      ORDER BY e.full_name
      LIMIT 200`,
    params
  );
  return rows;
}
