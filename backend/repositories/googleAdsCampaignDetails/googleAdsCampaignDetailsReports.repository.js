// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsReports.repository.js                      ║
// ║ Keywords, termos de pesquisa, anúncios, geo e alterações (GAQL)    ║
// ╚════════════════════════════════════════════════════════════════════╝

import gaqlFeatureGuard from '../../services/googleAds/googleAdsCampaignDetailsgaqlFeatureGuard.js';
import {
  toYmd,
  escGaqlString,
  safeInt,
  microsToMoney,
  normDigits,
  daysBetweenYmd,
  addDaysYmd,
  pickNested,
} from './googleAdsCampaignDetails.utils.js';

// ---------------------------------------------------------------------
// 7) Keywords — keyword_view
// ---------------------------------------------------------------------
export async function getCampaignKeywords({ customerId, campaignId, from, to, limit = 200 }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignKeywords(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignKeywords(): from/to obrigatórios.');

  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.status,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.cost_micros
    FROM keyword_view
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    ORDER BY metrics.cost_micros DESC
    LIMIT ${safeInt(limit, 200)}
  `;

  const rows = await customer.query(query);

  return (rows || []).map(r => ({
    keyword: String(pickNested(r, 'adGroupCriterion', 'ad_group_criterion')?.keyword?.text || ''),
    status: String(pickNested(r, 'adGroupCriterion', 'ad_group_criterion')?.status || ''),
    impressions: Number(pickNested(r, 'metrics', 'metrics')?.impressions || 0),
    clicks: Number(pickNested(r, 'metrics', 'metrics')?.clicks || 0),
    ctr: Number(pickNested(r, 'metrics', 'metrics')?.ctr || 0),
    cost: microsToMoney(pickNested(r, 'metrics', 'metrics')?.cost_micros || 0),
  }));
}

// ---------------------------------------------------------------------
// 8) Termos de pesquisa — search_term_view
// ---------------------------------------------------------------------
export async function getCampaignSearchTerms({ customerId, campaignId, from, to, limit = 200 }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignSearchTerms(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignSearchTerms(): from/to obrigatórios.');

  const query = `
    SELECT
      search_term_view.search_term,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM search_term_view
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    ORDER BY metrics.impressions DESC
    LIMIT ${safeInt(limit, 200)}
  `;

  const rows = await customer.query(query);

  return (rows || []).map(r => ({
    term: String(pickNested(r, 'searchTermView', 'search_term_view')?.search_term || ''),
    impressions: Number(pickNested(r, 'metrics', 'metrics')?.impressions || 0),
    clicks: Number(pickNested(r, 'metrics', 'metrics')?.clicks || 0),
    cost: microsToMoney(pickNested(r, 'metrics', 'metrics')?.cost_micros || 0),
  }));
}

// ---------------------------------------------------------------------
// 9) Anúncios — ad_group_ad
// ---------------------------------------------------------------------
export async function getCampaignAds({ customerId, campaignId, from, to, limit = 200 }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignAds(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignAds(): from/to obrigatórios.');

  const query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.status,
      ad_group_ad.ad.type,
      ad_group_ad.ad.final_urls,
      ad_group.id,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr
    FROM ad_group_ad
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    ORDER BY metrics.impressions DESC
    LIMIT ${safeInt(limit, 200)}
  `;

  const rows = await customer.query(query);

  return (rows || []).map(r => ({
    adId: String(pickNested(r, 'adGroupAd', 'ad_group_ad')?.ad?.id || ''),
    status: String(pickNested(r, 'adGroupAd', 'ad_group_ad')?.status || ''),
    type: String(pickNested(r, 'adGroupAd', 'ad_group_ad')?.ad?.type || ''),
    finalUrls: (pickNested(r, 'adGroupAd', 'ad_group_ad')?.ad?.final_urls || []).map(String),
    adGroupId: String(pickNested(r, 'adGroup', 'ad_group')?.id || ''),
    adGroupName: String(pickNested(r, 'adGroup', 'ad_group')?.name || ''),
    impressions: Number(pickNested(r, 'metrics', 'metrics')?.impressions || 0),
    clicks: Number(pickNested(r, 'metrics', 'metrics')?.clicks || 0),
    ctr: Number(pickNested(r, 'metrics', 'metrics')?.ctr || 0),
  }));
}

// ---------------------------------------------------------------------
// 10) Geo — geographic_view (robusto) + campaign.id no SELECT
// ---------------------------------------------------------------------
export async function getCampaignGeo({ customerId, campaignId, from, to, limit = 200 }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignGeo(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignGeo(): from/to obrigatórios.');

  if (!gaqlFeatureGuard.isEnabled(customerId, 'geo')) return [];

  const query = `
    SELECT
      campaign.id,
      geographic_view.location_type,
      geographic_view.country_criterion_id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM geographic_view
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    ORDER BY metrics.impressions DESC
    LIMIT ${safeInt(limit, 200)}
  `;

  const rows = await gaqlFeatureGuard.query(customerId, 'geo', customer, query).catch(() => []);

  return (rows || []).map(r => {
    const campaign = pickNested(r, 'campaign', 'campaign');
    const geo = pickNested(r, 'geographicView', 'geographic_view');
    const metrics = pickNested(r, 'metrics', 'metrics');

    return {
      campaignId: String(campaign?.id || ''),
      locationType: String(geo?.location_type || geo?.locationType || ''),
      criterionId: String(geo?.country_criterion_id || geo?.countryCriterionId || ''),
      impressions: Number(metrics?.impressions || 0),
      clicks: Number(metrics?.clicks || 0),
      cost: microsToMoney(metrics?.cost_micros || 0),
    };
  });
}

// ---------------------------------------------------------------------
// 11) Alterações — change_event (histórico) ✅ clamp <= 30 dias e YYYY-MM-DD
// ---------------------------------------------------------------------
export async function getCampaignChanges({ customerId, campaignId, from, to, limit = 200 }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);

  if (!Number.isFinite(id)) throw new Error('getCampaignChanges(): campaignId inválido.');

  if (!gaqlFeatureGuard.isEnabled(customerId, 'changes')) return [];

  // O Google Ads limita: start não pode ser > 30 dias atrás.
  // Vamos “clamp” o from para no máximo (to - 29 dias) para evitar erro.
  const dateTo = toYmd(to);
  let dateFrom = toYmd(from);

  if (!dateFrom || !dateTo) throw new Error('getCampaignChanges(): from/to obrigatórios (YYYY-MM-DD).');

  const diff = daysBetweenYmd(dateFrom, dateTo);
  if (diff > 29) {
    dateFrom = addDaysYmd(dateTo, -29);
  }

  const cid = normDigits(customerId);
  const campaignResource = cid ? `customers/${cid}/campaigns/${id}` : null;

  // GAQL: BETWEEN para change_date_time só aceita YYYY-MM-DD (sem hora)
  // e precisa range finito.
  const where = campaignResource
    ? `WHERE change_event.campaign = '${escGaqlString(campaignResource)}'
       AND change_event.change_date_time BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'`
    : `WHERE change_event.change_resource_type = 'CAMPAIGN'
       AND change_event.change_date_time BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'`;

  const query = `
    SELECT
      change_event.change_date_time,
      change_event.user_email,
      change_event.change_resource_type,
      change_event.change_resource_name
    FROM change_event
    ${where}
    ORDER BY change_event.change_date_time DESC
    LIMIT ${safeInt(limit, 200)}
  `;

  const rows = await gaqlFeatureGuard.query(customerId, 'changes', customer, query).catch(() => []);

  return (rows || []).map(r => {
    const ce = pickNested(r, 'changeEvent', 'change_event');
    return {
      dateTime: String(ce?.change_date_time || ce?.changeDateTime || ''),
      userEmail: String(ce?.user_email || ce?.userEmail || ''),
      resourceType: String(ce?.change_resource_type || ce?.changeResourceType || ''),
      resourceName: String(ce?.change_resource_name || ce?.changeResourceName || ''),
      // útil pra debug: range efetivo usado (clamp)
      rangeApplied: { from: dateFrom, to: dateTo },
    };
  });
}
