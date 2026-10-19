// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalanceCalculate.repository.js — calculateBalance      ║
// ║ Saldo em D = última conferência <= D + ENTRADAS − SAÍDAS ativas    ║
// ║ de "cashMoviments" entre (balance_date + 1) e (D + 1).             ║
// ║ Sem conferência anterior → saldo desconhecido (null).              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_CASH } from './bankAccountsBalance.constants.js';
import { MOVEMENT_TOTAL_SQL, MOVEMENT_TYPE_SQL, SIGNED_MOVEMENT_SQL } from './bankAccountsBalance.sql.js';
import { requireId, isoDate } from './bankAccountsBalance.sanitizers.js';

/**
 * Saldo calculado pelo ERP no FIM do dia `date`.
 * @param {object} opts
 * @param {boolean} [opts.beforeDate=false] usa apenas conferências ANTERIORES
 *   a `date` (para calcular system_balance ao conferir a própria data)
 * @param {number} [opts.excludeId] ignora esta conferência (edição)
 */
export async function calculateBalance(
  bankAccountId,
  date,
  { beforeDate = false, excludeId = null, db = pool } = {}
) {
  const accountId = requireId(bankAccountId, 'Conta bancária');
  const day = isoDate(date);

  const { rows: cpRows } = await db.query(
    `
    SELECT id, to_char(balance_date, 'YYYY-MM-DD') AS balance_date, balance
    FROM ${TB}
    WHERE bank_account_id = $1
      AND ${beforeDate ? 'balance_date < $2::date' : 'balance_date <= $2::date'}
      AND ($3::bigint IS NULL OR id <> $3::bigint)
    ORDER BY balance_date DESC
    LIMIT 1
    `,
    [accountId, day, excludeId]
  );
  const checkpoint = cpRows[0] || null;

  if (!checkpoint) {
    return {
      bank_account_id: accountId,
      date: day,
      balance: null,
      base_checkpoint: null,
      entradas: 0,
      saidas: 0,
      movements: 0,
    };
  }

  const { rows } = await db.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN ${MOVEMENT_TYPE_SQL} LIKE 'ENTR%' THEN ${MOVEMENT_TOTAL_SQL} END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN ${MOVEMENT_TYPE_SQL} LIKE 'SAID%' THEN ${MOVEMENT_TOTAL_SQL} END), 0) AS saidas,
      COALESCE(SUM(${SIGNED_MOVEMENT_SQL}), 0) AS net,
      COUNT(*) AS movements
    FROM ${TB_CASH} m
    WHERE m.bank_account_id = $1
      AND m.is_active = TRUE
      AND m.movement_date >= ($2::date + 1)
      AND m.movement_date <  ($3::date + 1)
    `,
    [accountId, checkpoint.balance_date, day]
  );
  const mv = rows[0];

  return {
    bank_account_id: accountId,
    date: day,
    balance: Math.round((Number(checkpoint.balance) + Number(mv.net)) * 100) / 100,
    base_checkpoint: {
      id: Number(checkpoint.id),
      balance_date: checkpoint.balance_date,
      balance: Number(checkpoint.balance),
    },
    entradas: Number(mv.entradas),
    saidas: Number(mv.saidas),
    movements: Number(mv.movements),
  };
}
