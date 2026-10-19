// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsQuery.repository.js — listOutbounds / getOutboundById║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_OUTBOUNDS_TABLE } from './emailOutbounds.constants.js';
import { withClient } from './emailOutbounds.utils.js';
import { toIntOrNull } from './emailOutbounds.sanitizers.js';

export async function listOutbounds(pgPool, { limit = 50, offset = 0, account_id = null } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), 200)
    : 50;

  const off = Number.isFinite(Number(offset)) && Number(offset) >= 0
    ? Number(offset)
    : 0;

  const acc = toIntOrNull(account_id);

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      SELECT
        id,
        account_id,
        from_address,
        to_address,
        cc_address,
        bcc_address,
        subject,
        body_text,
        body_html,
        sent_at,
        created_at,
        message_id,
        provider_status,
        provider_error,
        provider,
        attachments_count,
        attachments_total_bytes,
        attachments_meta,
        attachments_ref,
        request_id
      FROM ${EMAIL_OUTBOUNDS_TABLE}
      WHERE ($3::bigint IS NULL OR account_id = $3::bigint)
      ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
      LIMIT $1 OFFSET $2;
      `,
      [lim, off, acc]
    );
    return rows;
  });
}

export async function getOutboundById(pgPool, id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      SELECT
        id,
        account_id,
        from_address,
        to_address,
        cc_address,
        bcc_address,
        subject,
        body_text,
        body_html,
        sent_at,
        created_at,
        message_id,
        provider_status,
        provider_error,
        provider,
        attachments_count,
        attachments_total_bytes,
        attachments_meta,
        attachments_ref,
        request_id
      FROM ${EMAIL_OUTBOUNDS_TABLE}
      WHERE id = $1;
      `,
      [numericId]
    );
    return rows[0] || null;
  });
}
