// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtsRemove.repository.js — remove                                 ║
// ║ Bloqueia se houver pagamentos ou parcelas vinculadas               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DEBTS, TB_PAYMENTS } from './debts.constants.js';
import { getById } from './debtsQuery.repository.js';

export async function remove(id) {
  const current = await getById(id);
  if (!current) throw new Error('Dívida não encontrada.');

  const payRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM ${TB_PAYMENTS}
      WHERE debt_id = $1
    `,
    [id]
  );

  const paymentsCount = payRes.rows[0]?.total || 0;

  if (paymentsCount > 0) {
    throw new Error('Não é possível excluir a dívida porque existem pagamentos vinculados.');
  }

  const childRes = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM ${TB_DEBTS}
      WHERE parent_debt_id = $1
    `,
    [id]
  );

  const childrenCount = childRes.rows[0]?.total || 0;

  if (childrenCount > 0) {
    throw new Error('Não é possível excluir a dívida porque existem parcelas vinculadas.');
  }

  await pool.query(`DELETE FROM ${TB_DEBTS} WHERE id = $1`, [id]);

  return { deleted: true, id: Number(id) };
}
