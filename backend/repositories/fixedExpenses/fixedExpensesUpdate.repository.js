// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesUpdate.repository.js — update parcial                 ║
// ║ Tabela: "fixedExpenses"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './fixedExpenses.constants.js';
import { q } from './fixedExpenses.sql.js';
import { normalizePayload } from './fixedExpenses.sanitizers.js';
import { getById } from './fixedExpensesQuery.repository.js';

/** Update parcial */
export async function update(id, payloadIn = {}) {
  const sets = [];
  const params = [];
  let i = 0;

  if (payloadIn.customer_id !== undefined) {
    params.push(payloadIn.customer_id ? String(payloadIn.customer_id).trim() : null);
    sets.push(`customer_id = $${++i}::uuid`);
  }

  if (payloadIn.report_name !== undefined) {
    params.push(String(payloadIn.report_name ?? '').trim());
    sets.push(`report_name = $${++i}`);
  }

  if (payloadIn.payload !== undefined) {
    params.push(normalizePayload(payloadIn.payload));
    sets.push(`payload = $${++i}::jsonb`);
  }

  if (!sets.length) return getById(id);

  params.push(String(id).trim());
  const sql = `
    UPDATE ${TABLE}
       SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${++i}::uuid
     RETURNING id, customer_id, report_name, payload, created_at, updated_at
  `;

  const { rows } = await q(sql, params);
  return rows[0] || null;
}
