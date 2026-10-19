// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsCreate.repository.js — create                     ║
// ║ Tabela: public."userEmailAccounts"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { USER_EMAIL_ACCOUNTS_TABLE } from './userEmailAccounts.constants.js';
import { normalizePayload, validateCreatePayload } from './userEmailAccounts.sanitizers.js';
import { withClient } from './userEmailAccounts.utils.js';
import {
  ensureUserExists,
  ensureEmailAccountExists,
  clearDefaultFromOtherLinks,
  maybePromoteOneDefault,
} from './userEmailAccountsLinks.repository.js';
import { getById } from './userEmailAccountsQuery.repository.js';

export async function create(pgPool, input = {}) {
  const payload = normalizePayload(input);
  const errors = validateCreatePayload(payload);

  if (errors.length) {
    const err = new Error('Validation error');
    err.code = 'VALIDATION_ERROR';
    err.details = errors;
    throw err;
  }

  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');
    try {
      const user = await ensureUserExists(client, payload.user_id);
      if (!user) {
        const err = new Error(`User not found for user_id=${payload.user_id}`);
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      const email = await ensureEmailAccountExists(client, payload.email_account_id);
      if (!email) {
        const err = new Error(`Email account not found for email_account_id=${payload.email_account_id}`);
        err.code = 'EMAIL_ACCOUNT_NOT_FOUND';
        throw err;
      }

      if (payload.is_default) {
        await clearDefaultFromOtherLinks(client, { user_id: payload.user_id });
      }

      const insertSql = `
        INSERT INTO ${USER_EMAIL_ACCOUNTS_TABLE}
          (user_id, email_account_id, is_default, can_read, can_send)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      const insertParams = [
        payload.user_id,
        payload.email_account_id,
        payload.is_default,
        payload.can_read,
        payload.can_send,
      ];

      const inserted = await client.query(insertSql, insertParams);
      const id = inserted.rows[0].id;

      await maybePromoteOneDefault(client, payload.user_id);

      await client.query('COMMIT');
      return getById(pgPool, id);
    } catch (error) {
      await client.query('ROLLBACK');

      if (error?.code === '23505') {
        const err = new Error('This user is already linked to this email account');
        err.code = 'DUPLICATE_LINK';
        throw err;
      }

      throw error;
    }
  });
}
