// ╔══════════════════════════════════════════════════════════════════════╗
// ║ smtpHostingerSender.js — Send e-mail via Hostinger (SMTP)           ║
// ║ CONSART ERP                                                         ║
// ║ ✔️ FIX: suporte completo a attachments                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import nodemailer from 'nodemailer';

const SMTP_HOST   = process.env.ROCHIN_AIR_SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT   = Number(process.env.ROCHIN_AIR_SMTP_PORT || 465);
const SMTP_SECURE =
  String(process.env.ROCHIN_AIR_SMTP_SECURE ?? 'true').toLowerCase() === 'true';

const SMTP_USER = process.env.ROCHIN_AIR_EMAIL_USER;
const SMTP_PASS = process.env.ROCHIN_AIR_EMAIL_PASS;

let transporter = null;

function getTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error(
      '[smtpHostingerSender] ROCHIN_AIR_EMAIL_USER/ROCHIN_AIR_EMAIL_PASS not configured.'
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

/**
 * Send one e-mail using Hostinger SMTP.
 *
 * @param {{
 *   to: string,
 *   subject?: string,
 *   text?: string,
 *   html?: string,
 *   attachments?: Array<{
 *     filename: string,
 *     content: Buffer,
 *     contentType?: string
 *   }>
 * }} opts
 */
export async function sendHostingerMail({ to, subject, text, html, attachments }) {
  const transport = getTransporter();

  const info = await transport.sendMail({
    from: SMTP_USER,
    to,
    subject: subject || '',
    text: text || '',
    html: html || text || '',
    attachments: Array.isArray(attachments) ? attachments : [],
  });

  return info;
}

export default { sendHostingerMail };
