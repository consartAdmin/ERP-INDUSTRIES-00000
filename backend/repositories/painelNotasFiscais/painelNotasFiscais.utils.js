// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscais.utils.js — Helpers: fs, números, datas, URLs, log ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import { XML_SUBDIR, PDF_SUBDIR, LOG_ON } from './painelNotasFiscais.constants.js';

export const log = (...args) => {
  if (LOG_ON) console.warn('[painelNotasFiscaisApi]', ...args);
};

// ───────────────────────────────────────────────────────────────────────────
// Utils
export function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

export function toNumberSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const s = String(value).trim();
  if (!s) return null;

  // aceita "1.234,56" e "1234.56"
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/[^\d.-]/g, '');

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function normalizeDateForCompare(value) {
  if (!value) return 0;
  const s = String(value).trim();

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return parsed;

  // tenta YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    const iso = s.replace(' ', 'T');
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) return ts;
  }

  // tenta DD/MM/YYYY HH:mm
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (br) {
    const [, dd, mm, yyyy, hh = '00', mi = '00'] = br;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) return ts;
  }

  return 0;
}

export function publicXmlUrl(fileName) {
  return `/public/${XML_SUBDIR}/${encodeURIComponent(fileName)}`;
}

export function publicPdfUrl(fileName) {
  return `/public/${PDF_SUBDIR}/${encodeURIComponent(fileName)}`;
}

export function getNodeValue(...values) {
  for (const v of values) {
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}
