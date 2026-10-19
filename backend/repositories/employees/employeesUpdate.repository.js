// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesUpdate.repository.js — update                               ║
// ║ Tabela: public.employees                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK } from './employees.constants.js';
import { ensureTable } from './employeesSchema.repository.js';
import { normalizePayload } from './employees.sanitizers.js';
import { getById } from './employeesQuery.repository.js';

export async function update(id, input = {}) {
  await ensureTable();
  const data = normalizePayload(input);
  if (!Object.keys(data).length) return getById(id);

  const sets = [];
  const vals = [];

  Object.entries(data).forEach(([col, val]) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  });

  sets.push(`updated_at = NOW()::timestamp`);

  const { rows } = await pool.query(
    `UPDATE ${TB} SET ${sets.join(', ')} WHERE ${PK} = $${vals.length + 1} RETURNING *;`,
    [...vals, Number(id)]
  );

  return rows[0] || null;
}
