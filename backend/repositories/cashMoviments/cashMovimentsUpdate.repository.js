// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsUpdate.repository.js — updateMovement                 ║
// ║ Tabela: "cashMoviments"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, getMovementPayloadValue } from './cashMoviments.utils.js';
import { normalizeTipoMovimentacao, toBool, toBankAccountId } from './cashMoviments.sanitizers.js';
import { bankAccountIdSql } from './cashMoviments.sql.js';
import { getMovementById } from './cashMovimentsQuery.repository.js';

export async function updateMovement(id, payload = {}) {
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

  const sets = [];
  const params = [];
  let i = 1;

  for (const c of cols) {
    const v = getMovementPayloadValue(payload, c);
    if (v === undefined) continue;

    if (c === 'is_active') {
      sets.push(`${c} = $${i++}`);
      params.push(v === null ? null : !!v);
      continue;
    }

    if (c === 'is_deductible' || c === 'is_pis_cofins_creditable' || c === 'deduct_charges_only') {
      sets.push(`${c} = $${i++}`);
      params.push(v === null ? null : toBool(v, null));
      continue;
    }

    if (c === 'movement_type') {
      sets.push(`${c} = $${i++}`);
      params.push(normalizeTipoMovimentacao(v));
      continue;
    }

    sets.push(`${c} = $${i++}`);
    params.push(v);
  }

  // bank_account_id acompanha a conta: ID enviado, ou pelo novo nome da conta.
  // Nome sem conta cadastrada mantém o vínculo atual se o nome não mudou.
  const newCashAccount = getMovementPayloadValue(payload, 'cash_account');
  if (payload.bank_account_id !== undefined || newCashAccount !== undefined) {
    const idParam = `$${i++}`;
    params.push(toBankAccountId(payload.bank_account_id));
    const nameParam = `$${i++}`;
    params.push(newCashAccount ?? null);
    sets.push(`bank_account_id = COALESCE(
      ${bankAccountIdSql(idParam, nameParam)},
      CASE WHEN UPPER(TRIM(cash_account)) = UPPER(TRIM(${nameParam}::varchar)) THEN bank_account_id END
    )`);
  }

  if (!sets.length) return getMovementById(id);

  sets.push('updated_at = now()');

  const sql = `
    UPDATE "cashMoviments"
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING id
  `;

  const res = await q(sql, [...params, Number(id)]);
  const updatedId = res.rows?.[0]?.id;

  return updatedId ? getMovementById(updatedId) : null;
}
