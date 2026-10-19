// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesCreate.repository.js — create                   ║
// ║ Tabela: public."customerStatusTypes"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, FIELDS } from './customerStatusTypes.constants.js';
import { sanitizeCreate } from './customerStatusTypes.sanitizers.js';
import { mapRow } from './customerStatusTypes.mappers.js';

/** CREATE */
export async function create(payload) {
  const data = sanitizeCreate(payload);

  if (!data.name_pt) throw new Error('name_pt is required');
  if (!data.internal_code) throw new Error('internal_code is required');

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
  return mapRow(rows[0]);
}

export default create;
