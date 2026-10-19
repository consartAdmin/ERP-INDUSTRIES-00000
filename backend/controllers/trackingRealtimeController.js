// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingRealtimeController.js — Tracking Realtime (SSE | ESM)        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  upsertSession,
  insertEvent,
  getOnlineSummary,
  getFunnel,
  getEventsPerMinute,
} from '../services/apis/trackingRealtimeApi.js';

const sseClients = new Set();

function sseSend(res, type, data) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(type, data) {
  for (const res of sseClients) {
    try { sseSend(res, type, data); } catch { /* ignore */ }
  }
}

/* --------------------------------------------------------------------- */
/* POST /api/tracking/realtime/session  → heartbeat / upsert session      */
/* --------------------------------------------------------------------- */
export async function postSession(req, res) {
  try {
    const body = req.body || {};
    const sessionId = body.sessionId;
    const userId = body.userId || null;
    const customerId = body.customerId || null;

    const page = body.page || {
      url: body.page_url || null,
      path: body.page_path || null,
      title: body.page_title || null,
    };

    const row = await upsertSession({ sessionId, userId, customerId, req, page });

    // broadcast: online snapshot (leve)
    const online = await getOnlineSummary();
    broadcast('online', online);

    res.json({ ok: true, session: row, online });
  } catch (err) {
    console.error('[postSession]', err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* POST /api/tracking/realtime/event → grava evento                       */
/* --------------------------------------------------------------------- */
export async function postEvent(req, res) {
  try {
    const body = req.body || {};
    const sessionId = body.sessionId;
    const userId = body.userId || null;
    const customerId = body.customerId || null;

    const eventName = body.eventName || body.event || body.name;
    const page = body.page || null;
    const ecommerce = body.ecommerce || null;

    // garante sessão viva
    await upsertSession({ sessionId, userId, customerId, req, page });

    const ev = await insertEvent({
      sessionId,
      userId,
      customerId,
      eventName,
      page,
      ecommerce,
      payload: body,
    });

    // broadcast: evento (pra UI ao vivo)
    broadcast('event', ev);

    // broadcast: funil rápido (se for evento-chave)
    if (['view_item_list','view_item','add_to_cart','remove_from_cart','begin_checkout','purchase'].includes(eventName)) {
      const funnel = await getFunnel({ minutes: 30 });
      broadcast('funnel', funnel);
    }

    res.status(201).json({ ok: true, event: ev });
  } catch (err) {
    console.error('[postEvent]', err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/tracking/realtime/online → número online                      */
/* --------------------------------------------------------------------- */
export async function getOnline(req, res) {
  try {
    const online = await getOnlineSummary();
    res.json({ ok: true, ...online });
  } catch (err) {
    console.error('[getOnline]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/tracking/realtime/funnel?minutes=30                           */
/* --------------------------------------------------------------------- */
export async function getFunnelStats(req, res) {
  try {
    const minutes = Number(req.query.minutes || 30);
    const data = await getFunnel({ minutes });
    res.json({ ok: true, minutes, data });
  } catch (err) {
    console.error('[getFunnelStats]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/tracking/realtime/events-per-minute?minutes=30                */
/* --------------------------------------------------------------------- */
export async function getEventsMinute(req, res) {
  try {
    const minutes = Number(req.query.minutes || 30);
    const data = await getEventsPerMinute({ minutes });
    res.json({ ok: true, minutes, data });
  } catch (err) {
    console.error('[getEventsMinute]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/tracking/realtime/stream → SSE (painel ao vivo)               */
/* --------------------------------------------------------------------- */
export async function streamRealtime(req, res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');

  // CORS para SSE (se necessário)
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.write('\n');
  sseClients.add(res);

  // snapshot inicial
  try {
    const online = await getOnlineSummary();
    const funnel = await getFunnel({ minutes: 30 });
    sseSend(res, 'online', online);
    sseSend(res, 'funnel', funnel);
    sseSend(res, 'hello', { ok: true, ts: new Date().toISOString() });
  } catch (e) {
    // ignore
  }

  req.on('close', () => {
    sseClients.delete(res);
  });
}
