// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccounts.index.js — ponto de entrada users ↔ emailAccounts║
// ║ Mantém a mesma API pública do antigo userEmailAccountsApi.js       ║
// ║ (funções recebem pgPool como 1º argumento; sem export default)     ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  USER_EMAIL_ACCOUNTS_TABLE,
  USERS_TABLE,
  EMAIL_ACCOUNTS_TABLE,
} from './userEmailAccounts.constants.js';
export {
  getById,
  list,
  listByUserId,
  listByEmailAccountId,
} from './userEmailAccountsQuery.repository.js';
export { create } from './userEmailAccountsCreate.repository.js';
export { update } from './userEmailAccountsUpdate.repository.js';
export { remove } from './userEmailAccountsRemove.repository.js';
