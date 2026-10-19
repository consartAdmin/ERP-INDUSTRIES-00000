// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusUpdate.repository.js — updateById                    ║
// ║ Tabela: public."customerStatus"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './customerStatus.constants.js';
import { sanitizeUpdate, toNumOrNull } from './customerStatus.sanitizers.js';
import { mapRow } from './customerStatus.mappers.js';

/** UPDATE BY ID */
export async function updateById(id, payload) {
  const sid = toNumOrNull(id);
  if (!sid) throw new Error('invalid customerStatus id');

  const data = sanitizeUpdate(payload);
  const sets = [];
  const params = [];

  for (const [k, v] of Object.entries(data)) {
    params.push(v);
    sets.push(`"${k}" = $${params.length}`);
  }

  if (!sets.length) {
    const { rows } = await pool.query(`SELECT * FROM ${tbl()} WHERE id = $1`, [sid]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  params.push(new Date());
  sets.push(`"updated_at" = $${params.length}`);

  params.push(sid);
  const sql = `
    UPDATE ${tbl()}
       SET ${sets.join(', ')}
     WHERE id = $${params.length}
     RETURNING *;
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0] ? mapRow(rows[0]) : null;
}

export default updateById;
