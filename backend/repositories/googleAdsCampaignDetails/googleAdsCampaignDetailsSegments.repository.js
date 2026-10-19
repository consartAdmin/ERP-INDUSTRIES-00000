// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsSegments.repository.js                     ║
// ║ Dispositivos, demografia e heatmap dia/hora (GAQL)                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import gaqlFeatureGuard from '../../services/googleAds/googleAdsCampaignDetailsgaqlFeatureGuard.js';
import { toYmd, escGaqlString, safeInt, microsToMoney, pickNested } from './googleAdsCampaignDetails.utils.js';

// ---------------------------------------------------------------------
// 5) Dispositivos — segments.device
// ---------------------------------------------------------------------
export async function getCampaignDevices({ customerId, campaignId, from, to }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignDevices(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignDevices(): from/to obrigatórios.');

  const query = `
    SELECT
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
  `;

  const rows = await customer.query(query);

  return (rows || []).map(r => ({
    device: String(pickNested(r, 'segments', 'segments')?.device || ''),
    impressions: Number(pickNested(r, 'metrics', 'metrics')?.impressions || 0),
    clicks: Number(pickNested(r, 'metrics', 'metrics')?.clicks || 0),
    cost: microsToMoney(pickNested(r, 'metrics', 'metrics')?.cost_micros || 0),
  }));
}

// ---------------------------------------------------------------------
// 6) Demografia — ✅ CORRETO: gender_view + age_range_view (não segments.*)
// ---------------------------------------------------------------------
export async function getCampaignDemographics({ customerId, campaignId, from, to }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignDemographics(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignDemographics(): from/to obrigatórios.');

  // Feature-guard: se a conta não suportar por algum motivo, não derruba /full
  if (!gaqlFeatureGuard.isEnabled(customerId, 'demographics')) return [];

  const qGender = `
    SELECT
      campaign.id,
      gender_view.gender_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM gender_view
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
  `;

  const qAge = `
    SELECT
      campaign.id,
      age_range_view.age_range,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM age_range_view
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
  `;

  const [genderRows, ageRows] = await Promise.all([
    gaqlFeatureGuard.query(customerId, 'demographics', customer, qGender).catch(() => []),
    gaqlFeatureGuard.query(customerId, 'demographics', customer, qAge).catch(() => []),
  ]);

  const out = [];

  for (const r of (genderRows || [])) {
    const genderView = pickNested(r, 'genderView', 'gender_view');
    const metrics = pickNested(r, 'metrics', 'metrics');
    out.push({
      dimension: 'gender',
      key: String(genderView?.gender_type || genderView?.genderType || ''),
      impressions: Number(metrics?.impressions || 0),
      clicks: Number(metrics?.clicks || 0),
      cost: microsToMoney(metrics?.cost_micros || 0),
    });
  }

  for (const r of (ageRows || [])) {
    const ageView = pickNested(r, 'ageRangeView', 'age_range_view');
    const metrics = pickNested(r, 'metrics', 'metrics');
    out.push({
      dimension: 'age_range',
      key: String(ageView?.age_range || ageView?.ageRange || ''),
      impressions: Number(metrics?.impressions || 0),
      clicks: Number(metrics?.clicks || 0),
      cost: microsToMoney(metrics?.cost_micros || 0),
    });
  }

  return out;
}

// ---------------------------------------------------------------------
// 12) Heatmap Dia/Hora — segments.day_of_week + segments.hour
// ---------------------------------------------------------------------
export async function getCampaignWeekdayHour({ customerId, campaignId, from, to }) {
  const customer = getCustomer(customerId);
  const id = safeInt(campaignId);
  const dateFrom = toYmd(from);
  const dateTo   = toYmd(to);

  if (!Number.isFinite(id)) throw new Error('getCampaignWeekdayHour(): campaignId inválido.');
  if (!dateFrom || !dateTo) throw new Error('getCampaignWeekdayHour(): from/to obrigatórios.');

  const query = `
    SELECT
      segments.day_of_week,
      segments.hour,
      metrics.impressions
    FROM campaign
    WHERE campaign.id = ${id}
      AND segments.date BETWEEN '${escGaqlString(dateFrom)}' AND '${escGaqlString(dateTo)}'
  `;

  const rows = await customer.query(query);

  return (rows || []).map(r => ({
    dayOfWeek: String(pickNested(r, 'segments', 'segments')?.day_of_week || pickNested(r, 'segments', 'segments')?.dayOfWeek || ''),
    hour: Number(pickNested(r, 'segments', 'segments')?.hour || 0),
    impressions: Number(pickNested(r, 'metrics', 'metrics')?.impressions || 0),
  }));
}
