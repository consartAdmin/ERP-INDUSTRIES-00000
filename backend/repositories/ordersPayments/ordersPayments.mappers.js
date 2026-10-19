// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPayments.mappers.js — Linha do banco → objeto pagamento      ║
// ╚════════════════════════════════════════════════════════════════════╝

export function rowToPayment(row) {
  if (!row) return null;

  return {
    order_payment_id: row.order_payment_id,
    order_id: row.order_id,
    payment_method_id: row.payment_method_id,
    payment_method_name: row.payment_method_name,
    amount: Number(row.amount || 0),
    installments: row.installments,
    gap_one: row.gap_one,
    gap_two: row.gap_two,
    gap_three: row.gap_three,
    gap_four: row.gap_four,
    manual_due_date: row.manual_due_date,
    created_at: row.created_at,
  };
}
