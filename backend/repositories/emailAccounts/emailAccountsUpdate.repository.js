// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailAccountsUpdate.repository.js — updateAccount                  ║
// ║ update NÃO sobrescreve senha quando patch não envia                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_ACCOUNTS_TABLE } from './emailAccounts.constants.js';
import { withClient } from './emailAccounts.utils.js';
import { normalizePatchPayload } from './emailAccounts.sanitizers.js';

export async function updateAccount(pgPool, id, patch) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const d = normalizePatchPayload(patch);

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      UPDATE ${EMAIL_ACCOUNTS_TABLE}
         SET label         = COALESCE(NULLIF($2,''), label),
             email_address = COALESCE(NULLIF($3,''), email_address),
             provider      = COALESCE(NULLIF($4,''), provider),

             smtp_host     = COALESCE(NULLIF($5,''), smtp_host),
             smtp_port     = COALESCE($6, smtp_port),
             smtp_secure   = COALESCE($7, smtp_secure),
             smtp_user     = COALESCE(NULLIF($8,''), smtp_user),
             smtp_pass     = CASE WHEN $9::boolean IS TRUE THEN COALESCE(NULLIF($10,''), smtp_pass) ELSE smtp_pass END,

             imap_host     = COALESCE($11, imap_host),
             imap_port     = COALESCE($12, imap_port),
             imap_secure   = COALESCE($13, imap_secure),
             imap_user     = COALESCE($14, imap_user),
             imap_pass     = CASE WHEN $15::boolean IS TRUE THEN COALESCE($16, imap_pass) ELSE imap_pass END,

             is_active     = COALESCE($17, is_active),
             updated_at    = NOW()
       WHERE id = $1
      RETURNING *;
      `,
      [
        numericId,

        d.label || '',
        d.email_address || '',
        d.provider || '',

        d.smtp_host || '',
        Number.isFinite(d.smtp_port) ? d.smtp_port : null,
        typeof d.smtp_secure === 'boolean' ? d.smtp_secure : null,
        d.smtp_user || '',
        d.__hasSmtpPass,
        d.smtp_pass || '',

        d.imap_host,
        Number.isFinite(d.imap_port) ? d.imap_port : null,
        typeof d.imap_secure === 'boolean' ? d.imap_secure : null,
        d.imap_user,
        d.__hasImapPass,
        d.imap_pass,

        typeof d.is_active === 'boolean' ? d.is_active : null,
      ]
    );
    return rows[0] || null;
  });
}
