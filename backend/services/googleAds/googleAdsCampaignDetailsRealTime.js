// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsRealTime.js                                 ║
// ║ Realtime Events (DB) + Offline Conversions (Google Ads)              ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  uploadClickConversion,
  mapEventToConversionAction,
} from './googleAdsEvents.js';
import { getConfig as getTrackingConfig } from '../apis/trackingConfigApi.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
export function mustRange(q) {
  const { from, to } = q || {};
  if (!from || !to) {
    const err = new Error('Parâmetros obrigatórios: from e to (YYYY-MM-DD)');
    err.status = 400;
    throw err;
  }

  const f = String(from).slice(0, 10);
  const t = String(to).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const err = new Error('from/to devem estar no formato YYYY-MM-DD');
    err.status = 400;
    throw err;
  }

  return { from: f, to: t };
}

export function parseLimit(v, def = 50, max = 200) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.trunc(n), max);
}

/* ------------------------------------------------------------------ */
/* Realtime events (DB)                                                */
/* ------------------------------------------------------------------ */
export async function getRealtimeEvents({ from, to, limit = 50, campaignId }) {
  const params = [from, to, limit];
  let whereCampaign = '';

  if (campaignId) {
    whereCampaign = 'AND campaign_id = $4';
    params.splice(2, 0, campaignId); // before limit
  }

  const { rows } = await pool.query(
    `
    SELECT
      created_at,
      event,
      page,
      product,
      sku,
      qty,
      value,
      session_id,
      campaign_id
    FROM public.tracking_events
    WHERE created_at::date BETWEEN $1::date AND $2::date
      ${whereCampaign}
    ORDER BY created_at DESC
    LIMIT $${params.length}
    `,
    params
  );

  return {
    rows: rows.map(r => ({
      time: r.created_at,
      event: r.event,
      page: r.page,
      product: r.product,
      sku: r.sku,
      qty: r.qty,
      value: r.value,
      session: r.session_id,
      campaignId: r.campaign_id,
    })),
    range: { from, to },
    updatedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
  };
}

/* ------------------------------------------------------------------ */
/* Offline conversion dispatch (Google Ads)                            */
/* ------------------------------------------------------------------ */
export async function dispatchOfflineConversion({
  event,
  gclid,
  value = 0,
  currencyCode = 'BRL',
  conversionDateTime,
  requestId = '',
}) {
  const cfg = await getTrackingConfig();

  if (!cfg?.ads_enabled) {
    const err = new Error('Google Ads tracking está desativado.');
    err.status = 400;
    throw err;
  }

  if (!event) {
    const err = new Error('Campo obrigatório: event');
    err.status = 400;
    throw err;
  }

  if (!gclid) {
    const err = new Error('Campo obrigatório: gclid');
    err.status = 400;
    throw err;
  }

  const conversionActionResourceName =
    mapEventToConversionAction(event);

  if (!conversionActionResourceName) {
    const err = new Error(`Evento não mapeado para conversão: ${event}`);
    err.status = 400;
    throw err;
  }

  const dateTime =
    conversionDateTime ||
    new Date().toISOString().replace('T', ' ').slice(0, 19) + '-03:00';

  const response = await uploadClickConversion({
    conversionActionResourceName,
    gclid,
    conversionDateTime: dateTime,
    value: Number(value || 0),
    currencyCode,
    requestId,
  });

  return {
    sent: true,
    event,
    value,
    response,
  };
}
