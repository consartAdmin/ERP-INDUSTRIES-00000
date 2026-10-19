// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsController.js — Campaign Details API         ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                      ║
// ║ ✅ GAQL Reports (READ)                                               ║
// ║ ✅ Events ingest (DB) + Realtime Events (DB)                          ║
// ║ ✅ Offline Conversions (WRITE)                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import * as CampaignApi from '../repositories/googleAdsCampaignDetails/googleAdsCampaignDetails.index.js';

import {
  mustRange,
  parseLimit,
  getRealtimeEvents,
  dispatchOfflineConversion,
} from '../services/googleAds/googleAdsCampaignDetailsRealTime.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const ok = (res, data, status = 200) => res.status(status).json({ ok: true, data });

const fail = (res, e, status = 500) => {
  const code = Number(e?.status || status);
  const error = String(e?.message || e);
  console.error('[googleAdsCampaignDetailsController]', { error, stack: e?.stack || null });
  return res.status(code).json({ ok: false, error });
};

function isDateYMD(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toISODate(d) {
  const z = new Date(d);
  const yyyy = z.getUTCFullYear();
  const mm = String(z.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(z.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ clamp range para no máximo 30 dias (Google Ads "changes" costuma limitar)
function clampToLast30Days(from, to) {
  const toD = new Date(`${to}T00:00:00Z`);
  const fromD = new Date(`${from}T00:00:00Z`);
  const diffDays = Math.floor((toD - fromD) / (1000 * 60 * 60 * 24));

  if (Number.isFinite(diffDays) && diffDays > 30) {
    const newFrom = new Date(toD);
    newFrom.setUTCDate(newFrom.getUTCDate() - 30);
    return { from: toISODate(newFrom), to };
  }
  return { from, to };
}

/* ------------------------------------------------------------------ */
/* ✅ EVENTS (DB) — NEW BASE ROUTES                                     */
/* ------------------------------------------------------------------ */

// POST /api/googleAdsCampaignDetails/events
// body: { event, page, sku, qty, value, session_id, campaign_id, product? }
export async function ingestEventToDb(req, res) {
  try {
    const b = req.body || {};

    // mínimos
    const event = String(b.event || '').trim();
    const page = String(b.page || '').trim();

    if (!event) return fail(res, new Error('Campo obrigatório: event'), 400);
    if (!page) return fail(res, new Error('Campo obrigatório: page'), 400);

    const sku = b.sku != null ? String(b.sku) : null;
    const qty = b.qty != null ? Number(b.qty) : null;
    const value = b.value != null ? Number(b.value) : null;
    const sessionId = b.session_id != null ? String(b.session_id) : (b.sessionId != null ? String(b.sessionId) : null);
    const campaignId = b.campaign_id != null ? String(b.campaign_id) : (b.campaignId != null ? String(b.campaignId) : null);

    // OBS: sua tabela (print) não tem coluna "product".
    // Se você quiser persistir isso, o ideal é criar uma coluna product ou jsonb.
    // Por enquanto, a API aceita mas não salva.
    const sql = `
      INSERT INTO public.tracking_events (event, page, sku, qty, value, session_id, campaign_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, created_at, event, page, sku, qty, value, session_id, campaign_id
    `;

    const params = [event, page, sku, qty, value, sessionId, campaignId];
    const { rows } = await pool.query(sql, params);

    return ok(res, { row: rows?.[0] || null });
  } catch (e) {
    return fail(res, e);
  }
}

// GET /api/googleAdsCampaignDetails/events/realtime?from&to&limit&campaignId=...
export async function realtimeEventsByQuery(req, res) {
  try {
    const { from, to } = mustRange(req.query);
    const limit = parseLimit(req.query.limit, 50, 200);
    const campaignId = req.query.campaignId ? String(req.query.campaignId) : '';

    const data = await getRealtimeEvents({ from, to, limit, campaignId });
    return ok(res, data);
  } catch (e) {
    return fail(res, e);
  }
}

/* ------------------------------------------------------------------ */
/* Basic endpoints (GAQL)                                              */
/* ------------------------------------------------------------------ */

// GET /api/.../campaigns/stats?from&to
export async function campaignStats(req, res) {
  try {
    const { customerId } = req.query;
    const { from, to } = mustRange(req.query);

    const rows = await CampaignApi.listCampaignStats({ customerId, from, to });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

// GET /api/.../campaigns/:campaignId/details?from&to
export async function campaignDetails(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const [header, kpis] = await Promise.all([
      CampaignApi.getCampaignHeader({ customerId, campaignId }),
      CampaignApi.getCampaignKpis({ customerId, campaignId, from, to }),
    ]);

    if (!header) return fail(res, new Error(`Campanha não encontrada (campaignId=${campaignId})`), 404);

    return ok(res, { header, kpis, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignTimeseries(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const rows = await CampaignApi.getCampaignTimeseries({ customerId, campaignId, from, to });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignDevices(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const rows = await CampaignApi.getCampaignDevices({ customerId, campaignId, from, to });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignDemographics(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const rows = await CampaignApi.getCampaignDemographics({ customerId, campaignId, from, to });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignWeekdayHour(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const rows = await CampaignApi.getCampaignWeekdayHour({ customerId, campaignId, from, to });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignKeywords(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const limit = parseLimit(req.query.limit, 200, 200);

    const rows = await CampaignApi.getCampaignKeywords({ customerId, campaignId, from, to, limit });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignSearchTerms(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const limit = parseLimit(req.query.limit, 200, 200);

    const rows = await CampaignApi.getCampaignSearchTerms({ customerId, campaignId, from, to, limit });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignAds(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const limit = parseLimit(req.query.limit, 200, 200);

    const rows = await CampaignApi.getCampaignAds({ customerId, campaignId, from, to, limit });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function campaignGeo(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const limit = parseLimit(req.query.limit, 200, 200);

    const rows = await CampaignApi.getCampaignGeo({ customerId, campaignId, from, to, limit });
    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

/* ------------------------------------------------------------------ */
/* ✅ CHANGES (Google Ads) — exige from/to e limita 30 dias             */
/* ------------------------------------------------------------------ */
// GET /api/.../campaigns/:campaignId/changes?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
export async function campaignChanges(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;

    const r = mustRange(req.query);
    let from = r.from;
    let to = r.to;

    // clamp 30 dias (evita: "start date too old")
    ({ from, to } = clampToLast30Days(from, to));

    const limit = parseLimit(req.query.limit, 200, 200);

    const rows = await CampaignApi.getCampaignChanges({
      customerId,
      campaignId,
      from,
      to,
      limit,
    });

    return ok(res, { rows, range: { from, to } });
  } catch (e) {
    return fail(res, e);
  }
}

/* ------------------------------------------------------------------ */
/* ✅ REALTIME EVENTS (DB) por campaign                                 */
/* ------------------------------------------------------------------ */
// GET /api/.../campaigns/:campaignId/events/realtime?from&to&limit
export async function campaignRealtimeEvents(req, res) {
  try {
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);
    const limit = parseLimit(req.query.limit, 50, 200);

    const data = await getRealtimeEvents({ from, to, limit, campaignId });
    return ok(res, data);
  } catch (e) {
    return fail(res, e);
  }
}

/* ------------------------------------------------------------------ */
/* ✅ DISPATCH OFFLINE CONVERSION (GOOGLE ADS)                           */
/* ------------------------------------------------------------------ */
// POST /api/.../campaigns/:campaignId/events/dispatch
export async function dispatchEventToGoogleAds(req, res) {
  try {
    const b = req.body || {};

    const data = await dispatchOfflineConversion({
      event: b.event,
      gclid: b.gclid,
      value: b.value,
      currencyCode: b.currencyCode || 'BRL',
      conversionDateTime: b.conversionDateTime,
      requestId: b.requestId || b.session || '',
    });

    return ok(res, data);
  } catch (e) {
    return fail(res, e);
  }
}

/* ------------------------------------------------------------------ */
/* FULL endpoint (SAFE)                                                */
/* ------------------------------------------------------------------ */
// GET /api/.../campaigns/:campaignId/full?from&to
export async function campaignFull(req, res) {
  try {
    const { customerId } = req.query;
    const { campaignId } = req.params;
    const { from, to } = mustRange(req.query);

    const tasks = {
      header:       () => CampaignApi.getCampaignHeader({ customerId, campaignId }),
      kpis:         () => CampaignApi.getCampaignKpis({ customerId, campaignId, from, to }),
      timeseries:   () => CampaignApi.getCampaignTimeseries({ customerId, campaignId, from, to }),
      devices:      () => CampaignApi.getCampaignDevices({ customerId, campaignId, from, to }),
      demographics: () => CampaignApi.getCampaignDemographics({ customerId, campaignId, from, to }),
      weekdayHour:  () => CampaignApi.getCampaignWeekdayHour({ customerId, campaignId, from, to }),
      keywords:     () => CampaignApi.getCampaignKeywords({ customerId, campaignId, from, to, limit: 200 }),
      searchTerms:  () => CampaignApi.getCampaignSearchTerms({ customerId, campaignId, from, to, limit: 200 }),
      ads:          () => CampaignApi.getCampaignAds({ customerId, campaignId, from, to, limit: 200 }),
      geo:          () => CampaignApi.getCampaignGeo({ customerId, campaignId, from, to, limit: 200 }),

      // ✅ changes agora usa from/to e clamp 30d no CampaignApi (via controller call)
      changes:      () => CampaignApi.getCampaignChanges({ customerId, campaignId, from, to, limit: 200 }),
    };

    const entries = Object.entries(tasks);
    const settled = await Promise.allSettled(entries.map(([, fn]) => fn()));

    const data = { range: { from, to }, errors: {} };

    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0];
      const result = settled[i];

      if (result.status === 'fulfilled') {
        data[key] = result.value;
      } else {
        console.error(`[campaignFull] section failed: ${key}`, result.reason);
        data[key] = [];
        data.errors[key] = String(result.reason?.message || result.reason);
      }
    }

    if (!data.header) return fail(res, new Error(`Campanha não encontrada (campaignId=${campaignId})`), 404);

    return ok(res, data);
  } catch (e) {
    return fail(res, e);
  }
}
