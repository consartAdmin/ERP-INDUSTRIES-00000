// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCreditRemove.repository.js — removeByCustomerId           ║
// ║ Tabela: public."customersCredit"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CREDIT } from './customersCredit.constants.js';
import { toCustomerId } from './customersCredit.sanitizers.js';

export async function removeByCustomerId(customerId) {
  const id = toCustomerId(customerId);
  const result = await pool.query(
    `DELETE FROM ${TB_CREDIT} WHERE customer_id = $1`,
    [id]
  );
  return { ok: result.rowCount > 0 };
}

export default removeByCustomerId;
