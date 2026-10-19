// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsHttpController.js — Endpoints HTTP p/ E-mails Saída   ║
// ║ CONSART ERP — Rochin Air                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

/* --------------------------------------------------------------------- */
/* GET /api/email/outbounds — Lista últimos e-mails enviados             */
/* --------------------------------------------------------------------- */
export async function listOutboundEmails(req, res) {
  const limit = Number(req.query.limit || 50);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id,
              from_address,
              to_address,
              to_address,
              cc_address,
              bcc_address,
              subject,
              body_text,
              body_html,
              sent_at,
              created_at,
              message_id
              provider_status,
              provider_error,
              provider
         FROM public."emailOutbounds"
         ORDER BY sent_at DESC
         LIMIT $1`,
      [limit],
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('[emailOutboundsHttpController] Error listing outbounds:', err);
    return res.status(500).json({ error: 'Error listing outbound emails.' });
  } finally {
    client.release();
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/email/outbounds/:id — Detalhes completos                     */
/* --------------------------------------------------------------------- */
export async function getOutboundEmailById(req, res) {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id,
              from_address,
              to_address,
              to_address,
              cc_address,
              bcc_address,
              subject,
              body_text,
              body_html,
              sent_at,
              created_at,
              message_id
              provider_status,
              provider_error,
              provider
         FROM public."emailOutbounds"
         WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Outbound email not found.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('[emailOutboundsHttpController] Error fetching outbound:', err);
    return res.status(500).json({ error: 'Error fetching outbound email.' });
  } finally {
    client.release();
  }
}
