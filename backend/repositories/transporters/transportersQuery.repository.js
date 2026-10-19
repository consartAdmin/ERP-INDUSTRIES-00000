// ╔════════════════════════════════════════════════════════════════════╗
// ║ transportersQuery.repository.js — Listagem                         ║
// ║ Tabela: public.transporters                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_FIELDS } from './transporters.constants.js';

/**
 * LIST
 */
export async function list() {
  const { rows } = await pool.query(
    `
      SELECT ${SELECT_FIELDS}
      FROM ${TB}
      ORDER BY legal_name ASC, transporter_id ASC
    `,
  );

  return rows;
}

export default list;
