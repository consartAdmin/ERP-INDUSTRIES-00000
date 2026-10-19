// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsCreate.repository.js — createMovement                 ║
// ║ Tabela: "cashMoviments"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, getMovementPayloadValue } from './cashMoviments.utils.js';
import { normalizeTipoMovimentacao, toBool, toBankAccountId } from './cashMoviments.sanitizers.js';
import { bankAccountIdSql } from './cashMoviments.sql.js';
import { getMovementById } from './cashMovimentsQuery.repository.js';

export async function createMovement(payload = {}) {
  const cols = [
    'movement_date',
    'movement_type',
    'cash_account',
    'amount',
    'document_type',
    'document_number',
    'supplier_name',
    'notes',
    'penalty_amount',
    'interest_amount',
    'fee_amount',
    'category',
    'subcategory',
    'chart_account_id',
    'is_deductible',
    'is_pis_cofins_creditable',
    'deduct_charges_only',
    'is_active',
  ];

  const vals = cols.map((_, i) => `$${i + 1}`);

  const params = cols.map((c) => {
    const value = getMovementPayloadValue(payload, c);

    if (c === 'is_active') {
      return value === undefined ? true : !!value;
    }

    if (c === 'is_deductible' || c === 'is_pis_cofins_creditable' || c === 'deduct_charges_only') {
      return value === undefined ? null : toBool(value, null);
    }

    if (c === 'movement_type') {
      return normalizeTipoMovimentacao(value);
    }

    if (c === 'chart_account_id') {
      if (value === undefined || value === null || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    return value ?? null;
  });

  // bank_account_id: ID enviado (ex.: Contas a Pagar) ou resolvido pelo nome da conta
  const cashAccountParam = cols.indexOf('cash_account') + 1;
  params.push(toBankAccountId(payload.bank_account_id));
  const bankAccountSql = bankAccountIdSql(`$${params.length}`, `$${cashAccountParam}`);

  const sql = `
    INSERT INTO "cashMoviments" (${cols.join(',')}, bank_account_id)
    VALUES (${vals.join(',')}, ${bankAccountSql})
    RETURNING *
  `;

  const res = await q(sql, params);
  return getMovementById(res.rows[0].id);
}
