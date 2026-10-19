// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsCreate.repository.js — create              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  DEFAULT_PAID_AMOUNT,
} from './budgetsPaymentInstallments.constants.js';
import {
  toInt,
  round2,
  normalizeStatus,
  normalizeNotes,
  toTimestamp,
} from './budgetsPaymentInstallments.sanitizers.js';
import {
  toDateOnly,
} from './budgetsPaymentInstallments.utils.js';
import {
  insertInstallment,
} from './budgetsPaymentInstallmentsPersist.repository.js';
import {
  getById,
} from './budgetsPaymentInstallmentsQuery.repository.js';

export async function create(payload = {}) {
  const record = {
    budget_payment_id: toInt(payload.budget_payment_id),
    budget_id: toInt(payload.budget_id),
    installment_number: toInt(payload.installment_number),
    due_date: toDateOnly(payload.due_date),
    amount: round2(payload.amount),
    status: normalizeStatus(payload.status),
    paid_amount: round2(payload.paid_amount ?? DEFAULT_PAID_AMOUNT),
    paid_at: toTimestamp(payload.paid_at, 'paid_at'),
    notes: normalizeNotes(payload.notes)
  };

  if (!record.budget_payment_id) throw new Error('budget_payment_id é obrigatório.');
  if (!record.budget_id) throw new Error('budget_id é obrigatório.');
  if (!record.installment_number || record.installment_number < 1) {
    throw new Error('installment_number inválido.');
  }

  const installmentId = await insertInstallment(pool, record);
  return getById(installmentId);
}
