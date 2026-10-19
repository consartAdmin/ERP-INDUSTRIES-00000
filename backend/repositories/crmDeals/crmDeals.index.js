// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDeals.index.js — ponto de entrada do DAL CRM Deals              ║
// ║ Kanban / Deals / Outcomes / Status Sync / Conclusão do Lead        ║
// ║ Mantém a mesma API pública do antigo crmDealsApi.js                ║
// ╚════════════════════════════════════════════════════════════════════╝

import perfApi from '../crmDealsPerformance/crmDealsPerformance.index.js';
import { ensureCrmCompanyColumn } from './crmDealsSchema.repository.js';
import { listStages, getStageById, getStageByCode } from './crmDealsStages.repository.js';
import { listDeals, getDealById, listCustomerLocations } from './crmDealsQuery.repository.js';
import { createDeal } from './crmDealsCreate.repository.js';
import { updateDeal, moveDealToStage } from './crmDealsUpdate.repository.js';
import { deleteDeal } from './crmDealsRemove.repository.js';
import {
  registerOutcome,
  getOutcomesSummary,
  listOutcomes,
} from './crmDealsOutcome.repository.js';
import {
  listStatusTypes,
  listLeadSources,
  listDealOutcomes,
} from './crmDealsCatalogs.repository.js';
import {
  concludeLeadStatusType,
  getLeadConclusionSummary,
} from './crmDealsConclusion.repository.js';

// Efeito colateral de módulo (igual ao original): garante a tabela de ações.
perfApi.ensureTable?.()
  .then((r) => {
    if (r?.ok) console.log('[crmDealsApi] crmDealsActions OK');
    else console.warn('[crmDealsApi] ensureTable actions retorno:', r);
  })
  .catch((e) => console.warn('[crmDealsApi] ensureTable actions falhou:', e?.message || e));

// Garante a coluna crm_company (CRM BH3 x CRM Consart ERP).
ensureCrmCompanyColumn()
  .then((r) => {
    if (r?.ok) console.log('[crmDealsApi] crmDeals.crm_company OK');
    else console.warn('[crmDealsApi] ensureCrmCompanyColumn retorno:', r);
  })
  .catch((e) => console.warn('[crmDealsApi] ensureCrmCompanyColumn falhou:', e?.message || e));

const crmDealsApi = {
  listStages,
  getStageById,
  getStageByCode,

  listDeals,
  listCustomerLocations,
  getDealById,
  createDeal,
  updateDeal,
  moveDealToStage,
  deleteDeal,

  registerOutcome,
  getOutcomesSummary,
  listOutcomes,

  listStatusTypes,
  listLeadSources,
  listDealOutcomes,

  concludeLeadStatusType,
  getLeadConclusionSummary,
};

export default crmDealsApi;
