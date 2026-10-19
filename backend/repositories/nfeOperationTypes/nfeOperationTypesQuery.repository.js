// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeOperationTypesQuery.repository.js — search / getById / getByCode║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeOperationTypes.constants.js';
import { positiveInteger, text, boolean } from './nfeOperationTypes.sanitizers.js';
import { rowToOperation } from './nfeOperationTypes.mappers.js';
import { ensureTable } from './nfeOperationTypesSchema.repository.js';

export async function search({ q = '', active = null, limit = 100, offset = 0 } = {}) {
  await ensureTable();
  const args = [];
  const where = [];
  if (text(q)) {
    args.push(`%${text(q).toLowerCase()}%`);
    where.push(`(LOWER(code) LIKE $${args.length} OR LOWER(name) LIKE $${args.length} OR LOWER(nature_operation) LIKE $${args.length})`);
  }
  if (active !== null && active !== undefined && active !== '') {
    args.push(boolean(active));
    where.push(`active = $${args.length}`);
  }
  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rowsArgs = [...args, safeLimit, safeOffset];
  const [rowsResult, countResult] = await Promise.all([
    pool.query(`SELECT * FROM ${TB} ${filter} ORDER BY name, operation_type_id LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, rowsArgs),
    pool.query(`SELECT COUNT(*) AS total FROM ${TB} ${filter}`, args),
  ]);
  return { ok: true, rows: rowsResult.rows.map(rowToOperation), total: Number(countResult.rows[0]?.total || 0) };
}

export async function getById(operationTypeId) {
  await ensureTable();
  const id = positiveInteger(operationTypeId);
  if (!id) return { ok: false, error: 'operation_type_id inválido' };
  const { rows } = await pool.query(`SELECT * FROM ${TB} WHERE operation_type_id = $1`, [id]);
  return rows[0] ? { ok: true, operation: rowToOperation(rows[0]) } : { ok: false, error: 'NOT_FOUND' };
}

export async function getByCode(code) {
  await ensureTable();
  const normalized = text(code)?.toUpperCase();
  if (!normalized) return { ok: false, error: 'code inválido' };
  const { rows } = await pool.query(`SELECT * FROM ${TB} WHERE UPPER(code) = $1`, [normalized]);
  return rows[0] ? { ok: true, operation: rowToOperation(rows[0]) } : { ok: false, error: 'NOT_FOUND' };
}
