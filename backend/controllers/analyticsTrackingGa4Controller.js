// ╔════════════════════════════════════════════════════════════════════╗
// ║ analyticsGa4Controller.js — GA4 Analytics API                       ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                      ║
// ║ • Realtime: usuários ativos agora (estável)                          ║
// ║ • Summary: métricas agregadas (7 dias) + screenPageViews             ║
// ╚════════════════════════════════════════════════════════════════════╝

import * as ga4 from '../repositories/analyticsTrackingGa4/analyticsTrackingGa4.index.js';

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function pickGa4Error(err) {
  return {
    message: err?.details || err?.message || 'GA4 error',
    code: err?.code,
    reason: err?.reason,
    domain: err?.domain,
    statusDetails: err?.statusDetails || null,
    metadata: err?.errorInfoMetadata || null,
  };
}

const DEBUG_RAW = process.env.ANALYTICS_DEBUG_RAW === '1';

// ---------------------------------------------------------------------
// 🔴 Realtime — usuários ativos agora
// GET /api/analytics/ga4/realtime
// ---------------------------------------------------------------------
export async function realtime(req, res) {
  try {
    const response = await ga4.getRealtime();

    const row = response.rows?.[0]?.metricValues || [];
    const activeUsers = Number(row[0]?.value || 0);

    const payload = {
      ok: true,
      activeUsers,
      timestamp: new Date().toISOString(),
    };

    if (DEBUG_RAW) payload.raw = response;

    return res.json(payload);
  } catch (err) {
    console.error('[GA4][Realtime]', err);
    return res.status(500).json({
      ok: false,
      error: 'GA4 realtime error',
      ga4: pickGa4Error(err),
    });
  }
}

// ---------------------------------------------------------------------
// 📊 Summary — métricas agregadas (7 dias)
// GET /api/analytics/ga4/summary
// ---------------------------------------------------------------------
export async function summary(req, res) {
  try {
    const response = await ga4.getSummary();

    const totals = response.totals?.[0]?.metricValues || [];

    // Ordem precisa bater com o analyticsGa4Api.js:
    // sessions, totalUsers, eventCount, conversions, screenPageViews
    const payload = {
      ok: true,
      sessions: Number(totals[0]?.value || 0),
      totalUsers: Number(totals[1]?.value || 0),
      eventCount: Number(totals[2]?.value || 0),
      conversions: Number(totals[3]?.value || 0),
      screenPageViews: Number(totals[4]?.value || 0), // ✅ Pageviews REAL
      date: new Date().toISOString(),
    };

    if (DEBUG_RAW) payload.raw = response;

    return res.json(payload);
  } catch (err) {
    console.error('[GA4][Summary]', err);
    return res.status(500).json({
      ok: false,
      error: 'GA4 summary error',
      ga4: pickGa4Error(err),
    });
  }
}
