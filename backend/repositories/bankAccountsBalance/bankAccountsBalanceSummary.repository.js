// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalanceSummary.repository.js — getSummary              ║
// ║ Saldo atual por conta bancária + última conferência                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_BANK_ACCOUNTS } from './bankAccountsBalance.constants.js';
import { todayIso, num } from './bankAccountsBalance.utils.js';
import { calculateBalance } from './bankAccountsBalanceCalculate.repository.js';

/**
 * Resumo por conta bancária: saldo atual (inclui movimentações futuras
 * já lançadas até hoje) + última conferência.
 */
export async function getSummary({ active = 'true' } = {}) {
  const params = [];
  let where = '';
  if (active !== undefined && active !== null && active !== '') {
    params.push(String(active).toLowerCase() !== 'false');
    where = `WHERE ba.is_active = $${params.length}`;
  }

  const { rows: accounts } = await pool.query(
    `
    SELECT
      ba.id, ba.name, ba.integration_provider, ba.is_default, ba.is_active,
      last.id AS last_checkpoint_id,
      to_char(last.balance_date, 'YYYY-MM-DD') AS last_checkpoint_date,
      last.balance AS last_checkpoint_balance,
      last.difference AS last_checkpoint_difference,
      (SELECT COUNT(*) FROM ${TB} x WHERE x.bank_account_id = ba.id) AS checkpoints
    FROM ${TB_BANK_ACCOUNTS} ba
    LEFT JOIN LATERAL (
      SELECT bb.id, bb.balance_date, bb.balance, bb.difference
      FROM ${TB} bb
      WHERE bb.bank_account_id = ba.id
      ORDER BY bb.balance_date DESC
      LIMIT 1
    ) last ON TRUE
    ${where}
    ORDER BY ba.is_default DESC, ba.name ASC, ba.id ASC
    `,
    params
  );

  const today = todayIso();
  const items = [];
  for (const acc of accounts) {
    const calc = await calculateBalance(acc.id, today);
    items.push({
      bank_account_id: Number(acc.id),
      name: acc.name,
      integration_provider: acc.integration_provider,
      is_default: acc.is_default,
      is_active: acc.is_active,
      current_balance: calc.balance,
      entradas_since_checkpoint: calc.entradas,
      saidas_since_checkpoint: calc.saidas,
      movements_since_checkpoint: calc.movements,
      checkpoints: Number(acc.checkpoints),
      last_checkpoint: acc.last_checkpoint_id
        ? {
          id: Number(acc.last_checkpoint_id),
          balance_date: acc.last_checkpoint_date,
          balance: num(acc.last_checkpoint_balance),
          difference: num(acc.last_checkpoint_difference),
        }
        : null,
    });
  }

  const known = items.filter((i) => i.current_balance !== null);
  return {
    date: today,
    items,
    total_balance: Math.round(known.reduce((s, i) => s + i.current_balance, 0) * 100) / 100,
    accounts_without_checkpoint: items.length - known.length,
  };
}
