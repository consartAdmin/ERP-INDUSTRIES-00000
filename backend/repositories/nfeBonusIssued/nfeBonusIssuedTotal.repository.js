// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedTotal.repository.js — NF-e Bonificação                  ║
// ║ Recalcula o total da bonificação                                      ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BONUS, TB_BONUS_ITEMS } from './nfeBonusIssued.constants.js';
import { normalizePositiveInteger } from './nfeBonusIssued.sanitizers.js';

// ======================================================================
// RECALCULATE TOTAL
// ======================================================================

export async function recalculateBonusTotal(
  bonusId,
  {
    db = pool,
  } = {}
) {
  const id = normalizePositiveInteger(bonusId);

  if (!id) {
    return {
      ok: false,
      error: 'bonus_id inválido',
    };
  }

  const { rows } = await db.query(
    `
    UPDATE ${TB_BONUS} b
    SET
      total_amount = COALESCE(
        (
          SELECT SUM(i.total_value)
          FROM ${TB_BONUS_ITEMS} i
          WHERE i.bonus_id = b.bonus_id
        ),
        0
      ),
      updated_at = NOW()
    WHERE b.bonus_id = $1
    RETURNING *
    `,
    [id]
  );

  if (!rows.length) {
    return {
      ok: false,
      error: 'NOT_FOUND',
    };
  }

  return {
    ok: true,
    total_amount: Number(rows[0].total_amount || 0),
  };
}
