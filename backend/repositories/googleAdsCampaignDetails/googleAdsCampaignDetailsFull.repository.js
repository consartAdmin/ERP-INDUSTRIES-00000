// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsFull.repository.js — getCampaignFull       ║
// ║ Agrega todos os blocos da tela de detalhes da campanha             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toYmd } from './googleAdsCampaignDetails.utils.js';
import {
  getCampaignHeader,
  getCampaignKpis,
  getCampaignTimeseries,
} from './googleAdsCampaignDetailsCampaign.repository.js';
import {
  getCampaignDevices,
  getCampaignDemographics,
  getCampaignWeekdayHour,
} from './googleAdsCampaignDetailsSegments.repository.js';
import {
  getCampaignKeywords,
  getCampaignSearchTerms,
  getCampaignAds,
  getCampaignGeo,
  getCampaignChanges,
} from './googleAdsCampaignDetailsReports.repository.js';

// ---------------------------------------------------------------------
// 13) FULL — resposta completa (tudo que o front precisa)
// ---------------------------------------------------------------------
export async function getCampaignFull({ customerId, campaignId, from, to }) {
  const [header, kpis, timeseries, devices, demographics, keywords, searchTerms, ads, geo, changes, weekdayHour] =
    await Promise.all([
      getCampaignHeader({ customerId, campaignId }),
      getCampaignKpis({ customerId, campaignId, from, to }),
      getCampaignTimeseries({ customerId, campaignId, from, to }),
      getCampaignDevices({ customerId, campaignId, from, to }),
      getCampaignDemographics({ customerId, campaignId, from, to }),
      getCampaignKeywords({ customerId, campaignId, from, to }),
      getCampaignSearchTerms({ customerId, campaignId, from, to }),
      getCampaignAds({ customerId, campaignId, from, to }),
      getCampaignGeo({ customerId, campaignId, from, to }),
      getCampaignChanges({ customerId, campaignId, from, to }),
      getCampaignWeekdayHour({ customerId, campaignId, from, to }),
    ]);

  return {
    header,
    kpis,
    timeseries,
    devices,
    demographics,
    keywords,
    searchTerms,
    ads,
    geo,
    changes,
    weekdayHour,
    range: { from: toYmd(from), to: toYmd(to) },
  };
}
