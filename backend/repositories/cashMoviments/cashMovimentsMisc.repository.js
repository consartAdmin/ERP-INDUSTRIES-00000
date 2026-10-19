// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsMisc.repository.js — ping / plano de contas           ║
// ║ Tabela: "chartOfAccounts"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './cashMoviments.utils.js';

export async function ping() {
  const r = await q('SELECT 1 AS ok');
  return r.rows?.[0]?.ok === 1;
}

export async function listChartAccountsForCaixa() {
  const res = await q(`
    SELECT
      id,
      code,
      description,
      account_type,
      nature,
      level,
      parent_account_id,
      allows_posting,
      is_active
    FROM "chartOfAccounts"
    WHERE is_active = true
      AND allows_posting = true
    ORDER BY code ASC
  `);

  return res.rows;
}
