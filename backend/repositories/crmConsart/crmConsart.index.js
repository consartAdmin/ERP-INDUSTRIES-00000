// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsart.index.js — ponto de entrada do DAL CRM (Reativação)     ║
// ║ Mantém a mesma API pública do antigo crmConsartApi.js              ║
// ║ Tabelas: "crmStagesReativation", "crmDealsReativation",            ║
// ║          "crmDealsReativationOutcomes"                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listStages, getStageById, getStageByCode } from './crmConsartStages.repository.js';
import { listDeals, getDealById } from './crmConsartDealsQuery.repository.js';
import { createDeal } from './crmConsartDealsCreate.repository.js';
import { updateDeal, moveDealToStage } from './crmConsartDealsUpdate.repository.js';
import { deleteDeal } from './crmConsartDealsRemove.repository.js';
import { registerOutcome, getOutcomesSummary } from './crmConsartOutcomes.repository.js';

const crmConsartApi = {
  // stages
  listStages,
  getStageById,
  getStageByCode,

  // deals
  listDeals,
  getDealById,
  createDeal,
  updateDeal,
  moveDealToStage,
  deleteDeal,

  // outcomes
  registerOutcome,
  getOutcomesSummary,
};

export default crmConsartApi;
