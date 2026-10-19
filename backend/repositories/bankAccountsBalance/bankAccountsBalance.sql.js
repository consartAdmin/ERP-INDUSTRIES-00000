// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalance.sql.js — Fragmentos SQL (movimentos / SELECT)  ║
// ╚════════════════════════════════════════════════════════════════════╝

// Total da movimentação (mesma regra do resumo do Caixa)
export const MOVEMENT_TOTAL_SQL = `(
  m.amount
  + COALESCE(m.penalty_amount, 0)
  + COALESCE(m.interest_amount, 0)
  + COALESCE(m.fee_amount, 0)
)`;

export const MOVEMENT_TYPE_SQL = `
  translate(upper(m.movement_type), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
`;

export const SIGNED_MOVEMENT_SQL = `
  CASE
    WHEN ${MOVEMENT_TYPE_SQL} LIKE 'ENTR%' THEN ${MOVEMENT_TOTAL_SQL}
    WHEN ${MOVEMENT_TYPE_SQL} LIKE 'SAID%' THEN -${MOVEMENT_TOTAL_SQL}
    ELSE 0
  END
`;

export const SELECT_FIELDS = `
  bb.id,
  bb.bank_account_id,
  ba.name AS bank_account_name,
  to_char(bb.balance_date, 'YYYY-MM-DD') AS balance_date,
  bb.balance,
  bb.system_balance,
  bb.difference,
  bb.notes,
  bb.created_by,
  bb.created_at,
  bb.updated_at
`;
