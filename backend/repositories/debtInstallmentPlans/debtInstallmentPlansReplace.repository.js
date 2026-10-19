// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtInstallmentPlansReplace.repository.js — replaceByDebtId        ║
// ║ Substitui todas as faixas de uma dívida (transação)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_DEBTS } from './debtInstallmentPlans.constants.js';
import { toNumber } from './debtInstallmentPlans.utils.js';

export async function replaceByDebtId(debtId, rows = []) {
  if (!Array.isArray(rows)) {
    throw new Error('Lista de faixas inválida.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const debtRes = await client.query(
      `SELECT id, installment_total FROM ${TB_DEBTS} WHERE id = $1 LIMIT 1`,
      [debtId]
    );

    if (!debtRes.rows.length) {
      throw new Error('Dívida não encontrada.');
    }

    const installmentTotal = Number(debtRes.rows[0].installment_total || 0);

    await client.query(`DELETE FROM ${TB} WHERE debt_id = $1`, [debtId]);

    const created = [];

    for (const item of rows) {
      const start = toNumber(item.start_installment);
      const end = toNumber(item.end_installment);
      const amount = toNumber(item.installment_amount);

      if (!Number.isInteger(start) || start <= 0) {
        throw new Error('Parcela inicial inválida.');
      }

      if (!Number.isInteger(end) || end < start) {
        throw new Error('Parcela final inválida.');
      }

      if (installmentTotal > 0 && end > installmentTotal) {
        throw new Error('Faixa maior que a quantidade total de parcelas.');
      }

      if (amount <= 0) {
        throw new Error('Valor da parcela deve ser maior que zero.');
      }

      const res = await client.query(
        `
          INSERT INTO ${TB} (
            debt_id,
            start_installment,
            end_installment,
            installment_amount,
            created_at
          )
          VALUES ($1,$2,$3,$4,NOW())
          RETURNING *
        `,
        [debtId, start, end, amount]
      );

      created.push(res.rows[0]);
    }

    await client.query('COMMIT');

    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
