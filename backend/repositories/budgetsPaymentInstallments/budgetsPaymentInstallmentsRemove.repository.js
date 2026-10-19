// ╔═════════════════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsRemove.repository.js — remove / removeByBudgetPayment ║
// ╚═════════════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_INSTALLMENTS,
  Q_PK,
  Q_PAYMENT_FK,
} from './budgetsPaymentInstallments.constants.js';
import {
  toInt,
} from './budgetsPaymentInstallments.sanitizers.js';
import {
  getById,
  listByBudgetPayment,
} from './budgetsPaymentInstallmentsQuery.repository.js';

export async function remove(id) {
  const installmentId = toInt(id);
  if (!installmentId) throw new Error('ID da parcela inválido.');

  const current = await getById(installmentId);
  if (!current) return null;

  await pool.query(
    `DELETE FROM ${TB_INSTALLMENTS} WHERE ${Q_PK} = $1`,
    [installmentId]
  );

  return current;
}

export async function removeByBudgetPayment(budgetPaymentId) {
  const safeBudgetPaymentId = toInt(budgetPaymentId);
  if (!safeBudgetPaymentId) throw new Error('budget_payment_id inválido.');

  const deleted = await listByBudgetPayment(safeBudgetPaymentId);

  await pool.query(
    `DELETE FROM ${TB_INSTALLMENTS} WHERE ${Q_PAYMENT_FK} = $1`,
    [safeBudgetPaymentId]
  );

  return {
    deleted_count: deleted.length,
    rows: deleted
  };
}
