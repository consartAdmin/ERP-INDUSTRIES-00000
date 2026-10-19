// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsCampaign.repository.js                     ║
// ║ Lista de campanhas, header, KPIs e série temporal (GAQL)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toYmd, escGaqlString, safeInt, microsToMoney, pickNested } from './googleAdsCampaignDetails.utils.js';

// ---------------------------------------------------------------------
// 1) Lista campanhas com métricas do período (dropdown)
// ---------------------------------------------------------------------
export async function listCampaignStats({ customerId, from, to }) {
  const customer = getCustomer(customerId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!dateFrom || !dateTo) {
    throw new Error('listCampaignStats(): parâmetros from/to obrigatórios (YYYY-MM-DD).');
  }

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    LIMIT 10000
  `;

  const rows = await customer.query(query);

  const map = new Map();
  for (const r of (rows || [])) {
    const campaign = pickNested(r, 'campaign', 'campaign');
    const metrics  = pickNested(r, 'metrics', 'metrics');

    const id = String(campaign?.id ?? '');
    if (!id) continue;

    const cur = map.get(id) || {
      campaignId: id,
      campaignName: String(campaign?.name ?? ''),
      status: String(campaign?.status ?? ''),
      channel: String(campaign?.advertising_channel_type ?? ''),
      impressions: 0,
      clicks: 0,
      costMicros: 0,
      conversions: 0,
      convValue: 0,
    };

    cur.impressions += Number(metrics?.impressions || 0);
    cur.clicks      += Number(metrics?.clicks || 0);
    cur.costMicros  += Number(metrics?.cost_micros || 0);
    cur.conversions += Number(metrics?.conversions || 0);
    cur.convValue   += Number(metrics?.conversions_value || 0);

    cur.campaignName = String(campaign?.name ?? cur.campaignName);
    cur.status = String(campaign?.status ?? cur.status);
    cur.channel = String(campaign?.advertising_channel_type ?? cur.channel);

    map.set(id, cur);
  }

  const out = Array.from(map.values()).map((x) => {
    const impressions = Number(x.impressions || 0);
    const clicks = Number(x.clicks || 0);
    const ctr = impressions > 0 ? (clicks / impressions) : 0;

    return {
      campaignId: x.campaignId,
      campaignName: x.campaignName,
      status: x.status,
      channel: x.channel,
      impressions,
      clicks,
      ctr,
      cost: microsToMoney(x.costMicros),
      conversions: Number(x.conversions || 0),
      convValue: Number(x.convValue || 0),
    };
  });

  out.sort((a, b) => (b.cost || 0) - (a.cost || 0));
  return out.slice(0, 300);
}

// ---------------------------------------------------------------------
// 2) Header (informações da campanha) + início/fim
// ---------------------------------------------------------------------
export async function getCampaignHeader({ customerId, campaignId }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);

  if (!Number.isFinite(id)) throw new Error('getCampaignHeader(): campaignId inválido.');

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id = ${id}
    LIMIT 1
  `;

  const rows = await customer.query(query);
  const r = rows?.[0];
  if (!r) return null;

  const campaign = pickNested(r, 'campaign', 'campaign');
  const campaignBudget = pickNested(r, 'campaignBudget', 'campaign_budget');

  const startDate = campaign?.start_date ? String(campaign.start_date) : null;
  const endDate   = campaign?.end_date ? String(campaign.end_date) : null;

  return {
    id: String(campaign.id),
    name: String(campaign.name),
    status: String(campaign.status),
    channel: String(campaign.advertising_channel_type),
    biddingStrategy: String(campaign.bidding_strategy_type || ''),
    startDate,
    endDate,
    budgetDaily: microsToMoney(campaignBudget?.amount_micros || campaignBudget?.amountMicros || 0),
  };
}

// ---------------------------------------------------------------------
// 3) KPIs agregados (cards) — ✅ USA o range selecionado (segments.date)
// ---------------------------------------------------------------------
export async function getCampaignKpis({ customerId, campaignId, from, to }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);

  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignKpis(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignKpis(): from/to obrigatórios (YYYY-MM-DD).');

  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.interactions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    LIMIT 1
  `;

  const rows = await customer.query(query);
  const r = rows?.[0];

  const metrics = pickNested(r, 'metrics', 'metrics');

  if (!metrics) {
    return {
      impressions: 0,
      clicks: 0,
      interactions: 0,
      ctr: 0,
      averageCpc: 0,
      cost: 0,
      conversions: 0,
      convValue: 0,
    };
  }

  return {
    impressions: Number(metrics.impressions || 0),
    clicks: Number(metrics.clicks || 0),
    interactions: Number(metrics.interactions || 0),
    ctr: Number(metrics.ctr || 0),
    averageCpc: microsToMoney(metrics.average_cpc || 0),
    cost: microsToMoney(metrics.cost_micros || 0),
    conversions: Number(metrics.conversions || 0),
    convValue: Number(metrics.conversions_value || 0),
  };
}

// ---------------------------------------------------------------------
// 4) Série temporal (dia a dia) — USA segments.date
// ---------------------------------------------------------------------
export async function getCampaignTimeseries({ customerId, campaignId, from, to }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);

  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignTimeseries(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignTimeseries(): from/to obrigatórios.');

  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
    ORDER BY segments.date ASC
  `;

  const rows = await customer.query(query);

  return (rows || []).map((r) => ({
    date: String(pickNested(r, 'segments', 'segments')?.date),
    impressions: Number(pickNested(r, 'metrics', 'metrics')?.impressions || 0),
    clicks: Number(pickNested(r, 'metrics', 'metrics')?.clicks || 0),
    cost: microsToMoney(pickNested(r, 'metrics', 'metrics')?.cost_micros || 0),
    conversions: Number(pickNested(r, 'metrics', 'metrics')?.conversions || 0),
    convValue: Number(pickNested(r, 'metrics', 'metrics')?.conversions_value || 0),
  }));
}
