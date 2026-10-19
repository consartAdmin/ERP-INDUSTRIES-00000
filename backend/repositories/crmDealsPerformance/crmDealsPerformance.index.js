// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsPerformance.index.js — ponto de entrada Sales Performance  ║
// ║ Mantém a mesma API pública do antigo crmDealsPerformanceApi.js     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './crmDealsPerformanceSchema.repository.js';
import { logAction } from './crmDealsPerformanceLog.repository.js';
import { listActions, getSellerPerformance } from './crmDealsPerformanceQuery.repository.js';

const crmDealsReativationPerformanceApi = {
  ensureTable,
  logAction,
  listActions,
  getSellerPerformance,
};

export default crmDealsReativationPerformanceApi;
