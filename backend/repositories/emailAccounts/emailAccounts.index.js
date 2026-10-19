// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailAccounts.index.js — ponto de entrada do módulo emailAccounts  ║
// ║ Mantém a mesma API pública do antigo emailAccountsApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_ACCOUNTS_TABLE } from './emailAccounts.constants.js';
import { normalizeAccountPayload } from './emailAccounts.sanitizers.js';
import { createAccount } from './emailAccountsCreate.repository.js';
import { updateAccount } from './emailAccountsUpdate.repository.js';
import { listAccounts, getAccountById } from './emailAccountsQuery.repository.js';

export { EMAIL_ACCOUNTS_TABLE };

const emailAccountsApi = {
  normalizeAccountPayload,
  createAccount,
  updateAccount,
  listAccounts,
  getAccountById,

  async deactivateAccount(pgPool, id) {
    return emailAccountsApi.updateAccount(pgPool, id, { is_active: false });
  },
};

export default emailAccountsApi;
