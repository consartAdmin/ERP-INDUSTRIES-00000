// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsUpdate.repository.js — update                     ║
// ║ Tabela: public."userEmailAccounts"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { USER_EMAIL_ACCOUNTS_TABLE } from './userEmailAccounts.constants.js';
import { toIntOrNull, normalizePatch } from './userEmailAccounts.sanitizers.js';
import { withClient } from './userEmailAccounts.utils.js';
import {
  ensureUserExists,
  ensureEmailAccountExists,
  clearDefaultFromOtherLinks,
  maybePromoteOneDefault,
} from './userEmailAccountsLinks.repository.js';
import { getById } from './userEmailAccountsQuery.repository.js';

export async function update(pgPool, id, patch = {}) {
  const rowId = toIntOrNull(id);
  if (!rowId) return null;

  const normalizedPatch = normalizePatch(patch);
  const keys = Object.keys(normalizedPatch);
  if (!keys.length) return getById(pgPool, rowId);

  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');
    try {
      const currentSql = `
        SELECT *
        FROM ${USER_EMAIL_ACCOUNTS_TABLE}
        WHERE id = $1
        LIMIT 1
      `;
      const currentRes = await client.query(currentSql, [rowId]);
      const current = currentRes.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return null;
      }

      const nextUserId =
        'user_id' in normalizedPatch ? normalizedPatch.user_id : current.user_id;
      const nextEmailAccountId =
        'email_account_id' in normalizedPatch
          ? normalizedPatch.email_account_id
          : current.email_account_id;
      const nextIsDefault =
        'is_default' in normalizedPatch
          ? normalizedPatch.is_default
          : current.is_default;

      if (!nextUserId) {
        const err = new Error('user_id cannot be null');
        err.code = 'VALIDATION_ERROR';
        err.details = ['user_id cannot be null'];
        throw err;
      }

      if (!nextEmailAccountId) {
        const err = new Error('email_account_id cannot be null');
        err.code = 'VALIDATION_ERROR';
        err.details = ['email_account_id cannot be null'];
        throw err;
      }

      const user = await ensureUserExists(client, nextUserId);
      if (!user) {
        const err = new Error(`User not found for user_id=${nextUserId}`);
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      const email = await ensureEmailAccountExists(client, nextEmailAccountId);
      if (!email) {
        const err = new Error(`Email account not found for email_account_id=${nextEmailAccountId}`);
        err.code = 'EMAIL_ACCOUNT_NOT_FOUND';
        throw err;
      }

      if (nextIsDefault) {
        await clearDefaultFromOtherLinks(client, { user_id: nextUserId, except_id: rowId });
      }

      const setParts = [];
      const params = [];
      let p = 1;

      for (const key of keys) {
        setParts.push(`${key} = $${p++}`);
        params.push(normalizedPatch[key]);
      }

      params.push(rowId);

      const updateSql = `
        UPDATE ${USER_EMAIL_ACCOUNTS_TABLE}
           SET ${setParts.join(', ')}
         WHERE id = $${p}
         RETURNING id
      `;
      await client.query(updateSql, params);

      await maybePromoteOneDefault(client, nextUserId);

      if (nextUserId !== current.user_id) {
        await maybePromoteOneDefault(client, current.user_id);
      }

      await client.query('COMMIT');
      return getById(pgPool, rowId);
    } catch (error) {
      await client.query('ROLLBACK');

      if (error?.code === '23505') {
        const err = new Error('Duplicate link or conflicting default email for this user');
        err.code = 'DUPLICATE_LINK';
        throw err;
      }

      throw error;
    }
  });
}
