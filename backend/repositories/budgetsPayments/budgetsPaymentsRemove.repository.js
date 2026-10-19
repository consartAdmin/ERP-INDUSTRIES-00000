// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsRemove.repository.js — remove / removeByBudget        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  PK,
  quoteIdent,
  TB_PAYMENTS,
} from './budgetsPayments.constants.js';
import {
  toInt,
} from './budgetsPayments.sanitizers.js';
import {
  getById,
  listByBudget,
} from './budgetsPaymentsQuery.repository.js';

export async function remove(id) {
  const budgetPaymentId = toInt(id);
  if (!budgetPaymentId) {
    throw new Error('budget_payment_id inválido.');
  }

  const current = await getById(budgetPaymentId);
  if (!current) return null;

  await pool.query(
    `DELETE FROM ${TB_PAYMENTS} WHERE ${quoteIdent(PK)} = $1`,
    [budgetPaymentId]
  );

  return current;
}

export async function removeByBudget(budgetId) {
  const safeBudgetId = toInt(budgetId);
  if (!safeBudgetId) {
    throw new Error('budget_id inválido.');
  }

  const rows = await listByBudget(safeBudgetId);

  await pool.query(
    `DELETE FROM ${TB_PAYMENTS} WHERE budget_id = $1`,
    [safeBudgetId]
  );

  return {
    budget_id: safeBudgetId,
    deleted_count: rows.length,
    rows
  };
}
