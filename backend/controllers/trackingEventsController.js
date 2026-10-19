// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingEventsController.js — Realtime Tracking Events              ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

export async function getRealtimeEvents(req, res) {
  try {
    const { from, to, campaignId } = req.query;

    const params = [];
    const where = [];

    if (from) {
      params.push(from);
      where.push(`created_at >= $${params.length}`);
    }

    if (to) {
      params.push(`${to} 23:59:59`);
      where.push(`created_at <= $${params.length}`);
    }

    if (campaignId) {
      params.push(campaignId);
      where.push(`campaign_id = $${params.length}`);
    }

    const sql = `
      SELECT
        to_char(created_at, 'HH24:MI:SS') AS time,
        event,
        page,
        product,
        sku,
        qty,
        value,
        session_id AS session
      FROM tracking_events
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, params);

    res.json({
      ok: true,
      data: {
        updatedAt: new Date().toLocaleTimeString('pt-BR'),
        rows,
      },
    });

  } catch (err) {
    console.error('[trackingEventsController] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
