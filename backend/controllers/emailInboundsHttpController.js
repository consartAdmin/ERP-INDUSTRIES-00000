  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ emailInboundsHttpController.js — HTTP Controller (DB Inbounds)       ║
  // ║ Base mount: /api/email                                               ║
  // ║ Endpoints: /api/email/inbounds[...]                                  ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  import pool from '../config/db.js';
  import emailInboundsApi from '../repositories/emailInbounds/emailInbounds.index.js';

  /* -------------------------------------------------------------------------- */
  /* Error Codes                                                                */
  /* -------------------------------------------------------------------------- */
  const ERR = Object.freeze({
    LIST_FAILED: 'EMAIL_INBOUNDS_LIST_FAILED',
    GET_FAILED: 'EMAIL_INBOUNDS_GET_FAILED',
    NOT_FOUND: 'EMAIL_INBOUNDS_NOT_FOUND',
    CLEAR_FAILED: 'EMAIL_INBOUNDS_CLEAR_FAILED',
    INTERNAL: 'EMAIL_INBOUNDS_INTERNAL',

    // ✅ NOVOS
    UNREAD_COUNT_FAILED: 'EMAIL_INBOUNDS_UNREAD_COUNT_FAILED',
    MARK_READ_FAILED: 'EMAIL_INBOUNDS_MARK_READ_FAILED',
    INVALID_ACCOUNT_ID: 'EMAIL_INBOUNDS_INVALID_ACCOUNT_ID',
    INVALID_ID: 'EMAIL_INBOUNDS_INVALID_ID',
  });

  function genRequestId(req) {
    const hdr =
      req.headers['x-request-id'] ||
      req.headers['x-correlation-id'] ||
      req.headers['x-trace-id'];
    if (hdr) return String(hdr);
    return `mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function jsonError(res, status, { code, message, details, requestId }) {
    return res.status(status).json({
      ok: false,
      code: code || ERR.INTERNAL,
      message: message || 'Erro.',
      details: details || null,
      requestId: requestId || null,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* GET /api/email/inbounds?limit=&offset=                                     */
  /* -------------------------------------------------------------------------- */
  /* -------------------------------------------------------------------------- */
  /* GET /api/email/inbounds?account_id=&limit=&offset=                          */
  /* -------------------------------------------------------------------------- */
  export async function listInboundsHandler(req, res) {
    const requestId = genRequestId(req);

    try {
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const accountIdRaw = req.query.account_id;

      const limit = Number.parseInt(limitRaw, 10);
      const offset = Number.parseInt(offsetRaw, 10);

      const account_id =
        accountIdRaw !== undefined &&
        accountIdRaw !== null &&
        `${accountIdRaw}`.trim() !== ''
          ? Number(accountIdRaw)
          : null;

      // ✅ valida account_id
      if (accountIdRaw && Number.isNaN(account_id)) {
        return jsonError(res, 400, {
          code: ERR.INVALID_ACCOUNT_ID,
          message: 'account_id inválido.',
          details: `account_id=${accountIdRaw}`,
          requestId,
        });
      }

      const rows = await emailInboundsApi.listInbounds(pool, {
        account_id, // ✅ AQUI ESTÁ O FIX
        limit: Number.isFinite(limit) ? limit : 50,
        offset: Number.isFinite(offset) ? offset : 0,
      });

      return res.json(rows);
    } catch (err) {
      console.error('[emailInboundsHttpController] listInboundsHandler', {
        requestId,
        error: err?.message || err,
      });

      return jsonError(res, 500, {
        code: ERR.LIST_FAILED,
        message: 'Erro ao listar e-mails recebidos.',
        details: err?.message || null,
        requestId,
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* GET /api/email/inbounds/:id                                                */
  /* -------------------------------------------------------------------------- */
  export async function getInboundByIdHandler(req, res) {
    const requestId = genRequestId(req);
    const { id } = req.params;

    try {
      const row = await emailInboundsApi.getInboundById(pool, id);

      if (!row) {
        return jsonError(res, 404, {
          code: ERR.NOT_FOUND,
          message: 'E-mail recebido não encontrado.',
          details: `id=${id}`,
          requestId,
        });
      }

      return res.json(row);
    } catch (err) {
      console.error('[emailInboundsHttpController] getInboundByIdHandler', {
        requestId,
        id,
        error: err?.message || err,
      });

      return jsonError(res, 500, {
        code: ERR.GET_FAILED,
        message: 'Erro ao buscar detalhe do e-mail recebido.',
        details: err?.message || null,
        requestId,
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* ✅ NOVO: GET /api/email/inbounds/unread-count?account_id=                  */
  /* -------------------------------------------------------------------------- */
  export async function unreadCountHandler(req, res) {
    const requestId = genRequestId(req);

    try {
      const accountIdRaw = req.query.account_id;

      const account_id =
        accountIdRaw !== undefined &&
        accountIdRaw !== null &&
        `${accountIdRaw}`.trim() !== ''
          ? Number(accountIdRaw)
          : null;

      if (accountIdRaw && Number.isNaN(account_id)) {
        return jsonError(res, 400, {
          code: ERR.INVALID_ACCOUNT_ID,
          message: 'account_id inválido.',
          details: `account_id=${accountIdRaw}`,
          requestId,
        });
      }

      const unread = await emailInboundsApi.countUnreadInbounds(pool, {
        account_id,
      });

      return res.json({ ok: true, unread, requestId });
    } catch (err) {
      console.error('[emailInboundsHttpController] unreadCountHandler', {
        requestId,
        error: err?.message || err,
      });

      return jsonError(res, 500, {
        code: ERR.UNREAD_COUNT_FAILED,
        message: 'Erro ao contar e-mails não lidos.',
        details: err?.message || null,
        requestId,
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* ✅ NOVO: PATCH /api/email/inbounds/:id/read                                */
  /* -------------------------------------------------------------------------- */
  export async function markInboundAsReadHandler(req, res) {
    const requestId = genRequestId(req);
    const { id } = req.params;

    try {
      const numericId = Number(id);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        return jsonError(res, 400, {
          code: ERR.INVALID_ID,
          message: 'ID inválido.',
          details: `id=${id}`,
          requestId,
        });
      }

      const updated = await emailInboundsApi.markInboundAsRead(pool, numericId);

      if (!updated) {
        return jsonError(res, 404, {
          code: ERR.NOT_FOUND,
          message: 'E-mail recebido não encontrado.',
          details: `id=${id}`,
          requestId,
        });
      }

      return res.json({ ok: true, item: updated, requestId });
    } catch (err) {
      console.error('[emailInboundsHttpController] markInboundAsReadHandler', {
        requestId,
        id,
        error: err?.message || err,
      });

      return jsonError(res, 500, {
        code: ERR.MARK_READ_FAILED,
        message: 'Erro ao marcar e-mail como lido.',
        details: err?.message || null,
        requestId,
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* DELETE /api/email/inbounds (debug)                                         */
  /* -------------------------------------------------------------------------- */
  export async function clearInboundsHandler(req, res) {
    const requestId = genRequestId(req);

    try {
      const deleted = await emailInboundsApi.clearInbounds(pool);
      return res.json({ ok: true, deleted, requestId });
    } catch (err) {
      console.error('[emailInboundsHttpController] clearInboundsHandler', {
        requestId,
        error: err?.message || err,
      });

      return jsonError(res, 500, {
        code: ERR.CLEAR_FAILED,
        message: 'Erro ao limpar e-mails recebidos.',
        details: err?.message || null,
        requestId,
      });
    }
  }
