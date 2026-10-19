// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsLinks.repository.js — checagens de existência e   ║
// ║ controle de is_default (uso interno, recebe client da transação)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  USER_EMAIL_ACCOUNTS_TABLE,
  USERS_TABLE,
  EMAIL_ACCOUNTS_TABLE,
} from './userEmailAccounts.constants.js';

export async function ensureUserExists(client, userId) {
  const sql = `
    SELECT id
    FROM ${USERS_TABLE}
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [userId]);
  return rows[0] || null;
}

export async function ensureEmailAccountExists(client, emailAccountId) {
  const sql = `
    SELECT id
    FROM ${EMAIL_ACCOUNTS_TABLE}
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [emailAccountId]);
  return rows[0] || null;
}

export async function clearDefaultFromOtherLinks(client, { user_id, except_id = null }) {
  const params = [user_id];
  let sql = `
    UPDATE ${USER_EMAIL_ACCOUNTS_TABLE}
       SET is_default = false
     WHERE user_id = $1
  `;

  if (except_id) {
    params.push(except_id);
    sql += ` AND id <> $2`;
  }

  await client.query(sql, params);
}

export async function maybePromoteOneDefault(client, user_id) {
  const hasDefaultSql = `
    SELECT id
      FROM ${USER_EMAIL_ACCOUNTS_TABLE}
     WHERE user_id = $1
       AND is_default = true
     LIMIT 1
  `;
  const hasDefault = await client.query(hasDefaultSql, [user_id]);
  if (hasDefault.rowCount > 0) return;

  const pickSql = `
    SELECT id
      FROM ${USER_EMAIL_ACCOUNTS_TABLE}
     WHERE user_id = $1
     ORDER BY id ASC
     LIMIT 1
  `;
  const picked = await client.query(pickSql, [user_id]);
  if (picked.rowCount === 0) return;

  await client.query(
    `
      UPDATE ${USER_EMAIL_ACCOUNTS_TABLE}
         SET is_default = true
       WHERE id = $1
    `,
    [picked.rows[0].id]
  );
}
