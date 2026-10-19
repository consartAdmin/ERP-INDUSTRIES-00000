// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInbounds.sanitizers.js — Normalização de entrada / e-mail IMAP║
// ╚════════════════════════════════════════════════════════════════════╝

import { log, safeJsonArrayParse } from './emailInbounds.utils.js';

export function toPositiveIntOrNull(value) {
  if (value == null || String(value).trim() === '') return null;

  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export function toSafeLimit(value, fallback = 50, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

export function toSafeOffset(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.trunc(n);
}

export function safeDate(value) {
  if (!value) return new Date();

  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : new Date();
}

export function safeText(value, fallback = null) {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

export function normalizeAttachments(email = {}) {
  const rawAtts = Array.isArray(email.attachments) ? email.attachments : [];

  const metaFromEmail =
    Array.isArray(email.attachments_meta) ? email.attachments_meta :
    Array.isArray(email.attachmentsMeta) ? email.attachmentsMeta :
    null;

  const metaFromJsonString =
    typeof email.attachments_meta === 'string' && email.attachments_meta.trim()
      ? safeJsonArrayParse(email.attachments_meta)
      : typeof email.attachmentsMeta === 'string' && email.attachmentsMeta.trim()
        ? safeJsonArrayParse(email.attachmentsMeta)
        : null;

  const attachments =
    metaFromEmail ||
    metaFromJsonString ||
    rawAtts.map((a) => ({
      filename: a?.filename || a?.name || 'attachment',
      contentType: a?.contentType || a?.mimeType || a?.mime || '',
      size: Number(a?.size || a?.length || a?.content?.length || 0) || 0,
      url: a?.url || a?.downloadUrl || a?.signedUrl || '',
    }));

  return Array.isArray(attachments) ? attachments : [];
}

export function normalizeAddress(value, fallback) {
  if (!value) return fallback;

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (Array.isArray(value)) {
    return value.map((v) => normalizeAddress(v, '')).filter(Boolean).join(', ') || fallback;
  }

  if (value?.text) return String(value.text).trim() || fallback;
  if (value?.value && Array.isArray(value.value)) {
    return value.value
      .map((v) => v?.address || v?.name || '')
      .filter(Boolean)
      .join(', ') || fallback;
  }

  return String(value).trim() || fallback;
}

export function normalizeEmail(email = {}, account_id) {
  const accountId = toPositiveIntOrNull(account_id);

  if (!accountId) {
    throw new Error('[emailInboundsApi] account_id inválido');
  }

  const attachments_meta = normalizeAttachments(email);

  const normalized = {
    account_id: accountId,
    imap_uid: email.uid ?? email.imap_uid ?? null,

    from_address: normalizeAddress(email.from || email.from_address, '(remetente indefinido)'),
    to_address: normalizeAddress(email.to || email.to_address, '(destinatário indefinido)'),
    subject: safeText(email.subject, null),

    body_text: email.text ?? email.body_text ?? null,
    body_html: email.html ?? email.body_html ?? null,

    received_at: safeDate(email.date || email.received_at),

    attachments_meta,
  };

  log('NORMALIZE_EMAIL', {
    account_id: normalized.account_id,
    imap_uid: normalized.imap_uid,
    from_address: normalized.from_address,
    to_address: normalized.to_address,
    subject: normalized.subject,
    has_body_text: !!normalized.body_text,
    body_text_length: String(normalized.body_text || '').length,
    has_body_html: !!normalized.body_html,
    body_html_length: String(normalized.body_html || '').length,
    attachments_count: normalized.attachments_meta.length,
    received_at: normalized.received_at,
  });

  return normalized;
}
