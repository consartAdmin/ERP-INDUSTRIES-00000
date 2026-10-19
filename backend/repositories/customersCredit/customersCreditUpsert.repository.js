// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCreditUpsert.repository.js — upsertByCustomerId           ║
// ║ Tabela: public."customersCredit"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CREDIT, TB_CUSTOMERS } from './customersCredit.constants.js';
import { toCustomerId, toMoney, toBool } from './customersCredit.sanitizers.js';
import { getByCustomerId } from './customersCreditQuery.repository.js';

export async function upsertByCustomerId(customerId, payload = {}) {
  const id = toCustomerId(customerId);
  if (payload.credit_limit === undefined) throw new Error('credit_limit is required');

  const creditLimit = toMoney(payload.credit_limit, 'credit_limit');
  const allowCredit = toBool(payload.allow_credit, true);
  const notes = String(payload.notes ?? '').trim() || null;

  const customerResult = await pool.query(
    `SELECT customer_id FROM ${TB_CUSTOMERS} WHERE customer_id = $1`,
    [id]
  );
  if (!customerResult.rowCount) return null;

  await pool.query(
    `INSERT INTO ${TB_CREDIT}
       (customer_id, credit_limit, allow_credit, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (customer_id)
     DO UPDATE SET
       credit_limit = EXCLUDED.credit_limit,
       allow_credit = EXCLUDED.allow_credit,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [id, creditLimit, allowCredit, notes]
  );

  return getByCustomerId(id);
}

export default upsertByCustomerId;
