// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusRemove.repository.js — removeByCustomerId            ║
// ║ Tabela: public."customerStatus"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl } from './customerStatus.constants.js';
import { toNumOrNull } from './customerStatus.sanitizers.js';

/** DELETE por customer_id */
export async function removeByCustomerId(customerId) {
  const cid = toNumOrNull(customerId);
  if (!cid) throw new Error('invalid customer_id');

  const { rowCount } = await pool.query(`DELETE FROM ${tbl()} WHERE customer_id = $1`, [cid]);
  return { ok: rowCount > 0 };
}

export default removeByCustomerId;
