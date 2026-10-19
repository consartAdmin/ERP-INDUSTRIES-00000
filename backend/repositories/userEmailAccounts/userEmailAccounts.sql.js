// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccounts.sql.js — SELECT base (JOIN users + emailAccounts)║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  USER_EMAIL_ACCOUNTS_TABLE,
  USERS_TABLE,
  EMAIL_ACCOUNTS_TABLE,
} from './userEmailAccounts.constants.js';

export function buildBaseSelect() {
  return `
    SELECT
      uea.id,
      uea.user_id,
      uea.email_account_id,
      uea.is_default,
      uea.can_read,
      uea.can_send,
      uea.created_at,

      u.id AS user_ref_id,
      u.name AS user_name,
      u.email AS user_email,
      u.access_level AS user_access_level,
      u.is_active AS user_is_active,

      ea.id AS email_account_ref_id,
      ea.label AS email_account_label,
      ea.email_address AS email_account_address,
      ea.provider AS email_account_provider,
      ea.is_active AS email_account_is_active

    FROM ${USER_EMAIL_ACCOUNTS_TABLE} uea
    LEFT JOIN ${USERS_TABLE} u
      ON u.id = uea.user_id
    LEFT JOIN ${EMAIL_ACCOUNTS_TABLE} ea
      ON ea.id = uea.email_account_id
  `;
}
