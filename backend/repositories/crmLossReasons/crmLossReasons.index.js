// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmLossReasons.index.js — ponto de entrada dos motivos de perda    ║
// ║ Mantém a mesma API pública do antigo crmLossReasonsApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listAll, listActive, getById } from './crmLossReasonsQuery.repository.js';
import { create } from './crmLossReasonsCreate.repository.js';

const crmLossReasonsApi = {
  listAll,
  listActive,
  getById,
  create
};

export default crmLossReasonsApi;
