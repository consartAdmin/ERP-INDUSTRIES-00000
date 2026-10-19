// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccounts.index.js — ponto de entrada do módulo contas bancárias║
// ║ Mantém a mesma API pública do antigo bankAccountsApi.js            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listBankAccounts, getBankAccountById } from './bankAccountsQuery.repository.js';
import { createBankAccount, updateBankAccount, deactivateBankAccount } from './bankAccountsMutation.repository.js';

export { listBankAccounts, getBankAccountById, createBankAccount, updateBankAccount, deactivateBankAccount };

export default { listBankAccounts, getBankAccountById, createBankAccount, updateBankAccount, deactivateBankAccount };
