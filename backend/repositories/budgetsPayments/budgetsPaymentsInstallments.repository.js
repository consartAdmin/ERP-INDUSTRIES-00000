// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsInstallments.repository.js — regeneração de parcelas  ║
// ║ regenerateInstallmentsFromPayment / FromBudget                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import budgetsPaymentInstallmentsApi from '../budgetsPaymentInstallments/budgetsPaymentInstallments.index.js';
import {
  toInt,
} from './budgetsPayments.sanitizers.js';

export async function regenerateInstallmentsFromPayment(id) {
  const budgetPaymentId = toInt(id);
  if (!budgetPaymentId) {
    throw new Error('budget_payment_id inválido.');
  }

  return budgetsPaymentInstallmentsApi.generateFromBudgetPayment(budgetPaymentId);
}

export async function regenerateInstallmentsFromBudget(budgetId) {
  const safeBudgetId = toInt(budgetId);
  if (!safeBudgetId) {
    throw new Error('budget_id inválido.');
  }

  return budgetsPaymentInstallmentsApi.generateFromBudget(safeBudgetId);
}
