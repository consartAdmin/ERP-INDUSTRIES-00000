// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsValidate.repository.js — validateBudgetPaymentsTotal  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  toInt,
  round2,
} from './budgetsPayments.sanitizers.js';
import {
  getBudgetById,
  getExpectedBudgetTotal,
  getBudgetPaymentsSum,
} from './budgetsPaymentsLookup.repository.js';

export async function validateBudgetPaymentsTotal(budgetId) {
  const safeBudgetId = toInt(budgetId);
  if (!safeBudgetId) {
    throw new Error('budget_id inválido.');
  }

  const client = await pool.connect();

  try {
    const budget = await getBudgetById(client, safeBudgetId);
    if (!budget) {
      throw new Error('Budget não encontrado.');
    }

    const expected = await getExpectedBudgetTotal(client, safeBudgetId);
    const paymentsTotal = await getBudgetPaymentsSum(client, safeBudgetId);

    return {
      budget_id: safeBudgetId,
      items_total: expected?.items_total ?? 0,
      freight_value: expected?.freight_value ?? 0,
      expected_total: expected?.expected_total ?? 0,
      payments_total: paymentsTotal,
      difference: round2(paymentsTotal - (expected?.expected_total ?? 0)),
      is_balanced: round2(paymentsTotal) === round2(expected?.expected_total ?? 0)
    };
  } finally {
    client.release();
  }
}
