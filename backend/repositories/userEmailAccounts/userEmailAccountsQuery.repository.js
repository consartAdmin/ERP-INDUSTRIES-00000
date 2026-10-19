// ╔════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsQuery.repository.js — getById / list /            ║
// ║ listByUserId / listByEmailAccountId                                ║
// ║ Tabela: public."userEmailAccounts"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  USER_EMAIL_ACCOUNTS_TABLE,
  USERS_TABLE,
  EMAIL_ACCOUNTS_TABLE,
} from './userEmailAccounts.constants.js';
import { toBool, toInt, toIntOrNull } from './userEmailAccounts.sanitizers.js';
import { buildBaseSelect } from './userEmailAccounts.sql.js';
import { withClient } from './userEmailAccounts.utils.js';

export async function getById(pgPool, id) {
  const rowId = toIntOrNull(id);
  if (!rowId) return null;

  return withClient(pgPool, async (client) => {
    const sql = `
      ${buildBaseSelect()}
      WHERE uea.id = $1
      LIMIT 1
    `;
    const { rows } = await client.query(sql, [rowId]);
    return rows[0] || null;
  });
}

export async function list(pgPool, filters = {}) {
  const page = Math.max(1, toInt(filters.page, 1));
  const pageSize = Math.min(200, Math.max(1, toInt(filters.pageSize, 50)));
  const offset = (page - 1) * pageSize;

  const clauses = [];
  const params = [];
  let p = 1;

  const userId = toIntOrNull(filters.user_id);
  const emailAccountId = toIntOrNull(filters.email_account_id);
  const isDefault =
    filters.is_default === '' || filters.is_default === undefined
      ? null
      : toBool(filters.is_default, false);
  const canRead =
    filters.can_read === '' || filters.can_read === undefined
      ? null
      : toBool(filters.can_read, true);
  const canSend =
    filters.can_send === '' || filters.can_send === undefined
      ? null
      : toBool(filters.can_send, true);

  if (userId) {
    clauses.push(`uea.user_id = $${p++}`);
    params.push(userId);
  }

  if (emailAccountId) {
    clauses.push(`uea.email_account_id = $${p++}`);
    params.push(emailAccountId);
  }

  if (isDefault !== null) {
    clauses.push(`uea.is_default = $${p++}`);
    params.push(isDefault);
  }

  if (canRead !== null) {
    clauses.push(`uea.can_read = $${p++}`);
    params.push(canRead);
  }

  if (canSend !== null) {
    clauses.push(`uea.can_send = $${p++}`);
    params.push(canSend);
  }

  if (filters.q) {
    clauses.push(`
      (
        CAST(uea.id AS TEXT) ILIKE $${p}
        OR CAST(uea.user_id AS TEXT) ILIKE $${p}
        OR CAST(uea.email_account_id AS TEXT) ILIKE $${p}
        OR COALESCE(u.name, '') ILIKE $${p}
        OR COALESCE(u.email, '') ILIKE $${p}
        OR COALESCE(ea.label, '') ILIKE $${p}
        OR COALESCE(ea.email_address, '') ILIKE $${p}
      )
    `);
    params.push(`%${String(filters.q).trim()}%`);
    p++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  return withClient(pgPool, async (client) => {
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM ${USER_EMAIL_ACCOUNTS_TABLE} uea
      LEFT JOIN ${USERS_TABLE} u ON u.id = uea.user_id
      LEFT JOIN ${EMAIL_ACCOUNTS_TABLE} ea ON ea.id = uea.email_account_id
      ${where}
    `;
    const countRes = await client.query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const listSql = `
      ${buildBaseSelect()}
      ${where}
      ORDER BY uea.id ASC
      LIMIT $${p++}
      OFFSET $${p++}
    `;
    const listParams = [...params, pageSize, offset];
    const { rows } = await client.query(listSql, listParams);

    return {
      items: rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}

export async function listByUserId(pgPool, userId) {
  const uid = toIntOrNull(userId);
  if (!uid) return [];

  return withClient(pgPool, async (client) => {
    const sql = `
      ${buildBaseSelect()}
      WHERE uea.user_id = $1
      ORDER BY uea.is_default DESC, uea.id ASC
    `;
    const { rows } = await client.query(sql, [uid]);
    return rows;
  });
}

export async function listByEmailAccountId(pgPool, emailAccountId) {
  const eid = toIntOrNull(emailAccountId);
  if (!eid) return [];

  return withClient(pgPool, async (client) => {
    const sql = `
      ${buildBaseSelect()}
      WHERE uea.email_account_id = $1
      ORDER BY uea.is_default DESC, uea.id ASC
    `;
    const { rows } = await client.query(sql, [eid]);
    return rows;
  });
}
