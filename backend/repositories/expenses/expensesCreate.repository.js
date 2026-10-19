// ╔════════════════════════════════════════════════════════════════════╗
// ║ expensesCreate.repository.js — createExpense (+ geração do ID)     ║
// ║ Tabela: public."Expenses" · Seq: public.expense_id_seq             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './expenses.constants.js';
import { sanitizeExpensePayload } from './expenses.sanitizers.js';

async function generateExpenseId(client) {
  // Format: EXP-YYYYMM-000001
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  const { rows } = await client.query(`SELECT nextval('public.expense_id_seq') AS n;`);
  const seq = String(rows[0].n).padStart(6, '0');

  return `EXP-${y}${m}-${seq}`;
}

export async function createExpense(body) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const d = sanitizeExpensePayload(body);

    // If user didn't send expense_id, generate
    if (!d.expense_id) {
      d.expense_id = await generateExpenseId(client);
    }

    const q = `
      INSERT INTO ${TB} (
        "expense_id",
        "name",
        "description",
        "value",
        "due_date",
        "competence_month",
        "competence_year",
        "category",
        "cost_center",
        "vendor",
        "recurrence_type",
        "status",
        "paid_date",
        "payment_method",
        "account_payable_id",
        "payload",
        "is_active"
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,
        $8,$9,$10,
        $11,$12,
        $13,$14,
        $15,$16,$17
      )
      RETURNING "id", "expense_id";
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
    ];

    const { rows } = await client.query(q, params);

    await client.query('COMMIT');
    return rows[0];

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
