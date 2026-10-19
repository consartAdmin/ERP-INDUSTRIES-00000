// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsService.js — SMTP + Log em public."emailOutbounds"     ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import nodemailer from 'nodemailer';
import pool from '../../config/db.js';

const TB_EMAIL = 'public."emailOutbounds"';

function toTextArray(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return String(v)
    .split(/[;,]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function getTransport() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!host || !user || !pass) {
    throw new Error('SMTP não configurado: defina SMTP_HOST/SMTP_USER/SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendAndLogEmail({
  from_address,
  to_address,
  cc_address,
  bcc_address,
  subject,
  body_text,
  body_html,
  attachments = [],
  provider = 'smtp',
} = {}) {
  const from = from_address || process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = String(to_address || '').trim();
  if (!to) throw new Error('to_address é obrigatório.');

  const ccArr = toTextArray(cc_address);
  const bccArr = toTextArray(bcc_address);

  // 1) Log inicial
  const ins = await pool.query(
    `
      INSERT INTO ${TB_EMAIL}
        (from_address, to_address, cc_address, bcc_address, subject, body_text, body_html, provider, provider_status, provider_error)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',NULL)
      RETURNING id
    `,
    [
      from,
      to,
      ccArr,
      bccArr,
      subject || null,
      body_text || null,
      body_html || null,
      provider || 'smtp',
    ]
  );

  const emailId = ins.rows?.[0]?.id;

  // 2) Envia
  const transporter = getTransport();
  try {
    const info = await transporter.sendMail({
      from,
      to,
      cc: ccArr?.length ? ccArr : undefined,
      bcc: bccArr?.length ? bccArr : undefined,
      subject: subject || '',
      text: body_text || undefined,
      html: body_html || undefined,
      attachments,
    });

    const messageId = info?.messageId || null;

    // 3) Atualiza log (usa UNIQUE uq_emailoutbounds_message_id quando houver)
    await pool.query(
      `
        UPDATE ${TB_EMAIL}
           SET sent_at = NOW(),
               message_id = $2,
               provider_status = 'SENT',
               provider_error = NULL
         WHERE id = $1
      `,
      [emailId, messageId]
    );

    return { ok: true, emailId, messageId };
  } catch (err) {
    await pool.query(
      `
        UPDATE ${TB_EMAIL}
           SET reminder = reminder
      `
    ).catch(() => {}); // (no-op guard)

    await pool.query(
      `
        UPDATE ${TB_EMAIL}
           SET provider_status = 'ERROR',
               provider_error  = $2
         WHERE id = $1
      `,
      [emailId, String(err?.message || err)]
    );

    return { ok: false, emailId, error: String(err?.message || err) };
  }
}
