// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenses.sanitizers.js — Campos permitidos do payload de despesa   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function sanitizeExpensePayload(body = {}) {
  // Mantém só campos permitidos para evitar lixo/SQL issues
  return {
    expense_id: body.expense_id ?? null,
    name: body.name,
    description: body.description ?? null,
    value: body.value,
    due_date: body.due_date,
    competence_month: body.competence_month ?? null,
    competence_year: body.competence_year ?? null,
    category: body.category ?? null,
    cost_center: body.cost_center ?? null,
    vendor: body.vendor ?? null,
    recurrence_type: body.recurrence_type ?? 'MONTHLY',
    status: body.status ?? 'PENDING',
    paid_date: body.paid_date ?? null,
    payment_method: body.payment_method ?? null,
    account_payable_id: body.account_payable_id ?? null,
    payload: body.payload ?? null,
    is_active: body.is_active ?? true,
  };
}
