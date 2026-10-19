// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.validation.js — Form validation (PRODNEX ERP)        ║
// ║ Path: backend/public/expenseEntries/expenseEntries.validation.js     ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function validateExpenseEntry(payload) {
  const errors = [];

  if (!payload.issueDate) errors.push('Issue Date é obrigatório.');
  if (!Number.isFinite(payload.totalExpenseValue)) {
    errors.push('O valor total da despesa é inválido.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

