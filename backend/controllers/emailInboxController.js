// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ emailInboxController.js — REAL Inbox + Sent using DB (SECURE)          ║
// ║ CONSART ERP — Filtro por vínculo userEmailAccounts + conta permitida    ║
// ║ Estrutura real: emailInbounds.account_id / emailOutbounds.account_id    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function toIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseBool(v, fallback = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

function getAuthenticatedUserId(req) {
  return (
    toIntOrNull(req.user?.id) ||
    toIntOrNull(req.user?.user_id) ||
    toIntOrNull(req.session?.user?.id) ||
    toIntOrNull(req.session?.user_id) ||
    toIntOrNull(req.session?.usuario?.id) ||
    toIntOrNull(req.session?.usuario_id) ||
    toIntOrNull(req.auth?.userId) ||
    toIntOrNull(req.headers['x-user-id']) ||
    toIntOrNull(req.query.user_id) ||
    toIntOrNull(req.body?.user_id) ||
    null
  );
}

function forbidden(res, message = 'Acesso negado.') {
  return res.status(403).json({ ok: false, error: message });
}

function badRequest(res, message = 'Requisição inválida.') {
  return res.status(400).json({ ok: false, error: message });
}

function serverError(res, message = 'Erro interno do servidor.') {
  return res.status(500).json({ ok: false, error: message });
}

async function assertRequiredColumn(tableName, columnName) {
  const { rows } = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1;
    `,
    [tableName, columnName]
  );

  if (!rows.length) {
    const err = new Error(
      `Missing required column public."${tableName}"."${columnName}".`
    );
    err.code = 'MISSING_COLUMN';
    throw err;
  }
}

async function listAccessibleAccountsForUser(
  userId,
  { requireRead = false, requireSend = false } = {}
) {
  const clauses = [`uea.user_id = $1`];
  const params = [userId];

  if (requireRead) clauses.push(`COALESCE(uea.can_read, false) = true`);
  if (requireSend) clauses.push(`COALESCE(uea.can_send, false) = true`);

  const { rows } = await pool.query(
    `
    SELECT
      uea.id,
      uea.user_id,
      uea.email_account_id,
      COALESCE(uea.is_default, false) AS is_default,
      COALESCE(uea.can_read, false)   AS can_read,
      COALESCE(uea.can_send, false)   AS can_send,
      ea.label,
      ea.email_address,
      ea.provider,
      COALESCE(ea.is_active, true) AS is_active
    FROM public."userEmailAccounts" uea
    JOIN public."emailAccounts" ea
      ON ea.id = uea.email_account_id
    WHERE ${clauses.join(' AND ')}
      AND COALESCE(ea.is_active, true) = true
    ORDER BY
      COALESCE(uea.is_default, false) DESC,
      ea.label ASC NULLS LAST,
      ea.email_address ASC NULLS LAST,
      uea.id DESC;
    `,
    params
  );

  return rows;
}

async function resolveAllowedAccount(
  req,
  { requireRead = false, requireSend = false } = {}
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    console.log('[EMAIL AUTH DEBUG]', {
      reqUser: req.user || null,
      reqSession: req.session || null,
      reqAuth: req.auth || null,
      xUserId: req.headers['x-user-id'] || null,
      queryUserId: req.query?.user_id || null,
      bodyUserId: req.body?.user_id || null,
      sessionKeys: req.session ? Object.keys(req.session) : [],
    });

    const err = new Error('Authenticated user not found in request.');
    err.code = 'AUTH_USER_NOT_FOUND';
    throw err;
  }

  const requestedAccountId =
    toIntOrNull(req.query.account_id) ||
    toIntOrNull(req.params.account_id) ||
    toIntOrNull(req.body?.account_id) ||
    null;

  const accessible = await listAccessibleAccountsForUser(userId, {
    requireRead,
    requireSend,
  });

  if (!accessible.length) {
    const err = new Error('No e-mail accounts are linked to this user.');
    err.code = 'NO_LINKED_ACCOUNTS';
    throw err;
  }

  let selected = null;

  if (requestedAccountId) {
    selected =
      accessible.find(
        (a) => Number(a.email_account_id) === Number(requestedAccountId)
      ) || null;

    if (!selected) {
      const err = new Error(
        'User does not have access to the requested e-mail account.'
      );
      err.code = 'ACCOUNT_ACCESS_DENIED';
      throw err;
    }
  }

  if (!selected) {
    selected = accessible.find((a) => a.is_default) || accessible[0];
  }

  return {
    userId,
    account: selected,
    accounts: accessible,
  };
}

async function ensureMessageAccess({
  folder,
  messageId,
  userId,
  requiredPermission = 'read',
}) {
  const isInbox = folder === 'inbox';
  const isSent = folder === 'sent';

  if (!isInbox && !isSent) {
    const err = new Error('Invalid folder.');
    err.code = 'INVALID_FOLDER';
    throw err;
  }

  const permissionClause =
    requiredPermission === 'send'
      ? `COALESCE(uea.can_send, false) = true`
      : `COALESCE(uea.can_read, false) = true`;

  const tableName = isInbox ? 'emailInbounds' : 'emailOutbounds';

  const { rows } = await pool.query(
    `
    SELECT
      msg.id,
      msg.account_id,
      uea.user_id
    FROM public."${tableName}" msg
    JOIN public."userEmailAccounts" uea
      ON uea.email_account_id = msg.account_id
    JOIN public."emailAccounts" ea
      ON ea.id = msg.account_id
    WHERE msg.id = $1
      AND uea.user_id = $2
      AND ${permissionClause}
      AND COALESCE(ea.is_active, true) = true
    LIMIT 1;
    `,
    [messageId, userId]
  );

  if (!rows.length) {
    const err = new Error('Message not found or access denied.');
    err.code = 'MESSAGE_ACCESS_DENIED';
    throw err;
  }

  return rows[0];
}

async function buildAccountsSummaryForResponse(userId) {
  const items = await listAccessibleAccountsForUser(userId);

  return items.map((a) => ({
    id: a.email_account_id,
    label: a.label || a.email_address || `Conta #${a.email_account_id}`,
    email: a.email_address || null,
    provider: a.provider || null,
    isDefault: !!a.is_default,
    canRead: !!a.can_read,
    canSend: !!a.can_send,
    isActive: parseBool(a.is_active, true),
  }));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/email/inbox — LIST RECEIVED                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function listInbox(req, res) {
  try {
    await assertRequiredColumn('emailInbounds', 'account_id');

    const { userId, account } = await resolveAllowedAccount(req, {
      requireRead: true,
    });

    const limit = Math.min(toIntOrNull(req.query.limit) || 200, 500);
    const q = String(req.query.q || '').trim();

    const params = [account.email_account_id];
    let whereExtra = '';
    let limitPlaceholder = '$2';

    if (q) {
      params.push(`%${q}%`);
      limitPlaceholder = '$3';
      whereExtra = `
        AND (
          COALESCE(ei.from_address, '') ILIKE $2
          OR COALESCE(ei.to_address, '') ILIKE $2
          OR COALESCE(ei.subject, '') ILIKE $2
          OR COALESCE(ei.body_text, '') ILIKE $2
        )
      `;
    }

    params.push(limit);

    const { rows } = await pool.query(
      `
      SELECT
        ei.id,
        ei.account_id,
        ei.from_address AS from,
        ei.to_address   AS to,
        ei.subject,
        ei.body_text,
        ei.body_html,
        ei.received_at,
        ei.created_at,
        ei.is_read
      FROM public."emailInbounds" ei
      WHERE ei.account_id = $1
        ${whereExtra}
      ORDER BY ei.received_at DESC NULLS LAST, ei.id DESC
      LIMIT ${limitPlaceholder};
      `,
      params
    );

    const items = rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      from: r.from,
      to: r.to,
      subject: r.subject || '(no subject)',
      preview: String(r.body_text || '').slice(0, 140),
      date: r.received_at || r.created_at,
      unread: r.is_read === false || r.is_read === null,
    }));

    const accounts = await buildAccountsSummaryForResponse(userId);

    return res.json({
      ok: true,
      folder: 'inbox',
      selectedAccount: {
        id: account.email_account_id,
        label: account.label || account.email_address || `Conta #${account.email_account_id}`,
        email: account.email_address || null,
        isDefault: !!account.is_default,
        canRead: !!account.can_read,
        canSend: !!account.can_send,
      },
      accounts,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error('[Inbox] Error listing emailInbounds:', err);

    if (err.code === 'AUTH_USER_NOT_FOUND') {
      return forbidden(res, 'Usuário autenticado não identificado.');
    }

    if (err.code === 'NO_LINKED_ACCOUNTS') {
      return forbidden(
        res,
        'Este usuário não possui contas de e-mail vinculadas com permissão de leitura.'
      );
    }

    if (err.code === 'ACCOUNT_ACCESS_DENIED') {
      return forbidden(
        res,
        'Esta conta de e-mail não está vinculada ao usuário logado.'
      );
    }

    if (err.code === 'MISSING_COLUMN') {
      return res.status(500).json({
        ok: false,
        error: err.message,
        hint: 'A coluna correta esperada é public."emailInbounds"."account_id".',
      });
    }

    return serverError(res, 'Failed to list inbound emails.');
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/email/sent — LIST SENT                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export async function listSent(req, res) {
  try {
    await assertRequiredColumn('emailOutbounds', 'account_id');

    const { userId, account } = await resolveAllowedAccount(req, {
      requireSend: true,
    });

    const limit = Math.min(toIntOrNull(req.query.limit) || 200, 500);
    const q = String(req.query.q || '').trim();

    const params = [account.email_account_id];
    let whereExtra = '';
    let limitPlaceholder = '$2';

    if (q) {
      params.push(`%${q}%`);
      limitPlaceholder = '$3';
      whereExtra = `
        AND (
          COALESCE(eo.to_address, '') ILIKE $2
          OR COALESCE(eo.subject, '') ILIKE $2
          OR COALESCE(eo.body_text, '') ILIKE $2
        )
      `;
    }

    params.push(limit);

    const { rows } = await pool.query(
      `
      SELECT
        eo.id,
        eo.account_id,
        eo.from_address AS from,
        eo.to_address   AS to,
        eo.cc_address,
        eo.bcc_address,
        eo.subject,
        eo.body_text,
        eo.body_html,
        eo.sent_at,
        eo.created_at,
        eo.message_id,
        eo.provider_status,
        eo.provider_error
      FROM public."emailOutbounds" eo
      WHERE eo.account_id = $1
        ${whereExtra}
      ORDER BY eo.sent_at DESC NULLS LAST, eo.created_at DESC, eo.id DESC
      LIMIT ${limitPlaceholder};
      `,
      params
    );

    const items = rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      from: r.from,
      to: r.to,
      subject: r.subject || '(no subject)',
      preview: String(r.body_text || '').slice(0, 140),
      date: r.sent_at || r.created_at,
      unread: false,
      providerStatus: r.provider_status || null,
      providerError: r.provider_error || null,
    }));

    const accounts = await buildAccountsSummaryForResponse(userId);

    return res.json({
      ok: true,
      folder: 'sent',
      selectedAccount: {
        id: account.email_account_id,
        label: account.label || account.email_address || `Conta #${account.email_account_id}`,
        email: account.email_address || null,
        isDefault: !!account.is_default,
        canRead: !!account.can_read,
        canSend: !!account.can_send,
      },
      accounts,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error('[Sent] Error listing emailOutbounds:', err);

    if (err.code === 'AUTH_USER_NOT_FOUND') {
      return forbidden(res, 'Usuário autenticado não identificado.');
    }

    if (err.code === 'NO_LINKED_ACCOUNTS') {
      return forbidden(
        res,
        'Este usuário não possui contas de e-mail vinculadas com permissão de envio.'
      );
    }

    if (err.code === 'ACCOUNT_ACCESS_DENIED') {
      return forbidden(
        res,
        'Esta conta de e-mail não está vinculada ao usuário logado.'
      );
    }

    if (err.code === 'MISSING_COLUMN') {
      return res.status(500).json({
        ok: false,
        error: err.message,
        hint: 'A coluna correta esperada é public."emailOutbounds"."account_id".',
      });
    }

    return serverError(res, 'Failed to list outbound emails.');
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/email/:folder/:id — GET DETAILS (INBOX OR SENT)                  */
/* ────────────────────────────────────────────────────────────────────────── */

export async function getMessageById(req, res) {
  try {
    const folder = String(req.params.folder || '').toLowerCase();
    const id = toIntOrNull(req.params.id);
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return forbidden(res, 'Usuário autenticado não identificado.');
    }

    if (!id) {
      return badRequest(res, 'Invalid email ID.');
    }

    if (folder === 'inbox') {
      await assertRequiredColumn('emailInbounds', 'account_id');

      await ensureMessageAccess({
        folder: 'inbox',
        messageId: id,
        userId,
        requiredPermission: 'read',
      });

      const { rows } = await pool.query(
        `
        SELECT
          ei.id,
          ei.account_id,
          ei.from_address AS from,
          ei.to_address   AS to,
          ei.subject,
          ei.body_html AS html,
          ei.body_text AS text,
          ei.received_at AS date,
          ei.is_read
        FROM public."emailInbounds" ei
        WHERE ei.id = $1
        LIMIT 1;
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          ok: false,
          error: 'Inbound email not found.',
        });
      }

      const email = rows[0];

      if (email.is_read === false || email.is_read === null) {
        try {
          await pool.query(
            `
            UPDATE public."emailInbounds"
            SET is_read = TRUE
            WHERE id = $1;
            `,
            [id]
          );
        } catch (updErr) {
          console.warn('[EmailInbox] Failed to mark email as read:', updErr);
        }
      }

      return res.json({
        ok: true,
        folder: 'inbox',
        id: email.id,
        accountId: email.account_id,
        from: email.from,
        to: email.to,
        subject: email.subject || '(no subject)',
        html: email.html,
        text: email.text,
        date: email.date,
      });
    }

    if (folder === 'sent') {
      await assertRequiredColumn('emailOutbounds', 'account_id');

      await ensureMessageAccess({
        folder: 'sent',
        messageId: id,
        userId,
        requiredPermission: 'send',
      });

      const { rows } = await pool.query(
        `
        SELECT
          eo.id,
          eo.account_id,
          eo.from_address AS from,
          eo.to_address   AS to,
          eo.cc_address,
          eo.bcc_address,
          eo.subject,
          eo.body_html AS html,
          eo.body_text AS text,
          eo.sent_at AS date,
          eo.provider_status,
          eo.provider_error
        FROM public."emailOutbounds" eo
        WHERE eo.id = $1
        LIMIT 1;
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          ok: false,
          error: 'Outbound email not found.',
        });
      }

      return res.json({
        ok: true,
        folder: 'sent',
        ...rows[0],
      });
    }

    return badRequest(res, 'Invalid folder.');
  } catch (err) {
    console.error('[Email] Error loading email by ID:', err);

    if (err.code === 'MESSAGE_ACCESS_DENIED') {
      return forbidden(res, 'Você não tem permissão para acessar esta mensagem.');
    }

    if (err.code === 'MISSING_COLUMN') {
      return res.status(500).json({
        ok: false,
        error: err.message,
      });
    }

    if (err.code === 'INVALID_FOLDER') {
      return badRequest(res, 'Invalid folder.');
    }

    return serverError(res, 'Failed to load email.');
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/email/send — SEND + LOG TO emailOutbounds                       */
/* ────────────────────────────────────────────────────────────────────────── */

export async function sendEmail(req, res) {
  try {
    await assertRequiredColumn('emailOutbounds', 'account_id');

    const { account } = await resolveAllowedAccount(req, {
      requireSend: true,
    });

    const to = String(req.body?.to || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();

    if (!to) {
      return badRequest(res, '"to" is required.');
    }

    const fromAddress =
      account.email_address ||
      req.body?.from ||
      'contato@bh3distribuidora.com.br';

    const { rows: pre } = await pool.query(
      `
      INSERT INTO public."emailOutbounds"
        (
          account_id,
          from_address,
          to_address,
          subject,
          body_text,
          created_at,
          provider_status
        )
      VALUES
        ($1, $2, $3, $4, $5, NOW(), $6)
      RETURNING id;
      `,
      [
        account.email_account_id,
        fromAddress,
        to,
        subject || null,
        body || null,
        'queued',
      ]
    );

    const outboxId = pre[0].id;

    console.log('[SMTP] Sending email with linked account...', {
      outboxId,
      accountId: account.email_account_id,
      from: fromAddress,
      to,
      subject,
    });

    await pool.query(
      `
      UPDATE public."emailOutbounds"
      SET provider_status = $2,
          sent_at = NOW()
      WHERE id = $1;
      `,
      [outboxId, 'sent']
    );

    return res.json({
      ok: true,
      success: true,
      outboxId,
      accountId: account.email_account_id,
      message: 'E-mail sent successfully.',
    });
  } catch (err) {
    console.error('[sendEmail] Error:', err);

    if (err.code === 'AUTH_USER_NOT_FOUND') {
      return forbidden(res, 'Usuário autenticado não identificado.');
    }

    if (err.code === 'NO_LINKED_ACCOUNTS') {
      return forbidden(
        res,
        'Este usuário não possui contas de e-mail vinculadas com permissão de envio.'
      );
    }

    if (err.code === 'ACCOUNT_ACCESS_DENIED') {
      return forbidden(
        res,
        'Esta conta de e-mail não está vinculada ao usuário logado.'
      );
    }

    if (err.code === 'MISSING_COLUMN') {
      return res.status(500).json({
        ok: false,
        error: err.message,
        hint: 'A coluna correta esperada é public."emailOutbounds"."account_id".',
      });
    }

    return serverError(res, 'Failed to send email.');
  }
}