// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsQuery.repository.js — list / getById / countUnread    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_INBOUNDS_TABLE } from './emailInbounds.constants.js';
import { log, warn, withClient } from './emailInbounds.utils.js';
import { toPositiveIntOrNull, toSafeLimit, toSafeOffset } from './emailInbounds.sanitizers.js';
import { normalizeRow } from './emailInbounds.mappers.js';

export async function listInbounds(
  pgPool,
  { account_id = null, limit = 50, offset = 0 } = {}
) {
  const accountId = toPositiveIntOrNull(account_id);
  const safeLimit = toSafeLimit(limit, 50, 200);
  const safeOffset = toSafeOffset(offset, 0);

  log('LIST_START', {
    account_id_raw: account_id,
    account_id: accountId,
    limit_raw: limit,
    limit: safeLimit,
    offset_raw: offset,
    offset: safeOffset,
  });

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      SELECT
        id,
        account_id,
        imap_uid,
        from_address,
        to_address,
        subject,
        body_text,
        body_html,
        received_at,
        created_at,
        is_read,
        attachments_meta
      FROM ${EMAIL_INBOUNDS_TABLE}
      WHERE ($1::bigint IS NULL OR account_id = $1)
      ORDER BY received_at DESC NULLS LAST, id DESC
      LIMIT $2 OFFSET $3;
      `,
      [accountId, safeLimit, safeOffset]
    );

    const normalizedRows = rows.map(normalizeRow);

    log('LIST_RESULT', {
      count: normalizedRows.length,
      sample: normalizedRows.slice(0, 3).map((r) => ({
        id: r.id,
        account_id: r.account_id,
        subject: r.subject,
        from_address: r.from_address,
        is_read: r.is_read,
        received_at: r.received_at,
        attachments_count: r.attachments_meta?.length || 0,
      })),
    });

    return normalizedRows;
  }, 'listInbounds');
}

export async function getInboundById(pgPool, id) {
  const numericId = toPositiveIntOrNull(id);

  log('GET_START', {
    id_raw: id,
    id: numericId,
  });

  if (!numericId) {
    throw new Error('ID inválido para emailInbounds');
  }

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      SELECT
        id,
        account_id,
        imap_uid,
        from_address,
        to_address,
        subject,
        body_text,
        body_html,
        received_at,
        created_at,
        is_read,
        attachments_meta
      FROM ${EMAIL_INBOUNDS_TABLE}
      WHERE id = $1
      LIMIT 1;
      `,
      [numericId]
    );

    const row = normalizeRow(rows[0] || null);

    if (!row) {
      warn('GET_NOT_FOUND', { id: numericId });
      return null;
    }

    log('GET_RESULT', {
      id: row.id,
      account_id: row.account_id,
      subject: row.subject,
      has_body_text: !!row.body_text,
      body_text_length: String(row.body_text || '').length,
      has_body_html: !!row.body_html,
      body_html_length: String(row.body_html || '').length,
      attachments_count: row.attachments_meta?.length || 0,
      is_read: row.is_read,
    });

    return row;
  }, 'getInboundById');
}

export async function countUnreadInbounds(pgPool, { account_id = null } = {}) {
  const accountId = toPositiveIntOrNull(account_id);

  log('COUNT_UNREAD_START', {
    account_id_raw: account_id,
    account_id: accountId,
  });

  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `
      SELECT COUNT(*)::int AS unread
      FROM ${EMAIL_INBOUNDS_TABLE}
      WHERE is_read = false
        AND ($1::bigint IS NULL OR account_id = $1);
      `,
      [accountId]
    );

    const unread = rows[0]?.unread ?? 0;

    log('COUNT_UNREAD_RESULT', {
      unread,
      account_id: accountId,
    });

    return unread;
  }, 'countUnreadInbounds');
}
