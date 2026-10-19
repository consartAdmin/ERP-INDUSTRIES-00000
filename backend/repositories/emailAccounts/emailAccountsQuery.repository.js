// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailAccountsQuery.repository.js — listAccounts / getAccountById   ║
// ║ includeSecrets (somente quando solicitado)                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_ACCOUNTS_TABLE } from './emailAccounts.constants.js';
import { withClient } from './emailAccounts.utils.js';
import { toBool, normStr } from './emailAccounts.sanitizers.js';

export async function listAccounts(pgPool, { onlyActive = true, search = '', limit = 100, offset = 0 } = {}) {
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), 200)
    : 100;

  const off = Number.isFinite(Number(offset)) && Number(offset) >= 0
    ? Number(offset)
    : 0;

  const wantOnlyActive = toBool(onlyActive, true);
  const q = normStr(search);

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
    SELECT
      id, label, email_address, provider,
      smtp_host, smtp_port, smtp_secure, smtp_user,
      imap_host, imap_port, imap_secure, imap_user,
      is_active, created_at, updated_at
    FROM ${EMAIL_ACCOUNTS_TABLE}
    WHERE
      (($1::boolean IS FALSE) OR (is_active IS TRUE))
      AND (
        $2::text = ''
        OR label ILIKE ('%' || $2 || '%')
        OR email_address ILIKE ('%' || $2 || '%')
        OR provider ILIKE ('%' || $2 || '%')
        OR smtp_host ILIKE ('%' || $2 || '%')
        OR COALESCE(imap_host, '') ILIKE ('%' || $2 || '%')
      )
    ORDER BY is_active DESC, label ASC, id ASC
    LIMIT $3 OFFSET $4;
    `,
      [wantOnlyActive, q, lim, off]
    );
    return rows;
  });
}

export async function getAccountById(pgPool, id, { includeSecrets = false } = {}) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      includeSecrets
        ? `
          SELECT *
          FROM ${EMAIL_ACCOUNTS_TABLE}
          WHERE id = $1;
          `
        : `
          SELECT
            id, label, email_address, provider,
            smtp_host, smtp_port, smtp_secure, smtp_user,
            imap_host, imap_port, imap_secure, imap_user,
            is_active, created_at, updated_at
          FROM ${EMAIL_ACCOUNTS_TABLE}
          WHERE id = $1;
          `,
      [numericId]
    );
    return rows[0] || null;
  });
}
