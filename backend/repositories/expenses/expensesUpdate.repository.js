// ╔════════════════════════════════════════════════════════════════════╗
// ║ expensesUpdate.repository.js — updateExpense / patchExpenseStatus  ║
// ║ Tabela: public."Expenses"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './expenses.constants.js';
import { sanitizeExpensePayload } from './expenses.sanitizers.js';

export async function updateExpense(id, body) {
  const d = sanitizeExpensePayload(body);

  const q = `
    UPDATE ${TB}
    SET
      "expense_id" = $1,
      "name" = $2,
      "description" = $3,
      "value" = $4,
      "due_date" = $5,
      "competence_month" = $6,
      "competence_year" = $7,
      "category" = $8,
      "cost_center" = $9,
      "vendor" = $10,
      "recurrence_type" = $11,
      "status" = $12,
      "paid_date" = $13,
      "payment_method" = $14,
      "account_payable_id" = $15,
      "payload" = $16,
      "is_active" = $17
    WHERE "id" = $18
    RETURNING "id";
  `;

  const params = [
    d.expense_id,
    d.name,
    d.description,
    d.value,
    d.due_date,
    d.competence_month,
    d.competence_year,
    d.category,
    d.cost_center,
    d.vendor,
    String(d.recurrence_type).toUpperCase(),
    String(d.status).toUpperCase(),
    d.paid_date,
    d.payment_method,
    d.account_payable_id,
    d.payload,
    Boolean(d.is_active),
    id,
  ];

  const { rows } = await pool.query(q, params);
  return rows[0] || null;
}

export async function patchExpenseStatus(id, body = {}) {
  const status = String(body.status || '').trim().toUpperCase();
  const paid_date = body.paid_date ?? null;
  const payment_method = body.payment_method ?? null;

  const q = `
    UPDATE ${TB}
    SET
      "status" = $1,
      "paid_date" = $2,
      "payment_method" = $3
    WHERE "id" = $4
    RETURNING "id";
  `;
  const { rows } = await pool.query(q, [status, paid_date, payment_method, id]);
  return rows[0] || null;
}
