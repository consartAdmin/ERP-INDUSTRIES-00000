// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaas.utils.js — Helpers puros (FS, números, HTML, log de erros)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';

/* ---------------------------------------------------------------------- */
/* FS Helpers                                                             */
/* ---------------------------------------------------------------------- */
export function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('[AsaasAPI] ensureDir falhou:', dir, e?.message || e);
  }
}

export function safeFilename(s) {
  return String(s || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 180);
}

export function sanitizeString(str) {
  if (!str) return undefined;
  const s = String(str).trim();
  return s || undefined;
}

export function normalizeNumber(v, fallback = 0) {
  const n = Number(
    typeof v === 'string' ? v.replace(/\./g, '').replace(',', '.') : v
  );
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Converte um valor (percentual) no formato aceito pelo Asaas:
 *  - Se > 0  → { value: n }
 *  - Se <= 0 → undefined (campo NÃO é enviado)
 */
export function toPercentField(v) {
  const n = normalizeNumber(v, 0);
  if (n > 0) return { value: n };
  return undefined;
}

export function isProbablyHtml(buf, contentType = '') {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('text/html')) return true;

  const head = Buffer.isBuffer(buf) ? buf.slice(0, 80).toString('utf8') : '';
  const h = head.toLowerCase();
  return h.includes('<!doctype html') || h.includes('<html') || h.includes('<head');
}

export function logAsaasError(context, error) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  console.error(`❌ [AsaasAPI Error - ${context}] STATUS:`, status || 'N/A');

  // Quando o Asaas (ou URL errada) devolve HTML, isso ajuda a enxergar.
  if (typeof data === 'string') {
    console.error(`❌ [AsaasAPI Error - ${context}] data (string):`, data.slice(0, 1000));
    return;
  }

  const errors = data?.errors;
  if (Array.isArray(errors) && errors.length) {
    console.error(`❌ [AsaasAPI Error - ${context}] errors:`, errors);
  } else if (data) {
    console.error(`❌ [AsaasAPI Error - ${context}] data:`, data);
  } else {
    console.error(`❌ [AsaasAPI Error - ${context}] raw:`, error?.message || error);
  }
}

export function fileExists(absPath) {
  try {
    if (!absPath) return false;
    return fs.existsSync(absPath);
  } catch {
    return false;
  }
}

export function sanitizeBaseUrl(u) {
  const raw = String(u || '').trim().replace(/\/+$/, '');
  if (!raw) return 'https://api.asaas.com/v3';
  // Normaliza: se vier sem /v3, adiciona
  if (!/\/v3$/i.test(raw)) return `${raw}/v3`;
  return raw;
}
