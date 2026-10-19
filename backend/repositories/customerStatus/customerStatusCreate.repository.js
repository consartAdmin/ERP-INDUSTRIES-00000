// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusCreate.repository.js — create / setStatusForCustomer ║
// ║ Tabela: public."customerStatus" (UPSERT por customer_id)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, FIELDS } from './customerStatus.constants.js';
import { sanitizeCreate, toNumOrNull, trimOrNull } from './customerStatus.sanitizers.js';
import { mapRow } from './customerStatus.mappers.js';

/** CREATE simples (use setStatusForCustomer para garantir 1 por cliente) */
export async function create(payload) {
  const data = sanitizeCreate(payload);

  if (!data.customer_id) throw new Error('customer_id is required');
  if (!data.status_type_id) throw new Error('status_type_id is required');

  const cols = [];
  const vals = [];
  const params = [];

  for (const k of FIELDS) {
    if (data[k] !== undefined) {
      cols.push(`"${k}"`);
      params.push(data[k]);
      vals.push(`$${params.length}`);
    }
  }

  const sql = `
    INSERT INTO ${tbl()} (${cols.join(', ')})
    VALUES (${vals.join(', ')})
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * setStatusForCustomer — UPSERT por customer_id
 * Garante 1 linha por cliente.
 * ✅ não sobrescreve note/updated_by com null se vier vazio
 */
export async function setStatusForCustomer(customerId, statusTypeId, { note, updated_by } = {}) {
  const cid = toNumOrNull(customerId);
  const stid = toNumOrNull(statusTypeId);

  if (!cid) throw new Error('invalid customer_id');
  if (!stid) throw new Error('invalid status_type_id');

  const noteClean = trimOrNull(note);
  const byClean = toNumOrNull(updated_by);

  const sql = `
    INSERT INTO ${tbl()} (customer_id, status_type_id, note, updated_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (customer_id)
    DO UPDATE SET
      status_type_id = EXCLUDED.status_type_id,
      note           = COALESCE(EXCLUDED.note, ${tbl()}.note),
      updated_by     = COALESCE(EXCLUDED.updated_by, ${tbl()}.updated_by),
      updated_at     = NOW()
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, [cid, stid, noteClean, byClean]);
  return rows[0] ? mapRow(rows[0]) : null;
}
