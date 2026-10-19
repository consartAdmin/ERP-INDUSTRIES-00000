// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethodsUpdate.repository.js — update / toggleActive         ║
// ║ Tabela: public."paymentMethods"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK, GAP_COLUMNS } from './paymentMethods.constants.js';
import { SELECT_COLUMNS } from './paymentMethods.sql.js';
import { toInt, toBool, normalizePayload, validatePayload } from './paymentMethods.sanitizers.js';
import { fromDb } from './paymentMethods.mappers.js';
import { getById } from './paymentMethodsQuery.repository.js';

export async function update(id, payload = {}) {
  const safeId = toInt(id, 0);
  if (!safeId) throw new Error('ID inválido.');

  const current = await getById(safeId);
  if (!current) return null;

  const data = normalizePayload({ ...current, ...payload });
  validatePayload(data);

  const columns = ['name', 'type', 'installments', ...GAP_COLUMNS, 'nfe_tpag', 'active'];
  const assignments = columns.map((column, index) => `"${column}" = $${index + 2}`).join(', ');
  const values = [safeId, ...columns.map((column) => data[column])];

  const { rows } = await pool.query(`
    UPDATE ${TB}
    SET ${assignments}
    WHERE ${PK} = $1
    RETURNING ${SELECT_COLUMNS};
  `, values);

  return rows[0] ? fromDb(rows[0]) : null;
}

export async function toggleActive(id, active) {
  const safeId = toInt(id, 0);
  if (!safeId) throw new Error('ID inválido.');

  const { rows } = await pool.query(`
    UPDATE ${TB}
    SET "active" = $2
    WHERE ${PK} = $1
    RETURNING ${SELECT_COLUMNS};
  `, [safeId, toBool(active)]);

  return rows[0] ? fromDb(rows[0]) : null;
}
