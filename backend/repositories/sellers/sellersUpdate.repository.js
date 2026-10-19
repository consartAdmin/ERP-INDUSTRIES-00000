// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellersUpdate.repository.js — update                               ║
// ║ Tabela: public."sellers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './sellers.constants.js';
import { normalizePayload } from './sellers.sanitizers.js';
import { rowToModel } from './sellers.mappers.js';
import { getById } from './sellersQuery.repository.js';

export async function update(id, data = {}) {
  const normalized = normalizePayload(data);

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${i}`);
    vals.push(v);
    i++;
  }

  if (!sets.length) {
    return getById(id);
  }

  const sql = `
    UPDATE ${tbl()}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE id = $${i}
    RETURNING *;
  `;

  vals.push(Number(id));
  const { rows } = await pool.query(sql, vals);
  return rowToModel(rows[0]);
}
