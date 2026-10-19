// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ createInstallment.repository.js — CONSART ERP | Notas de Entrada        ║
// ║ Insere uma parcela, normalizando status e valor pago                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_II_INSTALLMENTS,
  q,
  toNum,
  installmentResponse,
} from './_shared.js';

export async function createInstallment(payload) {
  const installmentNumber = Number(payload.installment_number);
  if (!Number.isInteger(installmentNumber) || installmentNumber <= 0) {
    const error = new Error('installment_number deve ser um inteiro maior que zero.');
    error.code = 'INVALID_INSTALLMENT_NUMBER';
    throw error;
  }

  const isPaid = payload.is_paid === true || String(payload.status || '').toUpperCase() === 'PAID';
  const amount = toNum(payload.amount, 0);
  const paidAmount = payload.paid_amount == null
    ? (isPaid ? amount : 0)
    : toNum(payload.paid_amount, 0);

  const res = await q(
    `
      INSERT INTO ${TB_II_INSTALLMENTS}
      (
        inbound_id,
        installment_number,
        installment_code,
        due_date,
        original_due_date,
        amount,
        paid_amount,
        status,
        is_paid,
        paid_at,
        accounts_payable_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `,
    [
      payload.inbound_id,
      installmentNumber,
      String(payload.installment_code || installmentNumber).padStart(3, '0'),
      payload.due_date,
      payload.original_due_date ?? payload.due_date,
      amount,
      paidAmount,
      payload.status ?? (isPaid ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING')),
      isPaid,
      payload.paid_at ?? null,
      payload.accounts_payable_id ?? null,
    ]
  );

  return installmentResponse(res.rows[0]);
}

export default createInstallment;
