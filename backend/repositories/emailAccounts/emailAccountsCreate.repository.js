// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailAccountsCreate.repository.js — createAccount                  ║
// ║ Tabela: public."emailAccounts"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_ACCOUNTS_TABLE } from './emailAccounts.constants.js';
import { withClient } from './emailAccounts.utils.js';
import { normalizeAccountPayload, validateAccount } from './emailAccounts.sanitizers.js';

export async function createAccount(pgPool, payload) {
  const d = normalizeAccountPayload(payload);
  const fieldErrors = validateAccount(d);
  if (fieldErrors.length) {
    const e = new Error('Validation error');
    e.fieldErrors = fieldErrors;
    e.code = 'EMAIL_ACCOUNTS_VALIDATION';
    throw e;
  }

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      INSERT INTO ${EMAIL_ACCOUNTS_TABLE}
        (label, email_address, provider,
         smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
         imap_host, imap_port, imap_secure, imap_user, imap_pass,
         is_active, created_at, updated_at)
      VALUES
        ($1,$2,$3,
         $4,$5,$6,$7,$8,
         $9,$10,$11,$12,$13,
         $14,NOW(),NOW())
      RETURNING *;
      `,
      [
        d.label, d.email_address, d.provider,
        d.smtp_host, d.smtp_port, d.smtp_secure, d.smtp_user, d.smtp_pass,
        d.imap_host, d.imap_port, d.imap_secure, d.imap_user, d.imap_pass,
        d.is_active,
      ]
    );
    return rows[0] || null;
  });
}
