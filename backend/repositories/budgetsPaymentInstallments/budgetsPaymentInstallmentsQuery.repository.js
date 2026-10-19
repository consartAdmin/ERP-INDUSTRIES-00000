// ╔════════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsQuery.repository.js — getById / listByBudget ║
// ║ listByBudgetPayment                                                    ║
// ╚════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  SELECT_INSTALLMENTS_SQL,
  ORDER_BY_BUDGET,
} from './budgetsPaymentInstallments.sql.js';
import {
  toInt,
} from './budgetsPaymentInstallments.sanitizers.js';
import {
  mapInstallment,
} from './budgetsPaymentInstallments.mappers.js';
import {
  fetchById,
  fetchByBudgetPayment,
} from './budgetsPaymentInstallmentsLookup.repository.js';

/* ──────────────────────────────────────────────────────────────────────
 * API pública
 * ──────────────────────────────────────────────────────────────────── */

export async function getById(id) {
  const installmentId = toInt(id);
  if (!installmentId) {
    throw new Error('ID da parcela inválido.');
  }

  return fetchById(pool, installmentId);
}

export async function listByBudget(budgetId) {
  const safeBudgetId = toInt(budgetId);
  if (!safeBudgetId) {
    throw new Error('budget_id inválido.');
  }

  const sql = `
    ${SELECT_INSTALLMENTS_SQL}
    WHERE i.budget_id = $1
    ORDER BY ${ORDER_BY_BUDGET}
  `;

  const { rows } = await pool.query(sql, [safeBudgetId]);
  return rows.map(mapInstallment);
}

export async function listByBudgetPayment(budgetPaymentId) {
  const safeBudgetPaymentId = toInt(budgetPaymentId);
  if (!safeBudgetPaymentId) {
    throw new Error('budget_payment_id inválido.');
  }

  return fetchByBudgetPayment(pool, safeBudgetPaymentId);
}
