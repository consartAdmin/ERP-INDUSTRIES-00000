// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentFormsQuery.repository.js — getById / getByTpag / listAll    ║
// ║ Tabela: public."paymentForms"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, PK } from './paymentForms.constants.js';
import { mapRow } from './paymentForms.mappers.js';
import { normalizeTpag } from './paymentForms.sanitizers.js';

export async function getById(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const sql = `
    SELECT *
    FROM ${TABLE}
    WHERE ${PK} = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [numericId]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getByTpag(nfe_tpag) {
  const tpag = normalizeTpag(nfe_tpag);
  if (!tpag) return null;

  const sql = `
    SELECT *
    FROM ${TABLE}
    WHERE nfe_tpag = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [tpag]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listAll({ activeOnly = false } = {}) {
  const params = [];
  const where = [];

  if (activeOnly) {
    params.push(true);
    where.push('active = $1');
  }

  const sql = `
    SELECT *
    FROM ${TABLE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY name ASC;
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}
