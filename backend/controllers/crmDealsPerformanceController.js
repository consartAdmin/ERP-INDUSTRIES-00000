// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmDealsPerformanceController.js — CRM Performance (REST) ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                      ║
// ║ Base: /api/crm/reativacao                                            ║
// ║   GET /performance  ?startDate&endDate&sellerId                      ║
// ║   GET /actions       ?startDate&endDate&sellerId&actionType&q        ║
// ║                    &limit&offset                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import perfApi from '../repositories/crmDealsPerformance/crmDealsPerformance.index.js';

function toInt(v, def = undefined) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : def;
}

function safeTrim(v) {
  const s = (v ?? '').toString().trim();
  return s ? s : null;
}

export async function getPerformance(req, res) {
  try {
    const startDate = req.query.startDate || req.query.start || null;
    const endDate = req.query.endDate || req.query.end || null;
    const sellerId = toInt(req.query.sellerId || req.query.seller_id, null);

    const r = await perfApi.getSellerPerformance({ startDate, endDate, sellerId });
    return res.status(r?.ok ? 200 : (r?.status || 400)).json(r);
  } catch (err) {
    console.error('[crmDealsReativationPerformanceController.getPerformance]', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export async function listActions(req, res) {
  try {
    const startDate = req.query.startDate || req.query.start || null;
    const endDate = req.query.endDate || req.query.end || null;
    const sellerId = toInt(req.query.sellerId || req.query.seller_id, null);

    // ✅ backend: actionType (mantém compatível com "type" do frontend, se vier)
    const actionType = safeTrim(req.query.actionType || req.query.type || null);

    // ✅ busca (opcional; se o perfApi suportar)
    const q = safeTrim(req.query.q || req.query.search || '');

    const limit = toInt(req.query.limit, 50);
    const offset = toInt(req.query.offset, 0);

    const r = await perfApi.listActions({
      startDate,
      endDate,
      sellerId,
      actionType,
      q,
      limit,
      offset,
    });

    return res.status(r?.ok ? 200 : (r?.status || 400)).json(r);
  } catch (err) {
    console.error('[crmDealsReativationPerformanceController.listActions]', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
