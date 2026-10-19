// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtsRecalc.repository.js — recalcDebtById                         ║
// ║ Recalcula updated/paid/open/status a partir dos pagamentos         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DEBTS, TB_PAYMENTS } from './debts.constants.js';
import {
  roundMoney,
  computeUpdatedAmount,
  computeOpenAmount,
  computeStatus
} from './debts.utils.js';

export async function recalcDebtById(debtId, client = pool) {
  const debtRes = await client.query(
    `
      SELECT
        id,
        due_date,
        original_amount,
        interest_amount,
        fine_amount,
        discount_amount
      FROM ${TB_DEBTS}
      WHERE id = $1
      LIMIT 1
    `,
    [debtId]
  );

  if (!debtRes.rows.length) {
    throw new Error('Dívida não encontrada.');
  }

  const debt = debtRes.rows[0];

  const payRes = await client.query(
    `
      SELECT
        COALESCE(SUM(amount + interest_amount + fine_amount - discount_amount), 0) AS total_paid_effective
      FROM ${TB_PAYMENTS}
      WHERE debt_id = $1
    `,
    [debtId]
  );

  const paidAmount = roundMoney(payRes.rows[0]?.total_paid_effective || 0);
  const updatedAmount = computeUpdatedAmount(debt);
  const openAmount = computeOpenAmount(updatedAmount, paidAmount);

  const status = computeStatus({
    due_date: debt.due_date,
    paid_amount: paidAmount,
    open_amount: openAmount
  });

  const updRes = await client.query(
    `
      UPDATE ${TB_DEBTS}
      SET
        updated_amount = $2,
        paid_amount = $3,
        open_amount = $4,
        status = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [debtId, updatedAmount, paidAmount, openAmount, status]
  );

  return updRes.rows[0];
}
