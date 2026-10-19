// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserRemove.repository.js — remove                          ║
// ║ Tabela: public."sellerByUser"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellerByUser.constants.js';

export async function remove(id) {
  const { rows } = await pool.query(
    `
    DELETE FROM ${TB}
    WHERE id = $1
    RETURNING id
    `,
    [Number(id)]
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}
