// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCredit.mappers.js — Linha do banco → objeto da API        ║
// ╚════════════════════════════════════════════════════════════════════╝

export const mapPosition = (row) => row && ({
  customer_id: row.customer_id,
  trade_name: row.trade_name ?? null,
  customer_credit_id: row.customer_credit_id ?? null,
  credit_limit: Number(row.credit_limit ?? 0),
  credit_used: Number(row.amount_to_pay ?? row.credit_used ?? 0),
  credit_available: Number(row.credit_available ?? 0),
  credit_exceeded: Number(row.credit_exceeded ?? 0),
  overdue_amount: Number(row.overdue_amount ?? 0),
  open_titles: Number(row.open_titles ?? 0),
  allow_credit: row.allow_credit ?? false,
  can_buy_on_credit: row.can_buy_on_credit ?? false,
});
