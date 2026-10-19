// ╔══════════════════════════════════════════════════════════════════╗
// ║ smtpHostingerClient.js — Envio SMTP via Hostinger (Nodemailer)   ║
// ║ CONSART ERP — usado por emailOutboxController                    ║
// ╚══════════════════════════════════════════════════════════════════╝

import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { BH3_LOGO_CID } from './defaultSignature.js';

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------------
// Transporter Hostinger
// -------------------------------------------------------------------
const SMTP_USER = process.env.ROCHIN_AIR_EMAIL_USER;
const SMTP_PASS = process.env.ROCHIN_AIR_EMAIL_PASS;
const SMTP_HOST = process.env.ROCHIN_AIR_EMAIL_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.ROCHIN_AIR_EMAIL_PORT || 465);

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for 587
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// (opcional, mas ajuda debug)
export async function verifySmtp() {
  return transporter.verify();
}

/**
 * Envia e-mail genérico via Hostinger
 * @param {object} params
 * @param {string} params.from
 * @param {string|string[]} params.to
 * @param {string} params.subject
 * @param {string} [params.text]
 * @param {string} [params.html]
 * @param {Array}  [params.attachments]
 */
export async function sendEmail({
  from,
  to,
  subject,
  text,
  html,
  attachments = [],
}) {
  // Caminho físico da assinatura (imagem)
  const logoPath = path.join(
    __dirname,
    '../../public/imagens/assinaturaComercialMg.png'
  );

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Assinatura não encontrada em: ${logoPath}`);
  }

  // ✅ Inline CID bem “forte” para clientes (Gmail/Outlook)
  const inlineSignatureAttachment = {
    filename: 'assinaturaComercialMg.png',
    path: logoPath,
    cid: BH3_LOGO_CID,               // precisa bater com <img src="cid:bh3-logo" />
    contentType: 'image/png',        // importante
    contentDisposition: 'inline',    // importante
    headers: {
      'Content-ID': `<${BH3_LOGO_CID}>`,
      'X-Attachment-Id': BH3_LOGO_CID,
    },
  };

  // ⚠️ Se por acaso o seu attachments externo já tem outro CID igual,
  // isso evita duplicar (e evita "2 anexos").
  const filtered = (attachments || []).filter((a) => a?.cid !== BH3_LOGO_CID);

  const finalAttachments = [inlineSignatureAttachment, ...filtered];

  const info = await transporter.sendMail({
    from,
    to,
    subject,

    // ✅ Para “somente imagem”, mantenha text vazio/undefined
    // (se você passar text com algo, alguns clientes exibem parte disso)
    text: text || undefined,
    html: html || undefined,

    attachments: finalAttachments,
  });

  return info;
}
