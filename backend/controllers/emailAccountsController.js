// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailAccountsController.js — Controller Email Accounts (ESM)          ║
// ║ Base: /api/email/accounts                                            ║
// ║ ✅ list/get/create/update/deactivate                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import emailAccountsApi from '../repositories/emailAccounts/emailAccounts.index.js';

const ERR = Object.freeze({
  VALIDATION: 'EMAIL_ACCOUNTS_VALIDATION',
  LIST_FAILED: 'EMAIL_ACCOUNTS_LIST_FAILED',
  GET_FAILED: 'EMAIL_ACCOUNTS_GET_FAILED',
  CREATE_FAILED: 'EMAIL_ACCOUNTS_CREATE_FAILED',
  UPDATE_FAILED: 'EMAIL_ACCOUNTS_UPDATE_FAILED',
  NOT_FOUND: 'EMAIL_ACCOUNTS_NOT_FOUND',
  INTERNAL: 'EMAIL_ACCOUNTS_INTERNAL',
});

function genRequestId(req) {
  const hdr =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-trace-id'];
  if (hdr) return String(hdr);
  return `mailacc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function jsonError(res, status, { code, message, details, fieldErrors, requestId, extra }) {
  return res.status(status).json({
    ok: false,
    code: code || ERR.INTERNAL,
    message: message || 'Erro.',
    details: details || null,
    fieldErrors: fieldErrors || null,
    requestId: requestId || null,
    ...(extra ? { extra } : {}),
  });
}

/* GET /api/email/accounts */
export async function listEmailAccountsHandler(req, res) {
  const requestId = genRequestId(req);
  try {
    const onlyActive = (req.query.onlyActive ?? 'true');
    const limit = Number.parseInt(req.query.limit, 10);
    const offset = Number.parseInt(req.query.offset, 10);

    const rows = await emailAccountsApi.listAccounts(pool, {
      onlyActive: onlyActive !== 'false',
      limit: Number.isFinite(limit) ? limit : 200,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return res.json({ ok: true, requestId, accounts: rows });
  } catch (err) {
    console.error('[emailAccountsController] listEmailAccountsHandler', { requestId, error: err?.message || err });
    return jsonError(res, 500, {
      code: ERR.LIST_FAILED,
      message: 'Erro ao listar contas de e-mail.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* GET /api/email/accounts/:id */
export async function getEmailAccountByIdHandler(req, res) {
  const requestId = genRequestId(req);
  const { id } = req.params;

  try {
    const includeSecrets =
      String(req.query.includeSecrets || '').toLowerCase() === 'true';

    const row = await emailAccountsApi.getAccountById(pool, id, { includeSecrets });

    if (!row) {
      return jsonError(res, 404, {
        code: ERR.NOT_FOUND,
        message: 'Conta de e-mail não encontrada.',
        details: `id=${id}`,
        requestId,
      });
    }

    return res.json({ ok: true, requestId, account: row });
  } catch (err) {
    console.error('[emailAccountsController] getEmailAccountByIdHandler', {
      requestId,
      id,
      error: err?.message || err,
    });

    return jsonError(res, 500, {
      code: ERR.GET_FAILED,
      message: 'Erro ao buscar conta de e-mail.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* POST /api/email/accounts */
export async function createEmailAccountHandler(req, res) {
  const requestId = genRequestId(req);

  try {
    const created = await emailAccountsApi.createAccount(pool, req.body || {});
    return res.status(201).json({ ok: true, requestId, account: created });
  } catch (err) {
    if (err?.code === 'EMAIL_ACCOUNTS_VALIDATION' || err?.fieldErrors) {
      return jsonError(res, 400, {
        code: ERR.VALIDATION,
        message: 'Falha de validação.',
        details: err?.message || null,
        fieldErrors: err?.fieldErrors || null,
        requestId,
      });
    }

    console.error('[emailAccountsController] createEmailAccountHandler', { requestId, error: err?.message || err });
    return jsonError(res, 500, {
      code: ERR.CREATE_FAILED,
      message: 'Erro ao criar conta de e-mail.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* PUT /api/email/accounts/:id */
export async function updateEmailAccountHandler(req, res) {
  const requestId = genRequestId(req);
  const { id } = req.params;

  try {
    const updated = await emailAccountsApi.updateAccount(pool, id, req.body || {});
    if (!updated) {
      return jsonError(res, 404, {
        code: ERR.NOT_FOUND,
        message: 'Conta de e-mail não encontrada.',
        details: `id=${id}`,
        requestId,
      });
    }
    return res.json({ ok: true, requestId, account: updated });
  } catch (err) {
    console.error('[emailAccountsController] updateEmailAccountHandler', { requestId, id, error: err?.message || err });
    return jsonError(res, 500, {
      code: ERR.UPDATE_FAILED,
      message: 'Erro ao atualizar conta de e-mail.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* DELETE /api/email/accounts/:id  (soft: desativa) */
export async function deactivateEmailAccountHandler(req, res) {
  const requestId = genRequestId(req);
  const { id } = req.params;

  try {
    const updated = await emailAccountsApi.deactivateAccount(pool, id);
    if (!updated) {
      return jsonError(res, 404, {
        code: ERR.NOT_FOUND,
        message: 'Conta de e-mail não encontrada.',
        details: `id=${id}`,
        requestId,
      });
    }
    return res.json({ ok: true, requestId, account: updated });
  } catch (err) {
    console.error('[emailAccountsController] deactivateEmailAccountHandler', { requestId, id, error: err?.message || err });
    return jsonError(res, 500, {
      code: ERR.UPDATE_FAILED,
      message: 'Erro ao desativar conta de e-mail.',
      details: err?.message || null,
      requestId,
    });
  }
}

export async function listEmailAccountsWithUnreadHandler(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        ea.id,
        ea.label,
        ea.email_address,
        COALESCE(u.unread, 0) AS unread
      FROM public."emailAccounts" ea
      LEFT JOIN (
        SELECT account_id, COUNT(*)::int AS unread
        FROM public."emailInbounds"
        WHERE COALESCE(is_read, false) = false
        GROUP BY account_id
      ) u ON u.account_id = ea.id
      WHERE ea.is_active = true
      ORDER BY ea.label ASC, ea.id ASC;
    `);

    return res.json(rows.map(r => ({
      id: String(r.id),
      label: r.label,
      email: r.email_address,
      unread: Number(r.unread) || 0,
    })));

  } catch (err) {
    console.error('[emailAccounts] listWithUnread ERROR:', err);
    return res.status(500).json({
      ok: false,
      code: 'EMAIL_ACCOUNTS_WITH_UNREAD_FAILED',
      message: 'Erro ao listar contas com unread.',
    });
  }
}
