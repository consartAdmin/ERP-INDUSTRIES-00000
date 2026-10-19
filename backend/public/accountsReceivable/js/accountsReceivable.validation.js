export function validateAccount(payload) {
  if (!payload.customer_id || !payload.issue_date || !payload.due_date || !payload.value) {
    throw new Error('Preencha Cliente, Emissão, Vencimento e Valor.');
  }
}
