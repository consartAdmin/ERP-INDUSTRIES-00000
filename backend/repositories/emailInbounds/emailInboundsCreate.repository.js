// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsCreate.repository.js — saveInboundEmail               ║
// ║ Deduplicação REAL: account_id + imap_uid                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_INBOUNDS_TABLE } from './emailInbounds.constants.js';
import { log, withClient } from './emailInbounds.utils.js';
import { normalizeEmail } from './emailInbounds.sanitizers.js';
import { normalizeRow } from './emailInbounds.mappers.js';

export async function saveInboundEmail(pgPool, account_id, email) {
  const data = normalizeEmail(email, account_id);

  log('SAVE_START', {
    account_id: data.account_id,
    imap_uid: data.imap_uid,
    subject: data.subject,
  });

  return withClient(pgPool, async (client) => {
    if (data.imap_uid != null) {
      const { rows } = await client.query(
        `
        SELECT id
        FROM ${EMAIL_INBOUNDS_TABLE}
        WHERE account_id = $1
          AND imap_uid = $2
        LIMIT 1;
        `,
        [data.account_id, data.imap_uid]
      );

      if (rows.length) {
        log('SAVE_DUPLICATE_SKIPPED', {
          existing_id: rows[0].id,
          account_id: data.account_id,
          imap_uid: data.imap_uid,
        });

        return rows[0];
      }
    }

    const { rows } = await client.query(
      `
      INSERT INTO ${EMAIL_INBOUNDS_TABLE}
        (
          account_id,
          imap_uid,
          from_address,
          to_address,
          subject,
          body_text,
          body_html,
          received_at,
          attachments_meta
        )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      RETURNING
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
        attachments_meta;
      `,
      [
        data.account_id,
        data.imap_uid,
        data.from_address,
        data.to_address,
        data.subject,
        data.body_text,
        data.body_html,
        data.received_at,
        JSON.stringify(data.attachments_meta || []),
      ]
    );

    const row = normalizeRow(rows[0]);

    log('SAVE_INSERTED', {
      id: row?.id,
      account_id: row?.account_id,
      imap_uid: row?.imap_uid,
      subject: row?.subject,
      attachments_count: row?.attachments_meta?.length || 0,
    });

    return row;
  }, 'saveInboundEmail');
}
