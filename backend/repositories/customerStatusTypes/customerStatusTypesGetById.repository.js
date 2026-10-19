// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesGetById.repository.js — getById                 ║
// ║ Tabela: public."customerStatusTypes"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './customerStatusTypes.constants.js';
import { toNumOrNull } from './customerStatusTypes.sanitizers.js';
import { mapRow } from './customerStatusTypes.mappers.js';

/** GET BY ID */
export async function getById(id) {
  const sid = toNumOrNull(id);
  if (!sid) throw new Error('invalid status type id');

  const { rows } = await pool.query(`SELECT * FROM ${tbl()} WHERE id = $1`, [sid]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export default getById;
