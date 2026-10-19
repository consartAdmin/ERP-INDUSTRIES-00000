// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswordsQuery.repository.js — list / getById                ║
// ║ Tabela: public."modulePasswords"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './modulePasswords.constants.js';
import { mapRow } from './modulePasswords.mappers.js';
import { toIdOrNull } from './modulePasswords.sanitizers.js';
import { ready } from './modulePasswordsSchema.repository.js';

/** LIST */
export async function list() {
  await ready();
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} ORDER BY module_code, action_code`
  );
  return rows.map(mapRow);
}

/** GET BY ID */
export async function getById(id) {
  const sid = toIdOrNull(id);
  if (!sid) return null;

  await ready();
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE module_password_id = $1`,
    [sid]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
