// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtInstallmentPlansQuery.repository.js — listByDebtId             ║
// ║ Tabela: public.debt_installment_plans                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './debtInstallmentPlans.constants.js';

export async function listByDebtId(debtId) {
  const res = await pool.query(
    `
      SELECT id, debt_id, start_installment, end_installment, installment_amount, created_at
      FROM ${TB}
      WHERE debt_id = $1
      ORDER BY start_installment ASC, end_installment ASC
    `,
    [debtId]
  );

  return res.rows;
}
