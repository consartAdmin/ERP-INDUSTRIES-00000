// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailAccounts.sanitizers.js — Normalização/validação de entrada    ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toBool(v, def = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return def;
}

export function toInt(v, def) {
  if (v == null || String(v).trim() === '') return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function normStr(v) {
  const s = (v == null) ? '' : String(v);
  return s.trim();
}

export function nullableStr(v) {
  const s = normStr(v);
  return s ? s : null;
}

export function normalizeAccountPayload(payload = {}) {
  return {
    label: normStr(payload.label),
    email_address: normStr(payload.email_address ?? payload.email ?? payload.address),
    provider: normStr(payload.provider || 'custom') || 'custom',

    smtp_host: normStr(payload.smtp_host ?? payload.smtpHost),
    smtp_port: toInt(payload.smtp_port ?? payload.smtpPort, 587),
    smtp_secure: toBool(payload.smtp_secure ?? payload.smtpSecure, false),
    smtp_user: normStr(payload.smtp_user ?? payload.smtpUser),
    smtp_pass: normStr(payload.smtp_pass ?? payload.smtpPass),

    imap_host: nullableStr(payload.imap_host ?? payload.imapHost),
    imap_port: (payload.imap_port != null || payload.imapPort != null) ? toInt(payload.imap_port ?? payload.imapPort, null) : null,
    imap_secure: toBool(payload.imap_secure ?? payload.imapSecure, true),
    imap_user: nullableStr(payload.imap_user ?? payload.imapUser),
    imap_pass: nullableStr(payload.imap_pass ?? payload.imapPass),

    is_active: toBool(payload.is_active ?? payload.isActive, true),
  };
}

export function validateAccount(d) {
  const errs = [];
  if (!d.label) errs.push({ field: 'label', message: 'label é obrigatório.' });
  if (!d.email_address) errs.push({ field: 'email_address', message: 'email_address é obrigatório.' });

  if (!d.smtp_host) errs.push({ field: 'smtp_host', message: 'smtp_host é obrigatório.' });
  if (!Number.isFinite(d.smtp_port) || d.smtp_port <= 0) errs.push({ field: 'smtp_port', message: 'smtp_port inválido.' });
  if (!d.smtp_user) errs.push({ field: 'smtp_user', message: 'smtp_user é obrigatório.' });
  if (!d.smtp_pass) errs.push({ field: 'smtp_pass', message: 'smtp_pass é obrigatório.' });

  return errs;
}

// ✅ patch normalizer: só considera senha se veio explicitamente
export function normalizePatchPayload(payload = {}) {
  const base = normalizeAccountPayload(payload);

  const hasSmtpPass = Object.prototype.hasOwnProperty.call(payload, 'smtp_pass')
    || Object.prototype.hasOwnProperty.call(payload, 'smtpPass');

  const hasImapPass = Object.prototype.hasOwnProperty.call(payload, 'imap_pass')
    || Object.prototype.hasOwnProperty.call(payload, 'imapPass');

  return {
    ...base,
    __hasSmtpPass: hasSmtpPass,
    __hasImapPass: hasImapPass,
  };
}
