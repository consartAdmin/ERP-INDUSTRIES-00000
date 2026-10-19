// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtInstallmentPlansRemove.repository.js — removePlan              ║
// ║ Tabela: public.debt_installment_plans                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './debtInstallmentPlans.constants.js';

export async function removePlan(debtId, planId) {
  const res = await pool.query(
    `
      DELETE FROM ${TB}
      WHERE debt_id = $1 AND id = $2
      RETURNING id
    `,
    [debtId, planId]
  );

  return {
    deleted: !!res.rows.length,
    id: Number(planId)
  };
}
