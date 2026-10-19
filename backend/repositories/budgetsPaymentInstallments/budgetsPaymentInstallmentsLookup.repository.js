// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsLookup.repository.js — leituras internas   ║
// ║ fetchById / fetchByBudgetPayment / getBudgetPaymentSource            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TB_BUDGETS,
  TB_BUDGETS_PAYMENTS,
  TB_PAYMENT_METHODS,
  Q_PK,
  Q_PAYMENT_FK,
  Q_PAYMENT_PK,
  Q_METHOD_FK,
  Q_METHOD_PK,
} from './budgetsPaymentInstallments.constants.js';
import {
  SELECT_INSTALLMENTS_SQL,
  ORDER_BY_PAYMENT,
} from './budgetsPaymentInstallments.sql.js';
import {
  mapInstallment,
} from './budgetsPaymentInstallments.mappers.js';

/* ──────────────────────────────────────────────────────────────────────
 * Leituras (aceitam pool ou client de transação)
 * ──────────────────────────────────────────────────────────────────── */

export async function fetchById(db, installmentId) {
  const sql = `
    ${SELECT_INSTALLMENTS_SQL}
    WHERE i.${Q_PK} = $1
    LIMIT 1
  `;

  const { rows } = await db.query(sql, [installmentId]);
  return rows[0] ? mapInstallment(rows[0]) : null;
}

export async function fetchByBudgetPayment(db, budgetPaymentId) {
  const sql = `
    ${SELECT_INSTALLMENTS_SQL}
    WHERE i.${Q_PAYMENT_FK} = $1
    ORDER BY ${ORDER_BY_PAYMENT}
  `;

  const { rows } = await db.query(sql, [budgetPaymentId]);
  return rows.map(mapInstallment);
}

export async function getBudgetPaymentSource(client, budgetPaymentId) {
  const sql = `
    SELECT
      bp.${Q_PAYMENT_PK} AS budget_payment_id,
      bp.budget_id,
      bp.${Q_METHOD_FK} AS payment_method_id,
      bp.amount,
      bp.notes,
      bp.manual_due_date,

      b.issue_date,
      b.status AS budget_status,

      pm.${Q_METHOD_PK} AS payment_method_id_ref,
      pm.name AS payment_method_name,
      pm.type AS payment_method_type,
      pm.installments,
      pm.gap_one,
      pm.gap_two,
      pm.gap_three,
      pm.gap_four,
      pm.gap_five,
      pm.gap_six,
      pm.gap_seven,
      pm.gap_eight,
      pm.gap_nine,
      pm.gap_ten,
      pm.active
    FROM ${TB_BUDGETS_PAYMENTS} bp
    LEFT JOIN ${TB_BUDGETS} b
      ON b.budget_id = bp.budget_id
    LEFT JOIN ${TB_PAYMENT_METHODS} pm
      ON pm.${Q_METHOD_PK} = bp.${Q_METHOD_FK}
    WHERE bp.${Q_PAYMENT_PK} = $1
    LIMIT 1
  `;

  const { rows } = await client.query(sql, [budgetPaymentId]);
  return rows[0] || null;
}
