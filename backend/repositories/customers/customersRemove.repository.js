// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersRemove.repository.js — soft/hard delete                   ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB } from './customers.constants.js';
import { toNumOrNull } from './customers.utils.js';

/**
 * DELETE (soft por padrão; { hard: true } remove a linha)
 */
export async function removeById(id, { hard = false } = {}) {
  const cid = toNumOrNull(id);

  if (!cid) {
    throw new Error('invalid customer_id');
  }

  if (hard) {
    const { rowCount } = await pool.query(
      `DELETE FROM ${tb()}
        WHERE customer_id = $1`,
      [cid]
    );

    return {
      ok: rowCount > 0,
      hard: true,
    };
  }

  const { rowCount } = await pool.query(
    `UPDATE ${tb()}
        SET is_active = FALSE,
            updated_at = NOW()
      WHERE customer_id = $1`,
    [cid]
  );

  return {
    ok: rowCount > 0,
    hard: false,
  };
}

export default removeById;
