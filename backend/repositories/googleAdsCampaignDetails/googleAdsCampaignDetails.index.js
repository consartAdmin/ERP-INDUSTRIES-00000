// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetails.index.js — ponto de entrada do módulo     ║
// ║ Mantém a mesma API pública do antigo googleAdsCampaignDetailsApi.js║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  listCampaignStats,
  getCampaignHeader,
  getCampaignKpis,
  getCampaignTimeseries,
} from './googleAdsCampaignDetailsCampaign.repository.js';
export {
  getCampaignDevices,
  getCampaignDemographics,
  getCampaignWeekdayHour,
} from './googleAdsCampaignDetailsSegments.repository.js';
export {
  getCampaignKeywords,
  getCampaignSearchTerms,
  getCampaignAds,
  getCampaignGeo,
  getCampaignChanges,
} from './googleAdsCampaignDetailsReports.repository.js';
export { getCampaignFull } from './googleAdsCampaignDetailsFull.repository.js';
