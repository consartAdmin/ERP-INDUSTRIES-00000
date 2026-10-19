// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtPaymentsUpdate.repository.js — updatePayment                   ║
// ║ Edita pagamento, atualiza a SAÍDA no caixa e recalcula a dívida    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DEBTS, TB_PAYMENTS } from './debtPayments.constants.js';
import { roundMoney, safeText, normalizeDate } from './debtPayments.utils.js';
import { recalcDebtById } from './debtPaymentsRecalc.repository.js';
import {
  ensureDebtPaymentCashColumn,
  updateDebtPaymentCashMovement
} from './debtPaymentsCashMovement.repository.js';

export async function updatePayment(id, payload = {}) {
  const paymentId = Number(id);

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new Error('ID do pagamento inválido.');
  }

  const paymentDate = normalizeDate(payload.payment_date || payload.paymentDate);

  if (!paymentDate) {
    throw new Error('payment_date é obrigatório e deve ser válido.');
  }

  const amount = roundMoney(payload.amount);

  if (amount <= 0) {
    throw new Error('O valor do pagamento deve ser maior que zero.');
  }

  const interestAmount = roundMoney(payload.interest_amount);
  const fineAmount = roundMoney(payload.fine_amount);
  const discountAmount = roundMoney(payload.discount_amount);
  const paymentMethod = safeText(payload.payment_method || payload.paymentMethod, 50);
  const receiptNumber = safeText(payload.receipt_number || payload.receiptNumber, 80);
  const notes = safeText(payload.notes, 5000);

  // Fora da transação: o DDL não pode esperar pelos locks dela
  await ensureDebtPaymentCashColumn();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updRes = await client.query(
      `
        UPDATE ${TB_PAYMENTS} SET
          payment_date = $2,
          amount = $3,
          interest_amount = $4,
          fine_amount = $5,
          discount_amount = $6,
          payment_method = $7,
          receipt_number = $8,
          notes = $9
        WHERE id = $1
        RETURNING
          id,
          debt_id,
          installment_number,
          installment_due_date,
          payment_date,
          amount,
          interest_amount,
          fine_amount,
          discount_amount,
          payment_method,
          receipt_number,
          notes,
          created_at,
          ROUND((amount + interest_amount + fine_amount - discount_amount)::numeric, 2) AS effective_amount
      `,
      [
        paymentId,
        paymentDate,
        amount,
        interestAmount,
        fineAmount,
        discountAmount,
        paymentMethod,
        receiptNumber,
        notes
      ]
    );

    if (!updRes.rows.length) {
      throw new Error('Pagamento não encontrado.');
    }

    const payment = updRes.rows[0];

    const debtRes = await client.query(
      `
        SELECT
          id,
          code,
          description,
          creditor_name,
          document_number,
          reference_number,
          installment_total
        FROM ${TB_DEBTS}
        WHERE id = $1
        LIMIT 1
      `,
      [payment.debt_id]
    );

    if (!debtRes.rows.length) {
      throw new Error('Dívida não encontrada.');
    }

    // A SAÍDA do caixa acompanha a edição (mesma movimentação, anexos mantidos)
    const cashMovement = await updateDebtPaymentCashMovement(client, {
      payment,
      debt: debtRes.rows[0],
      cash: payload.cash || {}
    });

    const updatedDebt = await recalcDebtById(client, payment.debt_id);

    await client.query('COMMIT');

    return {
      payment: { ...payment, cash_movement_id: cashMovement.id },
      cash_movement_id: cashMovement.id,
      debt: updatedDebt
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
