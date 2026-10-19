// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtPaymentsRecalc.repository.js — recalcDebtById (interno)        ║
// ║ Sincroniza paid/open/status da dívida a partir dos pagamentos      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_DEBTS, TB_PAYMENTS } from './debtPayments.constants.js';
import { roundMoney, buildStatusFromDebt } from './debtPayments.utils.js';

export async function recalcDebtById(client, debtId) {
  const debtRes = await client.query(
    `
      SELECT
        id,
        due_date,
        original_amount,
        interest_amount,
        fine_amount,
        discount_amount,
        paid_amount,
        open_amount
      FROM ${TB_DEBTS}
      WHERE id = $1
      LIMIT 1
    `,
    [debtId]
  );

  if (!debtRes.rows.length) {
    throw new Error('Dívida não encontrada para recálculo.');
  }

  const debt = debtRes.rows[0];

  const payRes = await client.query(
    `
      SELECT
        COALESCE(SUM(amount), 0) AS principal_paid,
        COALESCE(SUM(interest_amount), 0) AS interest_paid,
        COALESCE(SUM(fine_amount), 0) AS fine_paid,
        COALESCE(SUM(discount_amount), 0) AS discount_paid,
        COALESCE(SUM(amount + interest_amount + fine_amount - discount_amount), 0) AS total_paid_effective
      FROM ${TB_PAYMENTS}
      WHERE debt_id = $1
    `,
    [debtId]
  );

  const sums = payRes.rows[0] || {};

  const originalAmount = roundMoney(debt.original_amount);
  const debtInterest = roundMoney(debt.interest_amount);
  const debtFine = roundMoney(debt.fine_amount);
  const debtDiscount = roundMoney(debt.discount_amount);

  const updatedAmount = roundMoney(originalAmount + debtInterest + debtFine - debtDiscount);
  const paidAmount = roundMoney(sums.total_paid_effective);
  const openAmount = roundMoney(Math.max(updatedAmount - paidAmount, 0));

  const status = buildStatusFromDebt({
    due_date: debt.due_date,
    updated_amount: updatedAmount,
    paid_amount: paidAmount,
    open_amount: openAmount
  });

  const updRes = await client.query(
    `
      UPDATE ${TB_DEBTS}
      SET
        paid_amount = $2,
        open_amount = $3,
        status = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [debtId, paidAmount, openAmount, status]
  );

  return updRes.rows[0];
}
