// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingOverviewController.js — Tracking Overview (MVs)              ║
// ║ CONSART ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as Overview from '../services/apis/trackingOverviewApi.js';

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, e, status = 500) => res.status(status).json({ ok: false, error: String(e?.message || e) });

export async function overview(req, res) {
  try {
    const hours = req.query.hours;
    const data = await Overview.overview({ hours });
    ok(res, data);
  } catch (e) { fail(res, e); }
}

export async function topEvents(req, res) {
  try {
    const { hours, limit } = req.query;
    const data = await Overview.topEvents({ hours, limit });
    ok(res, data);
  } catch (e) { fail(res, e); }
}

export async function funnel(req, res) {
  try {
    const hours = req.query.hours;
    const data = await Overview.funnel({ hours });
    ok(res, data);
  } catch (e) { fail(res, e); }
}

export async function realtime(req, res) {
  try {
    const limit = req.query.limit;
    const data = await Overview.realtime({ limit });
    ok(res, data);
  } catch (e) { fail(res, e); }
}
