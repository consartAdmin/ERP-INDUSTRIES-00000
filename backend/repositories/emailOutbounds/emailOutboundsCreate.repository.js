// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsCreate.repository.js — insertOutbound                ║
// ║ ON CONFLICT (message_id) DO NOTHING (UNIQUE parcial)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_OUTBOUNDS_TABLE } from './emailOutbounds.constants.js';
import { withClient } from './emailOutbounds.utils.js';
import { normalizeOutboundPayload } from './emailOutbounds.sanitizers.js';

export async function insertOutbound(pgPool, emailPayload) {
  const d = normalizeOutboundPayload(emailPayload);

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      INSERT INTO ${EMAIL_OUTBOUNDS_TABLE}
        (account_id,
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
         request_id)
      VALUES
        ($1,
         $2,$3,$4,$5,$6,$7,$8,
         COALESCE($9, NOW()),
         NOW(),
         $10,$11,$12,$13,
         COALESCE($14,0),
         COALESCE($15,0),
         $16,$17,$18)
      ON CONFLICT (message_id) DO NOTHING
      RETURNING *;
      `,
      [
        d.account_id,                // $1
        d.from_address,              // $2  NOT NULL
        d.to_address,                // $3  NOT NULL
        d.cc_address,                // $4
        d.bcc_address,               // $5
        d.subject,                   // $6
        d.body_text,                 // $7
        d.body_html,                 // $8
        d.sent_at,                   // $9
        d.message_id,                // $10
        d.provider_status,           // $11
        d.provider_error,            // $12
        d.provider,                  // $13
        d.attachments_count,         // $14
        d.attachments_total_bytes,   // $15
        d.attachments_meta,          // $16
        d.attachments_ref,           // $17
        d.request_id,                // $18
      ]
    );


    return rows[0] || null;
  });
}
