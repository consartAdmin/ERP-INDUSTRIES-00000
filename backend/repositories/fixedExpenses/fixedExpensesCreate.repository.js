// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesCreate.repository.js — create / upsert                ║
// ║ Tabela: "fixedExpenses"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './fixedExpenses.constants.js';
import { q } from './fixedExpenses.sql.js';
import { normalizePayload } from './fixedExpenses.sanitizers.js';

/** Create */
export async function create(payloadIn) {
  const { customer_id, report_name, payload } = payloadIn || {};
  if (!report_name) throw new Error('report_name é obrigatório');

  const cust = customer_id ? String(customer_id).trim() : null;
  const jsonb = normalizePayload(payload);

  const { rows } = await q(
    `INSERT INTO ${TABLE} (customer_id, report_name, payload)
     VALUES ($1::uuid, $2, $3::jsonb)
     RETURNING id, customer_id, report_name, payload, created_at, updated_at`,
    [cust, report_name, jsonb],
  );

  return rows[0];
}

/** Upsert por (customer_id, report_name) */
export async function upsertByCustomerAndReport({ customer_id, report_name, payload }) {
  const cust = customer_id ? String(customer_id).trim() : null;
  if (!cust) throw new Error('customer_id é obrigatório');
  if (!report_name) throw new Error('report_name é obrigatório');

  const jsonb = normalizePayload(payload);

  const { rows } = await q(
    `INSERT INTO ${TABLE} (customer_id, report_name, payload)
     VALUES ($1::uuid, $2, $3::jsonb)
     ON CONFLICT (customer_id, report_name) DO UPDATE
       SET payload = EXCLUDED.payload,
           updated_at = NOW()
     RETURNING id, customer_id, report_name, payload, created_at, updated_at`,
    [cust, report_name, jsonb],
  );

  return rows[0];
}
