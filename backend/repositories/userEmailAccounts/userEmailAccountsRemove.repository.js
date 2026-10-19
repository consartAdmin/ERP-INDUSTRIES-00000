// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsRemove.repository.js — remove                     ║
// ║ Tabela: public."userEmailAccounts"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { USER_EMAIL_ACCOUNTS_TABLE } from './userEmailAccounts.constants.js';
import { toIntOrNull } from './userEmailAccounts.sanitizers.js';
import { withClient } from './userEmailAccounts.utils.js';
import { maybePromoteOneDefault } from './userEmailAccountsLinks.repository.js';

export async function remove(pgPool, id) {
  const rowId = toIntOrNull(id);
  if (!rowId) return false;

  return withClient(pgPool, async (client) => {
    await client.query('BEGIN');
    try {
      const currentRes = await client.query(
        `
          SELECT id, user_id, is_default
          FROM ${USER_EMAIL_ACCOUNTS_TABLE}
          WHERE id = $1
          LIMIT 1
        `,
        [rowId]
      );

      const current = currentRes.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `
          DELETE FROM ${USER_EMAIL_ACCOUNTS_TABLE}
          WHERE id = $1
        `,
        [rowId]
      );

      await maybePromoteOneDefault(client, current.user_id);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
