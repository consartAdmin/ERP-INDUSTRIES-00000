// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAds.index.js — ponto de entrada do módulo Google Ads manual  ║
// ║ Mantém a mesma API pública do antigo googleAdsApi.js               ║
// ╚════════════════════════════════════════════════════════════════════╝

export { list, getById } from './googleAdsQuery.repository.js';
export { create } from './googleAdsCreate.repository.js';
export { update } from './googleAdsUpdate.repository.js';
export { remove } from './googleAdsRemove.repository.js';
export {
  getDashboardSummary,
  getCampaignPerformance,
  getDailySeries,
} from './googleAdsDashboard.repository.js';
