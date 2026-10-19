// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEventsQuery.repository.js — findById / find* / list     ║
// ║ Tabela: public."nfeInutilizarEvents"                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { BASE_SELECT } from './nfeInutilizarEvents.sql.js';
import {
  normalizeDigits,
  toInt,
  normalizeStatusValue,
} from './nfeInutilizarEvents.sanitizers.js';
import { mapRow } from './nfeInutilizarEvents.mappers.js';

/* =======================================================================
 * Queries
 * ======================================================================= */
export async function findById(id) {
  const sql = `
    ${BASE_SELECT}
    WHERE id = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [toInt(id)]);
  return mapRow(rows[0]);
}

/* ================================================================
 * DUPLICADO EXATO
 * ================================================================ */
export async function findDuplicate({ companyCnpj, model, serie, numberStart, numberEnd, year }) {
  const sql = `
    ${BASE_SELECT}
    WHERE companycnpj = $1
      AND model = $2
      AND serie = $3
      AND numberstart = $4
      AND numberend = $5
      AND year = $6
    ORDER BY id DESC
    LIMIT 1
  `;

  const values = [
    normalizeDigits(companyCnpj),
    String(model || '55').trim(),
    toInt(serie),
    toInt(numberStart),
    toInt(numberEnd),
    toInt(year),
  ];

  const { rows } = await pool.query(sql, values);
  return mapRow(rows[0]);
}

/* ================================================================
 * 🔥 FAIXA SOBREPOSTA (CORREÇÃO CRÍTICA)
 * ================================================================ */
export async function findOverlappingRange({
  companyCnpj,
  model,
  serie,
  numberStart,
  numberEnd,
  year,
}) {
  const sql = `
    ${BASE_SELECT}
    WHERE companycnpj = $1
      AND model = $2
      AND serie = $3
      AND year = $4
      AND numberstart <= $5
      AND numberend >= $6
    ORDER BY id DESC
    LIMIT 1
  `;

  const values = [
    normalizeDigits(companyCnpj),
    String(model || '55').trim(),
    toInt(serie),
    toInt(year),
    toInt(numberEnd),
    toInt(numberStart),
  ];

  const { rows } = await pool.query(sql, values);
  return mapRow(rows[0]);
}

/* ================================================================
 * AUTORIZADA POR NÚMERO
 * ================================================================ */
export async function findAuthorizedByNumberRange({
  companyCnpj,
  model = '55',
  serie,
  number,
  year,
}) {
  const sql = `
    ${BASE_SELECT}
    WHERE companycnpj = $1
      AND model = $2
      AND serie = $3
      AND year = $4
      AND $5 BETWEEN numberstart AND numberend
      AND UPPER(COALESCE(status, '')) = 'AUTHORIZED'
    ORDER BY id DESC
    LIMIT 1
  `;

  const values = [
    normalizeDigits(companyCnpj),
    String(model || '55').trim(),
    toInt(serie),
    toInt(year),
    toInt(number),
  ];

  const { rows } = await pool.query(sql, values);
  return mapRow(rows[0]);
}

/* ================================================================
 * LIST
 * ================================================================ */
export async function list(filters = {}) {
  const where = [];
  const values = [];
  let idx = 1;

  if (filters.status) {
    where.push(`UPPER(COALESCE(status, '')) = $${idx++}`);
    values.push(normalizeStatusValue(filters.status));
  }

  if (filters.companyCnpj) {
    where.push(`companycnpj = $${idx++}`);
    values.push(normalizeDigits(filters.companyCnpj));
  }

  if (filters.model) {
    where.push(`model = $${idx++}`);
    values.push(String(filters.model).trim());
  }

  if (filters.serie != null && filters.serie !== '') {
    where.push(`serie = $${idx++}`);
    values.push(toInt(filters.serie));
  }

  if (filters.year != null && filters.year !== '') {
    where.push(`year = $${idx++}`);
    values.push(toInt(filters.year));
  }

  if (filters.number != null && filters.number !== '') {
    where.push(`$${idx++} BETWEEN numberstart AND numberend`);
    values.push(toInt(filters.number));
  }

  if (filters.protocol) {
    where.push(`protocol = $${idx++}`);
    values.push(String(filters.protocol).trim());
  }

  const limit = Math.min(Math.max(toInt(filters.limit || 50), 1), 500);
  const offset = Math.max(toInt(filters.offset || 0), 0);

  values.push(limit);
  const limitParam = `$${idx++}`;

  values.push(offset);
  const offsetParam = `$${idx++}`;

  const sql = `
    ${BASE_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const { rows } = await pool.query(sql, values);
  return rows.map(mapRow);
}
