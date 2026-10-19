// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsQuery.repository.js — getById / listByBudget          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  PK,
  quoteIdent,
} from './budgetsPayments.constants.js';
import {
  SELECT_PAYMENTS_SQL,
  PAYMENT_ORDER_BY,
} from './budgetsPayments.sql.js';
import {
  toInt,
} from './budgetsPayments.sanitizers.js';
import {
  mapRow,
} from './budgetsPayments.mappers.js';

/* ──────────────────────────────────────────────────────────────────────
 * API pública
 * ──────────────────────────────────────────────────────────────────── */

export async function getById(id) {
  const budgetPaymentId = toInt(id);
  if (!budgetPaymentId) {
    throw new Error('budget_payment_id inválido.');
  }

  const sql = `
    ${SELECT_PAYMENTS_SQL}
    WHERE bp.${quoteIdent(PK)} = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [budgetPaymentId]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listByBudget(budgetId) {
  const safeBudgetId = toInt(budgetId);
  if (!safeBudgetId) {
    throw new Error('budget_id inválido.');
  }

  const sql = `
    ${SELECT_PAYMENTS_SQL}
    WHERE bp.budget_id = $1
    ORDER BY ${PAYMENT_ORDER_BY}
  `;

  const { rows } = await pool.query(sql, [safeBudgetId]);
  return rows.map(mapRow);
}
