// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccounts.index.js — ponto de entrada do plano de contas     ║
// ║ Mantém a mesma API pública do antigo chartOfAccountsApi.js         ║
// ║ (somente export default, sem named exports)                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './chartOfAccountsSchema.repository.js';
import { list, search, listPostingAccounts } from './chartOfAccountsQuery.repository.js';
import { getById, getByCode } from './chartOfAccountsGetById.repository.js';
import { create } from './chartOfAccountsCreate.repository.js';
import { update, setActive } from './chartOfAccountsUpdate.repository.js';
import { remove } from './chartOfAccountsRemove.repository.js';
import {
  hasChildren,
  getTree,
  getFlatHierarchy,
  getDescendantIds,
} from './chartOfAccountsHierarchy.repository.js';

const chartOfAccountsApi = {
  ensureTable,
  list,
  search,
  getById,
  getByCode,
  create,
  update,
  remove,
  setActive,
  hasChildren,
  getTree,
  getFlatHierarchy,
  getDescendantIds,
  listPostingAccounts,
};

export default chartOfAccountsApi;
