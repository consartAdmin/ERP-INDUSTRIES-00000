// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsUpdate.repository.js — update                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import budgetsPaymentInstallmentsApi from '../budgetsPaymentInstallments/budgetsPaymentInstallments.index.js';
import {
  toInt,
  round2,
  normalizeText,
  normalizeIsoDate,
} from './budgetsPayments.sanitizers.js';
import {
  getPaymentMethodById,
  resolveBankAccount,
} from './budgetsPaymentsLookup.repository.js';
import {
  buildPaymentRecord,
  updatePayment,
} from './budgetsPaymentsPersist.repository.js';
import {
  getById,
} from './budgetsPaymentsQuery.repository.js';

export async function update(id, payload = {}, options = {}) {
  const budgetPaymentId = toInt(id);
  if (!budgetPaymentId) {
    throw new Error('budget_payment_id inválido.');
  }

  const current = await getById(budgetPaymentId);
  if (!current) return null;

  const paymentMethodId = payload.payment_method_id !== undefined
    ? toInt(payload.payment_method_id)
    : current.payment_method_id;

  const amount = payload.amount !== undefined
    ? round2(payload.amount)
    : current.amount;

  const notes = payload.notes !== undefined
    ? normalizeText(payload.notes)
    : current.notes;

  const manualDueDate = payload.manual_due_date !== undefined
    ? normalizeIsoDate(payload.manual_due_date)
    : current.manual_due_date;

  const requestedBankAccountId =
    payload.bank_account_id !== undefined
      ? toInt(payload.bank_account_id)
      : current.bank_account_id;

  const regenerateInstallments = Boolean(
    payload.regenerate_installments ?? options.regenerate_installments ?? false
  );

  if (!paymentMethodId) throw new Error('payment_method_id inválido.');
  if (amount < 0) throw new Error('amount não pode ser negativo.');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const method = await getPaymentMethodById(client, paymentMethodId);
    if (!method) {
      throw new Error('Forma de pagamento não encontrada.');
    }

    if (method.active === false) {
      throw new Error('A forma de pagamento informada está inativa.');
    }

    const bankAccount = await resolveBankAccount(
      client,
      requestedBankAccountId
    );

    await updatePayment(
      client,
      budgetPaymentId,
      buildPaymentRecord({
        budgetId: current.budget_id,
        paymentMethodId,
        bankAccount,
        amount,
        notes,
        manualDueDate
      })
    );

    if (regenerateInstallments) {
      await budgetsPaymentInstallmentsApi.generateFromBudgetPayment(budgetPaymentId, { client });
    }

    await client.query('COMMIT');

    return getById(budgetPaymentId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
