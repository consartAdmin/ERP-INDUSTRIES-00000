// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenses.index.js — ponto de entrada do módulo despesas            ║
// ║ Mantém a mesma API pública do antigo expensesApi.js                ║
// ║ (somente named exports; sem default)                               ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listExpenses, countExpenses, getExpenseById } from './expensesQuery.repository.js';
export { createExpense } from './expensesCreate.repository.js';
export { updateExpense, patchExpenseStatus } from './expensesUpdate.repository.js';
export { deleteExpense } from './expensesRemove.repository.js';
