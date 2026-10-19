// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalance.index.js — ponto de entrada do módulo de       ║
// ║ saldos/conferências bancárias                                      ║
// ║ Mantém a mesma API pública do antigo bankAccountsBalanceApi.js     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { calculateBalance } from './bankAccountsBalanceCalculate.repository.js';
import { getSummary } from './bankAccountsBalanceSummary.repository.js';
import { listCheckpoints, getCheckpointById } from './bankAccountsBalanceQuery.repository.js';
import { createCheckpoint, updateCheckpoint, deleteCheckpoint } from './bankAccountsBalanceMutation.repository.js';

export {
  calculateBalance,
  getSummary,
  listCheckpoints,
  getCheckpointById,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
};

export default {
  calculateBalance,
  getSummary,
  listCheckpoints,
  getCheckpointById,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
};
