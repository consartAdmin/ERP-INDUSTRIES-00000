// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailOutboxController.js — Envio e Log de E-mails de Saída          ║
// ║ CONSART ERP — Rochin Air                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { sendEmail } from '../services/email/smtpHostingerClient.js';
import pool from '../config/db.js';
import emailOutboundsApi from '../repositories/emailOutbounds/emailOutbounds.index.js';
import { buildEmailWithSignature } from '../services/email/defaultSignature.js';

const DEFAULT_FROM = process.env.ROCHIN_AIR_EMAIL_USER || 'contato@rochinair.com.br';

/**
 * Grava log de e-mail enviado
 * Tabela: public."emailOutboxLog" (log legado)
 */
async function logEmailOutbox({
  from,
  to,
  subject,
  bodyText,
  bodyHtml,
  status,
  providerMessageId,
  errorMessage,
}) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO public."emailOutboxLog"
        (from_address, to_address, subject, body_text, body_html, status, provider_message_id, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;
    const values = [
      from,
      to,
      subject,
      bodyText,
      bodyHtml,
      status,
      providerMessageId,
      errorMessage,
    ];
    const result = await client.query(query, values);
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Também grava no modelo novo: public."emailOutbounds"
 * (usado pela tela "E-mails Sent")
 */
async function saveOutboundInUnifiedTable({
  from,
  to,
  subject,
  bodyText,
  bodyHtml,
  sentAt,
  messageId,
  status,
  errorMessage,
}) {
  await emailOutboundsApi.saveOutboundEmail(pool, {
    from,
    to,
    subject,
    text: bodyText,
    html: bodyHtml,
    sent_at: sentAt,
    message_id: messageId || null,
    provider: 'smtp-hostinger',
    provider_status: status,
    provider_error: errorMessage || null,
  });
}

/**
 * POST /api/email/send
 * Body JSON (from Inbox UI): { to, subject, body }
 * Body JSON (other modules): { to, subject, text?, html?, attachments? }
 */
export async function sendGenericEmail(req, res) {
  const {
    to,
    subject,
    body,        // from emailInbox.js
    text,
    html,
    attachments,
  } = req.body || {};

  if (!to || !subject) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: to, subject.' });
  }

  const from = DEFAULT_FROM;
  const sentAt = new Date();

  // -------------------------------------------------------------------
  // 1) Base content (priority: html > text > body)
  // -------------------------------------------------------------------
  const baseText = text ?? body ?? '';
  const baseHtml = html ?? null;

  // -------------------------------------------------------------------
  // 2) Append BH3 signature (centralized in defaultSignature.js)
  // -------------------------------------------------------------------
  const { html: finalHtml, text: finalText } = buildEmailWithSignature({
    baseText,
    baseHtml,
    from,
  });

  try {
    // -----------------------------------------------------------------
    // 3) Real sending via SMTP Hostinger
    // -----------------------------------------------------------------
    const info = await sendEmail({
      from,
      to,
      subject,
      text: finalText,
      html: finalHtml,
      attachments,
    });

    const providerMessageId = info?.messageId || null;

    // 🔹 Legacy log
    const outboxId = await logEmailOutbox({
      from,
      to,
      subject,
      bodyText: finalText,
      bodyHtml: finalHtml,
      status: 'SENT',
      providerMessageId,
      errorMessage: null,
    });

    // 🔹 Unified table (used by "E-mails Sent" screen)
    await saveOutboundInUnifiedTable({
      from,
      to,
      subject,
      bodyText: finalText,
      bodyHtml: finalHtml,
      sentAt,
      messageId: providerMessageId,
      status: 'SENT',
      errorMessage: null,
    });

    return res.status(200).json({
      success: true,
      message: 'E-mail enviado com sucesso.',
      outboxId,
      provider: info,
    });
  } catch (err) {
    console.error('[emailOutboxController] Erro ao enviar e-mail:', err);
    const errorMessage = err.message || String(err);

    const outboxId = await logEmailOutbox({
      from,
      to,
      subject,
      bodyText: finalText,
      bodyHtml: finalHtml,
      status: 'ERROR',
      providerMessageId: null,
      errorMessage,
    });

    try {
      await saveOutboundInUnifiedTable({
        from,
        to,
        subject,
        bodyText: finalText,
        bodyHtml: finalHtml,
        sentAt: new Date(),
        messageId: null,
        status: 'ERROR',
        errorMessage,
      });
    } catch (innerErr) {
      console.error('[emailOutboxController] Falha ao salvar em emailOutbounds:', innerErr);
    }

    return res.status(500).json({
      success: false,
      error: 'Falha ao enviar o e-mail.',
      outboxId,
    });
  }
}

/**
 * GET /api/email/outbox
 * Lista últimos e-mails enviados (log legado)
 */
export async function listOutboxEmails(req, res) {
  const limit = Number(req.query.limit || 50);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, from_address, to_address, subject, status, created_at
         FROM public."emailOutboxLog"
         ORDER BY created_at DESC
         LIMIT $1`,
      [limit],
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('[emailOutboxController] Erro ao listar e-mails:', err);
    return res.status(500).json({ error: 'Erro ao listar outbox.' });
  } finally {
    client.release();
  }
}
