// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtPaymentsQuery.repository.js — listByDebtId / getById /         ║
// ║ getSummaryByDebtId · Tabela: public.debt_payments                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PAYMENTS } from './debtPayments.constants.js';

export async function listByDebtId(debtId) {
  const res = await pool.query(
    `
      SELECT
        id,
        debt_id,
        installment_number,
        installment_due_date,
        payment_date,
        amount,
        interest_amount,
        fine_amount,
        discount_amount,
        payment_method,
        receipt_number,
        notes,
        created_at,
        ROUND((amount + interest_amount + fine_amount - discount_amount)::numeric, 2) AS effective_amount
      FROM ${TB_PAYMENTS}
      WHERE debt_id = $1
      ORDER BY
        installment_number ASC NULLS LAST,
        installment_due_date ASC NULLS LAST,
        payment_date DESC,
        id DESC
    `,
    [debtId]
  );

  return res.rows;
}

export async function getById(id) {
  const res = await pool.query(
    `
      SELECT
        id,
        debt_id,
        installment_number,
        installment_due_date,
        payment_date,
        amount,
        interest_amount,
        fine_amount,
        discount_amount,
        payment_method,
        receipt_number,
        notes,
        created_at,
        ROUND((amount + interest_amount + fine_amount - discount_amount)::numeric, 2) AS effective_amount
      FROM ${TB_PAYMENTS}
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return res.rows[0] || null;
}

export async function getSummaryByDebtId(debtId) {
  const res = await pool.query(
    `
      SELECT
        debt_id,
        COUNT(*)::int AS payments_count,
        COALESCE(SUM(amount), 0)::numeric(14,2) AS principal_paid,
        COALESCE(SUM(interest_amount), 0)::numeric(14,2) AS interest_paid,
        COALESCE(SUM(fine_amount), 0)::numeric(14,2) AS fine_paid,
        COALESCE(SUM(discount_amount), 0)::numeric(14,2) AS discount_paid,
        COALESCE(SUM(amount + interest_amount + fine_amount - discount_amount), 0)::numeric(14,2) AS effective_paid
      FROM ${TB_PAYMENTS}
      WHERE debt_id = $1
      GROUP BY debt_id
    `,
    [debtId]
  );

  if (!res.rows.length) {
    return {
      debt_id: Number(debtId),
      payments_count: 0,
      principal_paid: 0,
      interest_paid: 0,
      fine_paid: 0,
      discount_paid: 0,
      effective_paid: 0
    };
  }

  return res.rows[0];
}
