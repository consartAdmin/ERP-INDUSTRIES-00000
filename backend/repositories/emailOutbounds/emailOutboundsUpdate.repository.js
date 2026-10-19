// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsUpdate.repository.js — updateStatus                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_OUTBOUNDS_TABLE } from './emailOutbounds.constants.js';
import { withClient } from './emailOutbounds.utils.js';
import { safeDate } from './emailOutbounds.sanitizers.js';

export async function updateStatus(pgPool, id, patch = {}) {
  const provider_status = patch.provider_status ?? patch.providerStatus ?? null;
  const provider_error  = patch.provider_error ?? patch.providerError ?? null;
  const message_id      = patch.message_id ?? patch.messageId ?? null;
  const sent_at         = safeDate(patch.sent_at ?? patch.sentAt);

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      UPDATE ${EMAIL_OUTBOUNDS_TABLE}
         SET provider_status = COALESCE($2, provider_status),
             provider_error  = COALESCE($3, provider_error),
             message_id      = COALESCE($4, message_id),
             sent_at         = COALESCE($5, sent_at)
       WHERE id = $1
      RETURNING *;
      `,
      [id, provider_status, provider_error, message_id, sent_at]
    );
    return rows[0] || null;
  });
}
