// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutbounds.sanitizers.js — Normalização do payload de envio    ║
// ║ from_address/to_address NUNCA NULL (colunas NOT NULL)              ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toArray(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [String(v)];
}

export function safeDate(v) {
  if (!v) return null;
  const d = (v instanceof Date) ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function toIntOrNull(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

export function safeText(v, fallback = '') {
  const s = v == null ? '' : String(v);
  const t = s.trim();
  return t !== '' ? t : fallback;
}

export function safeJsonbArray(v) {
  // sua coluna é NOT NULL e default '[]'::jsonb
  // aqui garantimos SEMPRE um array serializável
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  // se veio string JSON do front, tenta parsear
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  // se veio objeto, não aceitamos (pra manter padrão array)
  return [];
}

export function sumAttachmentBytes(metaArr) {
  if (!Array.isArray(metaArr)) return 0;
  let total = 0;
  for (const it of metaArr) {
    const n = Number(it?.size);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

export function normalizeOutboundPayload(email = {}) {
  const account_id = toIntOrNull(email.account_id ?? email.accountId ?? email.email_account_id);

  const fromRaw = email.from ?? email.from_address ?? email.fromAddress ?? null;
  const toRaw = email.to ?? email.to_address ?? email.toAddress ?? null;

  // ⚠️ colunas NOT NULL no schema
  const from_address = safeText(fromRaw, '(unknown)');
  const to_address = safeText(toRaw, '(unknown)');

  const cc = email.cc ?? email.cc_address ?? email.ccAddress ?? null;
  const bcc = email.bcc ?? email.bcc_address ?? email.bccAddress ?? null;

  const subject = email.subject ?? null;

  const body_text = email.text ?? email.body_text ?? null;
  const body_html = email.html ?? email.body_html ?? null;

  const sent_at = safeDate(email.sent_at ?? email.sentAt);

  const message_id = (email.message_id ?? email.messageId ?? null);
  const messageIdNorm = (message_id == null) ? null : String(message_id).trim() || null;

  const provider = email.provider ?? null;
  const provider_status = email.provider_status ?? email.providerStatus ?? null;
  const provider_error = email.provider_error ?? email.providerError ?? null;

  const attachments_meta = safeJsonbArray(email.attachments_meta ?? email.attachmentsMeta ?? []);
  const attachments_ref = email.attachments_ref ?? email.attachmentsRef ?? null;
  const request_id = email.request_id ?? email.requestId ?? null;

  const attachments_count =
    Number.isFinite(Number(email.attachments_count))
      ? Number(email.attachments_count)
      : attachments_meta.length;

  const attachments_total_bytes =
    Number.isFinite(Number(email.attachments_total_bytes))
      ? Number(email.attachments_total_bytes)
      : sumAttachmentBytes(attachments_meta);

  return {
    account_id,
    from_address,
    to_address,
    cc_address: cc ? toArray(cc) : null,
    bcc_address: bcc ? toArray(bcc) : null,
    subject,
    body_text,
    body_html,
    sent_at,
    message_id: messageIdNorm,
    provider_status,
    provider_error,
    provider,
    attachments_count,
    attachments_total_bytes,
    attachments_meta,
    attachments_ref,
    request_id,
  };
}
