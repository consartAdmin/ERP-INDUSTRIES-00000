// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sendMailByAccount.js — SMTP sender by emailAccounts (ESM)             ║
// ║ CONSART ERP                                                          ║
// ║                                                                      ║
// ║ ✅ Uses public."emailAccounts" (DB)                                   ║
// ║ ✅ Dynamic nodemailer transporter per account_id                       ║
// ║ ✅ Cache transporters (TTL)                                            ║
// ║ ✅ Attachments compatible (filename/content/contentType)              ║
// ║ ✅ No password logs + safe verify                                     ║
// ║ ✅ Optional pool injection for tests (defaults to shared pool)        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import nodemailer from 'nodemailer';
import pool from '../../config/db.js';
import emailAccountsApi from '../../repositories/emailAccounts/emailAccounts.index.js';

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

const LOG_LEVEL = (process.env.LOG_LEVEL || '').toLowerCase();
const DEBUG = LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production';

// cache de transporter por account
const transporterCache = new Map(); // key: accountId -> { transporter, createdAt, cfgHash }
const CACHE_TTL_MS = Number.parseInt(process.env.EMAIL_TRANSPORTER_TTL_MS || '900000', 10); // 15min default

function now() {
  return Date.now();
}

function safeBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function cfgHashForAccount(acc) {
  // hash simples para invalidar cache quando muda algo importante
  // (não inclui senha em log; mas hash usa a senha internamente)
  const raw = [
    acc.smtp_host,
    acc.smtp_port,
    acc.smtp_secure,
    acc.smtp_user,
    acc.smtp_pass,
  ].join('|');

  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return String(h);
}

function sanitizeEmailList(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
  return String(v).trim();
}

function normalizeAttachments(arr) {
  if (!Array.isArray(arr) || !arr.length) return [];
  return arr
    .map((a) => ({
      filename: a?.filename ? String(a.filename) : 'file',
      content: a?.content, // Buffer
      contentType: a?.contentType ? String(a.contentType) : undefined,
    }))
    .filter((a) => a.content); // só mantém se tiver conteúdo
}

function debugLog(event, payload = {}) {
  if (!DEBUG) return;
  // nunca loga senha
  console.log(`[sendMailByAccount][${event}]`, payload);
}

function errWithCode(code, message, extra = {}) {
  const e = new Error(message);
  e.code = code;
  Object.assign(e, extra);
  return e;
}

/* -------------------------------------------------------------------------- */
/* Fetch account with secrets                                                  */
/* -------------------------------------------------------------------------- */

async function getAccountOrThrow(pgPool, accountId) {
  const id = Number(accountId);
  if (!Number.isFinite(id) || id <= 0) {
    throw errWithCode('EMAIL_ACCOUNT_ID_INVALID', 'account_id inválido.', { accountId });
  }

  const account = await emailAccountsApi.getAccountById(pgPool, id, { includeSecrets: true });
  if (!account) {
    throw errWithCode('EMAIL_ACCOUNT_NOT_FOUND', 'Conta de e-mail não encontrada.', { accountId: id });
  }
  if (account.is_active === false) {
    throw errWithCode('EMAIL_ACCOUNT_INACTIVE', 'Conta de e-mail está desativada.', { accountId: id });
  }

  // valida campos mínimos SMTP
  const missing = [];
  if (!account.smtp_host) missing.push('smtp_host');
  if (!account.smtp_port) missing.push('smtp_port');
  if (!account.smtp_user) missing.push('smtp_user');
  if (!account.smtp_pass) missing.push('smtp_pass');
  if (missing.length) {
    throw errWithCode(
      'EMAIL_ACCOUNT_SMTP_INCOMPLETE',
      `Conta de e-mail sem configuração SMTP completa (${missing.join(', ')}).`,
      { accountId: id }
    );
  }

  return account;
}

/* -------------------------------------------------------------------------- */
/* Transporter factory + cache                                                 */
/* -------------------------------------------------------------------------- */

function isCacheValid(entry) {
  if (!entry) return false;
  const age = now() - entry.createdAt;
  return age >= 0 && age <= CACHE_TTL_MS;
}

function buildTransporter(account) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: Number(account.smtp_port),
    secure: safeBool(account.smtp_secure), // true = 465 normalmente
    auth: {
      user: account.smtp_user,
      pass: account.smtp_pass,
    },
  });
}

async function getTransporterForAccount(pgPool, accountId) {
  const account = await getAccountOrThrow(pgPool, accountId);
  const hash = cfgHashForAccount(account);

  const cached = transporterCache.get(String(account.id));
  if (cached && isCacheValid(cached) && cached.cfgHash === hash) {
    return { transporter: cached.transporter, account };
  }

  const transporter = buildTransporter(account);

  // opcional: validar conexão em debug (não trava produção)
  if (DEBUG) {
    try {
      await transporter.verify();
      debugLog('SMTP_VERIFY_OK', {
        accountId: account.id,
        host: account.smtp_host,
        port: account.smtp_port,
        secure: !!account.smtp_secure,
      });
    } catch (e) {
      debugLog('SMTP_VERIFY_FAIL', { accountId: account.id, err: e?.message || e });
      // não lança — alguns provedores bloqueiam verify, mas send funciona
    }
  }

  transporterCache.set(String(account.id), {
    transporter,
    createdAt: now(),
    cfgHash: hash,
  });

  return { transporter, account };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * sendMailByAccount
 * @param {object} params
 * @param {number|string} params.account_id
 * @param {string|string[]} params.to
 * @param {string|string[]} [params.cc]
 * @param {string|string[]} [params.bcc]
 * @param {string} params.subject
 * @param {string} [params.text]
 * @param {string} [params.html]
 * @param {Array<{filename:string, content:Buffer, contentType?:string}>} [params.attachments]
 * @param {string} [params.from] // opcional: se não vier, usa account.email_address
 * @param {object} [opts]
 * @param {object} [opts.pgPool] // opcional (para testes). default: shared pool
 */
export async function sendMailByAccount(params = {}, opts = {}) {
  const pgPool = opts.pgPool || pool;

  const accountId = params.account_id ?? params.accountId;
  const { transporter, account } = await getTransporterForAccount(pgPool, accountId);

  const to = sanitizeEmailList(params.to);
  const cc = sanitizeEmailList(params.cc);
  const bcc = sanitizeEmailList(params.bcc);

  if (!to) {
    throw errWithCode('EMAIL_TO_REQUIRED', 'Destinatário (to) é obrigatório.', { accountId: account.id });
  }

  const subject = (params.subject && String(params.subject).trim())
    ? String(params.subject).trim()
    : '(no subject)';

  const text = params.text != null ? String(params.text) : '';
  const html = params.html != null ? String(params.html) : (text || '');

  const attachments = normalizeAttachments(params.attachments);

  const from = (params.from && String(params.from).trim())
    ? String(params.from).trim()
    : (account.email_address || account.smtp_user);

  debugLog('SEND_BEGIN', {
    accountId: account.id,
    from,
    to,
    hasCc: !!cc,
    hasBcc: !!bcc,
    subject,
    attachmentsCount: attachments.length,
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      subject,
      text,
      html,
      ...(attachments.length ? { attachments } : {}),
    });

    debugLog('SEND_OK', {
      accountId: account.id,
      messageId: info?.messageId || null,
      acceptedCount: Array.isArray(info?.accepted) ? info.accepted.length : null,
      rejectedCount: Array.isArray(info?.rejected) ? info.rejected.length : null,
    });

    return info;
  } catch (err) {
    console.error('[sendMailByAccount][SEND_FAIL]', {
      accountId: account.id,
      host: account.smtp_host,
      port: account.smtp_port,
      secure: !!account.smtp_secure,
      error: err?.message || err,
    });

    const e = errWithCode('EMAIL_SMTP_SEND_FAILED', err?.message || 'Falha ao enviar e-mail.', {
      accountId: account.id,
      provider: account.provider || 'custom',
    });
    e.original = err;
    throw e;
  }
}

/**
 * Opcional: limpar cache manualmente (se você editar conta e quiser efeito imediato).
 */
export function clearMailTransportCache(accountId = null) {
  if (accountId == null) {
    transporterCache.clear();
    return;
  }
  transporterCache.delete(String(accountId));
}
