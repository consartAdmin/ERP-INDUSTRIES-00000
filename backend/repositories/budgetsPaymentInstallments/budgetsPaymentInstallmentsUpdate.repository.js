// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsUpdate.repository.js — update              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
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
  updateInstallment,
} from './budgetsPaymentInstallmentsPersist.repository.js';
import {
  getById,
} from './budgetsPaymentInstallmentsQuery.repository.js';

export async function update(id, payload = {}) {
  const installmentId = toInt(id);
  if (!installmentId) throw new Error('ID da parcela inválido.');

  const current = await getById(installmentId);
  if (!current) return null;

  const next = {
    due_date: payload.due_date !== undefined ? toDateOnly(payload.due_date) : current.due_date,
    amount: payload.amount !== undefined ? round2(payload.amount) : current.amount,
    status: payload.status !== undefined ? normalizeStatus(payload.status, current.status) : current.status,
    paid_amount: payload.paid_amount !== undefined ? round2(payload.paid_amount) : current.paid_amount,
    paid_at: payload.paid_at !== undefined ? toTimestamp(payload.paid_at, 'paid_at') : current.paid_at,
    notes: payload.notes !== undefined ? normalizeNotes(payload.notes) : current.notes
  };

  await updateInstallment(pool, installmentId, next);

  return getById(installmentId);
}
