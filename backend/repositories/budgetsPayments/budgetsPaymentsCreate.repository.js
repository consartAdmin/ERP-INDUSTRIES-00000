// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsCreate.repository.js — create                         ║
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
  getBudgetById,
  getPaymentMethodById,
  resolveBankAccount,
} from './budgetsPaymentsLookup.repository.js';
import {
  buildPaymentRecord,
  insertPayment,
} from './budgetsPaymentsPersist.repository.js';
import {
  getById,
} from './budgetsPaymentsQuery.repository.js';

export async function create(payload = {}, options = {}) {
  const budgetId = toInt(payload.budget_id);
  const paymentMethodId = toInt(payload.payment_method_id);
  const amount = round2(payload.amount);
  const notes = normalizeText(payload.notes);
  const manualDueDate = normalizeIsoDate(payload.manual_due_date);

  const requestedBankAccountId = toInt(
    payload.bank_account_id
  );

  const autoGenerateInstallments = Boolean(
    payload.auto_generate_installments ?? options.auto_generate_installments ?? false
  );

  if (!budgetId) throw new Error('budget_id é obrigatório.');
  if (!paymentMethodId) throw new Error('payment_method_id é obrigatório.');
  if (amount < 0) throw new Error('amount não pode ser negativo.');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const budget = await getBudgetById(client, budgetId);
    if (!budget) {
      throw new Error('Budget não encontrado.');
    }

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

    const budgetPaymentId = await insertPayment(
      client,
      buildPaymentRecord({
        budgetId,
        paymentMethodId,
        bankAccount,
        amount,
        notes,
        manualDueDate
      })
    );

    if (autoGenerateInstallments) {
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
