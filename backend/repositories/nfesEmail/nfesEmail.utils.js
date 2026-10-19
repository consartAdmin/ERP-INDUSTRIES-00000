// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfesEmail.utils.js — Helpers puros: chaves, URLs /public, HTML, body ║
// ╚══════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { PUBLIC_DIR } from './nfesEmail.constants.js';

// -------------------------------
// Small utils
// -------------------------------
export const safeKeyStr = (v) => String(v || '').replace(/[^\dA-Za-z_-]/g, '').slice(0, 120);

export const isPublicUrl = (u) => {
  const s = String(u || '').trim();
  return s.startsWith('/public/');
};

export const publicUrlToAbsPath = (publicUrl) => {
  const u = String(publicUrl || '').trim();
  if (!u.startsWith('/public/')) return null;
  const rel = u.replace(/^\/public\//, '');
  return path.join(PUBLIC_DIR, rel);
};

export function guessFilenameFromUrl(url, fallback = 'boleto.pdf') {
  try {
    const u = String(url || '').trim();
    if (!u) return fallback;

    // /public/boletos/xyz.pdf
    if (u.startsWith('/public/')) {
      const base = path.basename(u);
      return base || fallback;
    }

    // remota
    const parsed = new URL(u);
    const base = path.basename(parsed.pathname || '');
    return base && base.includes('.') ? base : fallback;
  } catch {
    return fallback;
  }
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ===============================================================
   BUILD EMAIL BODY
=============================================================== */
export function buildEmailBodies({ statusNorm, safeKey, boletoAttachment, boletoUrl }) {
  const boletoLine = boletoAttachment
    ? 'Boleto: anexado.'
    : boletoUrl
      ? `Boleto (link): ${boletoUrl}`
      : 'Boleto: não disponível.';

  const boletoLineHtml = escapeHtml(boletoLine).replaceAll('\n', '<br/>');

  return {
    bodyText:
      `Segue em anexo a NF-e (${statusNorm}).\n` +
      `Chave: ${safeKey}\n` +
      `${boletoLine}\n\nCONSART ERP`,

    bodyHtml:
      // (indentação interna do template mantida igual à do original)
      `<p>Segue em anexo a NF-e (<b>${escapeHtml(statusNorm)}</b>).</p>
         <p><b>Chave:</b> ${escapeHtml(safeKey)}</p>
         <p><b>${boletoLineHtml}</b></p>
         <p>CONSART ERP</p>`,
  };
}
