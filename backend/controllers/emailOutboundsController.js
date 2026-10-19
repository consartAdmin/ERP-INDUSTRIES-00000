// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsController.js — Controller E-mails Enviados (ESM)          ║
// ║ CONSART ERP — Endpoints /api/email/outbounds[...] + Job helper           ║
// ║ ✅ Multi-accounts via public."emailAccounts" (account_id)               ║
// ║ ✅ Compatível com JSON + FormData (multer: attachments[])               ║
// ║ ✅ Erros padronizados com codes + requestId                             ║
// ║ ✅ DEBUG HARD: HIT + NODE DB CHECK + BEFORE/AFTER INSERT                ║
// ║ ✅ Persistência robusta: message_id fallback quando provider não retorna ║
// ║ ✅ Grava from_address REAL (do emailAccounts) quando envia multi-account ║
// ║ ✅ LEGACY opcional: só se NÃO vier account_id (modo compatibilidade)     ║
// ║ ✅ FIX CRÍTICO: nunca cai no legacy quando account_id existe             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import emailOutboundsApi from '../repositories/emailOutbounds/emailOutbounds.index.js';
import { importSentFromHostinger } from '../services/email/imapHostingerClient.js';

// ✅ sender multi-account (busca credenciais no DB)
import { sendMailByAccount } from '../services/email/sendMailByAccount.js';

// ✅ para registrar o "from_address" correto no DB
import emailAccountsApi from '../repositories/emailAccounts/emailAccounts.index.js';

// (Opcional) LEGACY: usado SOMENTE se NÃO houver account_id (compatibilidade)
import { sendHostingerMail } from '../services/email/smtpHostingerSender.js';

/* -------------------------------------------------------------------------- */
/* Error Codes                                                                */
/* -------------------------------------------------------------------------- */
const ERR = Object.freeze({
  VALIDATION: 'EMAIL_OUTBOUND_VALIDATION',
  MISSING_ENV: 'EMAIL_OUTBOUND_MISSING_ENV',
  SMTP_SEND_FAILED: 'EMAIL_OUTBOUND_SMTP_SEND_FAILED',
  DB_INSERT_FAILED: 'EMAIL_OUTBOUND_DB_INSERT_FAILED',
  LIST_FAILED: 'EMAIL_OUTBOUND_LIST_FAILED',
  GET_FAILED: 'EMAIL_OUTBOUND_GET_FAILED',
  NOT_FOUND: 'EMAIL_OUTBOUND_NOT_FOUND',
  CLEAR_FAILED: 'EMAIL_OUTBOUND_CLEAR_FAILED',
  IMPORT_FAILED: 'EMAIL_OUTBOUND_IMPORT_FAILED',
  INTERNAL: 'EMAIL_OUTBOUND_INTERNAL',

  // multi account
  ACCOUNT_REQUIRED: 'EMAIL_OUTBOUND_ACCOUNT_REQUIRED',
  ACCOUNT_INVALID: 'EMAIL_OUTBOUND_ACCOUNT_INVALID',
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeSubject(subject) {
  return typeof subject === 'string' && subject.trim()
    ? subject.trim()
    : '(no subject)';
}

function normalizeText(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function genRequestId(req) {
  const hdr =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-trace-id'];

  if (hdr) return String(hdr);
  return `mail_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function jsonError(
  res,
  status,
  { code, message, details, fieldErrors, requestId, extra }
) {
  const payload = {
    ok: false,
    code: code || ERR.INTERNAL,
    message: message || 'Erro.',
    details: details || null,
    fieldErrors: fieldErrors || null,
    requestId: requestId || null,
    ...(extra ? { extra } : {}),
  };
  return res.status(status).json(payload);
}

function parseRecipients(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((s) => String(s || '').trim()).filter(Boolean);
  }
  const s = String(input || '').trim();
  if (!s) return [];
  return s
    .split(/[;,]/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isLikelyEmail(s) {
  if (!s) return false;
  const v = String(s).trim();
  if (v.length < 5) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function pickFirst(obj, keys, fallback = '') {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') return obj[k];
  }
  return fallback;
}

function safeFilesFromMulter(req) {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((f) => ({
    filename: f.originalname,
    contentType: f.mimetype,
    size: f.size,
    buffer: f.buffer, // memoryStorage
  }));
}

function buildBody({ body_text, body_html, body }) {
  const text = normalizeText(body_text || body || '');
  const html = normalizeText(body_html || (body ? body : '') || text);
  return { text, html };
}

function makeLocalMessageId(requestId) {
  return `local-${requestId}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function logNodeDbCheck(requestId) {
  try {
    const { rows } = await pool.query(
      'select current_database() as db, current_schema() as schema, current_user as usr'
    );
    console.log('🧠 NODE DB CHECK', { requestId, ...rows?.[0] });
  } catch (e) {
    console.warn('🧠 NODE DB CHECK FAIL', { requestId, error: e?.message || e });
  }
}

function parseAccountId(body) {
  const raw = pickFirst(body, ['account_id', 'accountId', 'email_account_id'], '');
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function getDefaultAccountIdFromEnv() {
  const raw = (process.env.DEFAULT_EMAIL_ACCOUNT_ID || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getSenderAddressLegacy() {
  const from = process.env.ROCHIN_AIR_EMAIL_USER;
  if (!from) {
    const e = new Error('ROCHIN_AIR_EMAIL_USER não configurado.');
    e.code = ERR.MISSING_ENV;
    throw e;
  }
  return from;
}

/* -------------------------------------------------------------------------- */
/* GET /api/email/outbounds — Lista e-mails enviados (paginado)               */
/* -------------------------------------------------------------------------- */
export async function listOutboundsHandler(req, res) {
  const requestId = genRequestId(req);

  try {
    const limit = Number.parseInt(req.query.limit, 10);
    const offset = Number.parseInt(req.query.offset, 10);

    // (Opcional) filtro por account_id na listagem
    const accountId = req.query.account_id ? Number(req.query.account_id) : null;

    const emails = await emailOutboundsApi.listOutbounds(pool, {
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      ...(Number.isFinite(accountId) && accountId > 0 ? { account_id: accountId } : {}),
    });

    return res.json(emails);
  } catch (err) {
    console.error('[emailOutboundsController] listOutboundsHandler', {
      requestId,
      error: err?.message || err,
    });

    return jsonError(res, 500, {
      code: ERR.LIST_FAILED,
      message: 'Erro ao listar e-mails enviados.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/email/outbounds/:id — Detalhe de um e-mail enviado                */
/* -------------------------------------------------------------------------- */
export async function getOutboundByIdHandler(req, res) {
  const requestId = genRequestId(req);
  const { id } = req.params;

  try {
    const email = await emailOutboundsApi.getOutboundById(pool, id);

    if (!email) {
      return jsonError(res, 404, {
        code: ERR.NOT_FOUND,
        message: 'E-mail enviado não encontrado.',
        details: `id=${id}`,
        requestId,
      });
    }

    return res.json(email);
  } catch (err) {
    console.error('[emailOutboundsController] getOutboundByIdHandler', {
      requestId,
      id,
      error: err?.message || err,
    });

    return jsonError(res, 500, {
      code: ERR.GET_FAILED,
      message: 'Erro ao buscar detalhe do e-mail enviado.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE /api/email/outbounds — Limpa registros (debug/homolog)              */
/* -------------------------------------------------------------------------- */
export async function clearOutboundsHandler(req, res) {
  const requestId = genRequestId(req);

  try {
    const deletedCount = await emailOutboundsApi.clearOutbounds(pool);
    return res.json({ ok: true, deleted: deletedCount, requestId });
  } catch (err) {
    console.error('[emailOutboundsController] clearOutboundsHandler', {
      requestId,
      error: err?.message || err,
    });

    return jsonError(res, 500, {
      code: ERR.CLEAR_FAILED,
      message: 'Erro ao limpar e-mails enviados.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* POST /api/email/outbounds — Envia novo e-mail (MULTI-ACCOUNT)              */
/*                                                                              */
/* ✅ COMPATIBILIDADE TOTAL:                                                    */
/* - JSON: { to_address, subject, body_text, body_html, account_id }            */
/* - FormData(front): account_id + to, subject, body|text|message + attachments */
/* -------------------------------------------------------------------------- */
export async function sendOutboundEmailHandler(req, res) {
  const requestId = genRequestId(req);

  console.log('🔥 HIT sendOutboundEmailHandler', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    contentType: req.headers['content-type'] || null,
  });

  await logNodeDbCheck(requestId);

  const body = req.body || {};

  const toRaw = pickFirst(body, ['to', 'to_address', 'recipient', 'email', 'para'], '');
  const subjectRaw = pickFirst(body, ['subject', 'assunto', 'title'], '');
  const bodyRaw = pickFirst(body, ['body', 'text', 'message', 'body_text'], '');
  const htmlRaw = pickFirst(body, ['body_html', 'html'], '');

  const recipients = parseRecipients(toRaw);
  const invalidRecipients = recipients.filter((r) => !isLikelyEmail(r));

  const finalSubject = normalizeSubject(subjectRaw);
  const { text, html } = buildBody({ body_text: bodyRaw, body_html: htmlRaw, body: bodyRaw });

  // account_id: obrigatório (com fallback env opcional enquanto adapta frontend)
  let account_id = parseAccountId(body);
  if (account_id === null) {
    const envDefault = getDefaultAccountIdFromEnv();
    if (envDefault) account_id = envDefault;
  }

  const fieldErrors = [];

  if (!recipients.length) {
    fieldErrors.push({ field: 'to', message: 'Informe pelo menos 1 destinatário.' });
  }
  if (invalidRecipients.length) {
    fieldErrors.push({
      field: 'to',
      message: `Destinatário(s) inválido(s): ${invalidRecipients.join(', ')}`,
    });
  }

  // aqui continua obrigatório (multi-account)
  if (account_id == null) {
    fieldErrors.push({ field: 'account_id', message: 'Selecione uma conta de e-mail (account_id).' });
  } else if (Number.isNaN(account_id)) {
    fieldErrors.push({ field: 'account_id', message: 'account_id inválido.' });
  }

  if (fieldErrors.length) {
    return jsonError(res, 400, {
      code: ERR.VALIDATION,
      message: 'Falha de validação ao enviar e-mail.',
      details: 'Obrigatório: to (e-mail válido) e account_id.',
      fieldErrors,
      requestId,
      extra: {
        receivedKeys: Object.keys(body),
        contentType: req.headers['content-type'] || null,
      },
    });
  }

  const attachments = safeFilesFromMulter(req);

  // para persistência (sempre definimos, mesmo em falha)
  const sentAtIso = new Date().toISOString();

  try {
    console.log('[emailOutboundsController] sendOutboundEmailHandler', {
      requestId,
      account_id,
      to: recipients,
      subject: finalSubject,
      textLen: text.length,
      htmlLen: html.length,
      attachments: attachments.map((a) => ({ filename: a.filename, size: a.size, type: a.contentType })),
    });

    // 1) Enviar via SMTP da conta (emailAccounts)
    let info = null;
    let provider = 'hostinger-smtp';
    let from_address_real = null;

    // pega o from_address REAL para persistir (sem vazar senha)
    const account = await emailAccountsApi.getAccountById(pool, account_id, { includeSecrets: false });
    from_address_real = account?.email_address || null;

    try {
      info = await sendMailByAccount(
        {
          account_id,
          to: recipients.join(', '),
          subject: finalSubject,
          text,
          html,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.buffer,
            contentType: a.contentType,
          })),
        },
        { pgPool: pool }
      );
    } catch (multiErr) {
      // ✅ FIX CRÍTICO:
      // Se existe account_id, NÃO cai em legacy. Retorna erro e registra FAILED.
      console.error('[emailOutboundsController] sendMailByAccount FAIL (NO LEGACY WHEN account_id)', {
        requestId,
        account_id,
        error: multiErr?.message || multiErr,
        code: multiErr?.code || null,
      });

      const failMessageId = makeLocalMessageId(requestId);

      // best-effort: registrar falha
      try {
        await emailOutboundsApi.insertOutbound(pool, {
          account_id,
          from_address: from_address_real || null,
          to_address: recipients.join(', '),
          subject: finalSubject,
          body_text: text,
          body_html: html,
          sent_at: sentAtIso,
          message_id: failMessageId,
          provider: provider,
          provider_status: 'FAILED',
          provider_error: multiErr?.message || 'SMTP_SEND_FAILED',
          attachments_count: attachments.length,
          attachments_meta: attachments.map((a) => ({
            filename: a.filename,
            size: a.size,
            contentType: a.contentType,
          })),
          request_id: requestId,
        });
      } catch (e) {
        console.error('[emailOutboundsController] insertOutbound FAILED also failed', {
          requestId,
          error: e?.message || e,
        });
      }

      return jsonError(res, 502, {
        code: ERR.SMTP_SEND_FAILED,
        message: 'Falha ao enviar com a conta selecionada (SMTP).',
        details: multiErr?.message || null,
        requestId,
        extra: {
          account_id,
          from: from_address_real,
          to: recipients,
          subject: finalSubject,
        },
      });
    }

    // 2) Registrar em emailOutbounds (SENT)
    const providerMessageId = info?.messageId || null;
    const messageIdToPersist = providerMessageId || makeLocalMessageId(requestId);

    console.log('🟦 BEFORE INSERT OUTBOUND', {
      requestId,
      account_id,
      providerMessageId,
      messageIdToPersist,
      table: emailOutboundsApi?.EMAIL_OUTBOUNDS_TABLE || 'public."emailOutbounds"',
    });

    let saved = null;
    try {
      saved = await emailOutboundsApi.insertOutbound(pool, {
        account_id,
        from_address: from_address_real || null,
        to_address: recipients.join(', '),
        subject: finalSubject,
        body_text: text,
        body_html: html,
        sent_at: sentAtIso,
        message_id: messageIdToPersist,
        provider,
        provider_status: 'SENT',
        provider_error: null,
        attachments_count: attachments.length,
        attachments_meta: attachments.map((a) => ({
          filename: a.filename,
          size: a.size,
          contentType: a.contentType,
        })),
        request_id: requestId,
      });
    } catch (dbErr) {
      console.error('[emailOutboundsController] DB insert error', {
        requestId,
        error: dbErr?.message || dbErr,
      });
      // não quebra fluxo do envio
    }

    console.log('🟩 AFTER INSERT OUTBOUND', {
      requestId,
      savedId: saved?.id || null,
      savedIsNull: !saved,
      note: saved ? null : 'INSERT retornou null (provável conflito message_id ou DO NOTHING)',
    });

    return res.status(201).json({
      ok: true,
      requestId,
      account_id,
      from: from_address_real,
      to: recipients,
      subject: finalSubject,
      sent_at: sentAtIso,
      messageId: providerMessageId,
      persistedMessageId: messageIdToPersist,
      savedId: saved?.id || null,
      provider,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        size: a.size,
        contentType: a.contentType,
      })),
    });
  } catch (err) {
    // ✅ Esse catch agora pega apenas falhas inesperadas do handler,
    // não as falhas do SMTP da conta selecionada (já tratadas acima).
    console.error('[emailOutboundsController] sendOutboundEmailHandler ERROR', {
      requestId,
      account_id,
      error: err?.message || err,
      stack: err?.stack,
    });

    // best-effort: registrar falha
    try {
      const failMessageId = makeLocalMessageId(requestId);

      console.log('🟥 BEFORE INSERT OUTBOUND FAILED', { requestId, account_id, failMessageId });

      const savedFail = await emailOutboundsApi.insertOutbound(pool, {
        account_id,
        from_address: null,
        to_address: recipients.join(', '),
        subject: finalSubject,
        body_text: text,
        body_html: html,
        sent_at: new Date().toISOString(),
        message_id: failMessageId,
        provider: 'hostinger-smtp',
        provider_status: 'FAILED',
        provider_error: err?.message || 'INTERNAL_ERROR',
        attachments_count: attachments.length,
        request_id: requestId,
      });

      console.log('🟥 AFTER INSERT OUTBOUND FAILED', { requestId, savedId: savedFail?.id || null });
    } catch (e) {
      console.error('[emailOutboundsController] insert fail status also failed', {
        requestId,
        error: e?.message || e,
      });
    }

    return jsonError(res, 500, {
      code: ERR.INTERNAL,
      message: 'Erro interno ao enviar e-mail.',
      details: err?.message || null,
      requestId,
      extra: {
        account_id,
        to: recipients,
        subject: finalSubject,
        attachmentsCount: attachments.length,
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* JOB function (no Express) — Import from Hostinger                          */
/* -------------------------------------------------------------------------- */
export async function runImportOutboundsFromHostingerJob() {
  const { importedCount } = await importSentFromHostinger(pool);
  return importedCount;
}

/* -------------------------------------------------------------------------- */
/* POST /api/email/outbounds/import-hostinger — endpoint HTTP                 */
/* -------------------------------------------------------------------------- */
export async function importOutboundsFromHostingerHandler(req, res) {
  const requestId = genRequestId(req);

  try {
    const importedCount = await runImportOutboundsFromHostingerJob();

    return res.json({
      ok: true,
      requestId,
      imported: importedCount,
      message: `Importação de e-mails enviados concluída. Registros importados: ${importedCount}.`,
    });
  } catch (err) {
    console.error('[emailOutboundsController] importOutboundsFromHostingerHandler', {
      requestId,
      error: err?.message || err,
    });

    return jsonError(res, 500, {
      code: ERR.IMPORT_FAILED,
      message: 'Erro ao importar e-mails enviados via Hostinger IMAP.',
      details: err?.message || null,
      requestId,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Export default                                                             */
/* -------------------------------------------------------------------------- */
const emailOutboundsController = {
  listOutboundsHandler,
  getOutboundByIdHandler,
  clearOutboundsHandler,
  sendOutboundEmailHandler,
  importOutboundsFromHostingerHandler,
  runImportOutboundsFromHostingerJob,
};

export default emailOutboundsController;
